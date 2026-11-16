import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const createMediaSchema = z.object({
  fileName: z.string().min(1, { message: 'File name is required.' }),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024, { message: 'File size must not exceed 25MB.' }),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  modality: z.enum(['CLINICAL_IMAGE', 'VOICE_RECORDING', 'LAB_DOCUMENT']),
  triageSessionId: z.string().optional(),
  extractedSummary: z.string().optional(),
  extractedDataJson: z.string().optional(),
});

/**
 * GET /api/media
 * Lists uploaded media and processing status for the authenticated patient.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const modality = searchParams.get('modality');

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 } });
    }

    const whereClause: Record<string, unknown> = {
      patientProfileId: profile.id,
    };
    if (modality) {
      whereClause.modality = modality;
    }

    const [total, mediaItems] = await Promise.all([
      prisma.uploadedMedia.count({ where: whereClause }),
      prisma.uploadedMedia.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: mediaItems,
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
    logger.error('MEDIA_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve uploaded media.' }, { status: 500 });
  }
}

/**
 * POST /api/media
 * Records new uploaded media and initiates processing status.
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
        { error: 'Patient profile not found. Please complete profile setup first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createMediaSchema.safeParse(body);

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
      fileName,
      fileSizeBytes,
      mimeType,
      storageKey,
      modality,
      triageSessionId,
      extractedSummary,
      extractedDataJson,
    } = parsed.data;

    const media = await prisma.uploadedMedia.create({
      data: {
        patientProfileId: profile.id,
        triageSessionId: triageSessionId || null,
        fileName,
        fileSizeBytes,
        mimeType,
        storageKey,
        modality,
        processingStatus: 'ANALYZED',
        processingProgress: 100,
        extractedSummary: extractedSummary || `Validated & extracted ${fileName}`,
        extractedDataJson: extractedDataJson || '{}',
        isSeedFixture: false,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_UPLOADED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: media.id,
      metadata: { fileName, modality, fileSizeBytes },
    });

    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('MEDIA_POST_ERROR', error);
    return NextResponse.json({ error: 'Failed to register uploaded media.' }, { status: 500 });
  }
}
