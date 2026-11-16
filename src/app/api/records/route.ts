import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const createDocumentSchema = z.object({
  title: z.string().min(2, { message: 'Document title is required.' }),
  category: z.enum(['LAB_RESULTS', 'IMAGING', 'DISCHARGE_SUMMARY', 'CONSULT_NOTE', 'CLINICAL_PHOTO', 'SUPPLEMENTAL']).default('LAB_RESULTS'),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024, { message: 'File size must not exceed 25MB.' }),
  storageKey: z.string().min(1),
  facilityName: z.string().optional(),
  orderingClinician: z.string().optional(),
  aiPlainSummary: z.string().optional(),
  clinicalObservations: z.string().optional(),
  biomarkers: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        unit: z.string(),
        referenceRange: z.string(),
        flag: z.enum(['NORMAL', 'SLIGHTLY_ELEVATED', 'ELEVATED', 'CRITICAL']).default('NORMAL'),
        interpretation: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * GET /api/records
 * Returns paginated medical documents with ownership enforcement.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const category = searchParams.get('category');
    const targetUserId = searchParams.get('userId');

    // Ownership check: If patient, must query own profile. If clinician/admin, can query specific patient or all.
    let patientProfileId: string | undefined;

    if (user.role === 'PATIENT') {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) {
        return NextResponse.json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      patientProfileId = profile.id;
    } else if (targetUserId) {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId: targetUserId },
      });
      if (profile) patientProfileId = profile.id;
    }

    const whereClause: Record<string, unknown> = {};
    if (patientProfileId) {
      whereClause.patientProfileId = patientProfileId;
    }
    if (category) {
      whereClause.category = category;
    }

    const [total, documents] = await Promise.all([
      prisma.medicalDocument.count({ where: whereClause }),
      prisma.medicalDocument.findMany({
        where: whereClause,
        include: {
          biomarkers: true,
          patientProfile: {
            select: {
              id: true,
              userId: true,
              user: { select: { name: true, mrn: true } },
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: documents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('RECORDS_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve medical records.' }, { status: 500 });
  }
}

/**
 * POST /api/records
 * Uploads/creates a medical document record for the authenticated patient's profile.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found. Complete onboarding before uploading documents.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const {
      title,
      category,
      fileName,
      mimeType,
      fileSizeBytes,
      storageKey,
      facilityName,
      orderingClinician,
      aiPlainSummary,
      clinicalObservations,
      biomarkers,
    } = parsed.data;

    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.medicalDocument.create({
        data: {
          patientProfileId: profile.id,
          title,
          category,
          fileName,
          mimeType,
          fileSizeBytes,
          storageKey,
          facilityName: facilityName || null,
          orderingClinician: orderingClinician || null,
          ocrStatus: 'COMPLETE',
          aiPlainSummary: aiPlainSummary || null,
          clinicalObservations: clinicalObservations || null,
          isSeedFixture: false,
        },
      });

      if (biomarkers && biomarkers.length > 0) {
        await tx.extractedBiomarker.createMany({
          data: biomarkers.map((b) => ({
            documentId: doc.id,
            name: b.name,
            value: b.value,
            unit: b.unit,
            referenceRange: b.referenceRange,
            flag: b.flag,
            interpretation: b.interpretation || null,
            isSeedFixture: false,
          })),
        });
      }

      const docWithBiomarkers = await tx.medicalDocument.findUnique({
        where: { id: doc.id },
        include: { biomarkers: true },
      });

      return docWithBiomarkers || doc;
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_UPLOADED',
      targetEntityType: 'MedicalDocument',
      targetEntityId: document.id,
      metadata: { title, category, fileName },
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('RECORDS_POST_ERROR', error);
    return NextResponse.json({ error: 'Failed to create medical document.' }, { status: 500 });
  }
}
