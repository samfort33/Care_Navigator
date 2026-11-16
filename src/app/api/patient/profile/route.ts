import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const updateProfileSchema = z.object({
  primaryCarePhysician: z.string().min(2).optional(),
  insuranceProvider: z.string().min(2).optional(),
  insuranceMemberId: z.string().min(2).optional(),
  emergencyContactName: z.string().min(2).optional().nullable(),
  emergencyContactPhone: z.string().min(5).optional().nullable(),
  bloodType: z.string().optional(),
});

/**
 * GET /api/patient/profile
 * Returns the authenticated patient's full medical profile and clinical lists.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    let targetUserId = user.id;
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    if (requestedUserId && (user.role === 'CLINICIAN' || user.role === 'ADMIN')) {
      targetUserId = requestedUserId;
    }

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: targetUserId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            mrn: true,
          },
        },
        vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 10 },
        medications: true,
        allergies: true,
        prescriptions: { orderBy: { prescribedDate: 'desc' } },
        testReports: { orderBy: { reportedAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('PATIENT_PROFILE_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve patient profile.' }, { status: 500 });
  }
}

/**
 * PUT /api/patient/profile
 * Updates permitted demographic, insurance, and emergency contact fields for the patient.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const updated = await prisma.patientProfile.update({
      where: { id: profile.id },
      data: parsed.data,
      include: {
        user: { select: { name: true, email: true, mrn: true } },
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'PROFILE_UPDATED',
      targetEntityType: 'PatientProfile',
      targetEntityId: updated.id,
      metadata: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: 'Patient profile updated successfully.',
      profile: updated,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('PATIENT_PROFILE_PUT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update patient profile.' }, { status: 500 });
  }
}
