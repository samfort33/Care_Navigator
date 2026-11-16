import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import {
  getReferralsForPatient,
  createReferral,
  suggestReferralsForAssessment,
} from '@/server/referrals/service';
import { logger } from '@/lib/logger';

const CreateReferralSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  specialtyNeeded: z.string().min(1, 'Specialty is required'),
  urgency: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']).optional(),
  clinicalSummary: z.string().min(5, 'Clinical summary is required'),
  triageSessionId: z.string().optional().nullable(),
});

/**
 * GET /api/referrals
 * Returns referrals for the authenticated patient.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: session.id },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'PATIENT_PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Suggest / generate referrals for this specific session if needed
      const referrals = await suggestReferralsForAssessment(sessionId, patientProfile.id);
      return NextResponse.json({ referrals });
    }

    const referrals = await getReferralsForPatient(patientProfile.id);
    return NextResponse.json({ referrals });
  } catch (error: unknown) {
    logger.error('REFERRALS_GET_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve referrals.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/referrals
 * Creates a referral for the authenticated patient.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: session.id },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'PATIENT_PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = CreateReferralSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: parseResult.error.format() },
        { status: 400 }
      );
    }

    const referral = await createReferral({
      patientProfileId: patientProfile.id,
      doctorId: parseResult.data.doctorId,
      specialtyNeeded: parseResult.data.specialtyNeeded,
      urgency: parseResult.data.urgency,
      clinicalSummary: parseResult.data.clinicalSummary,
      triageSessionId: parseResult.data.triageSessionId,
    });

    return NextResponse.json({ referral }, { status: 201 });
  } catch (error: unknown) {
    logger.error('REFERRAL_CREATE_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create referral.' },
      { status: 500 }
    );
  }
}
