import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { updateReferralStatus, ReferralStatus } from '@/server/referrals/service';
import { logger } from '@/lib/logger';

const UpdateReferralSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'SCHEDULED', 'COMPLETED', 'DECLINED']),
});

/**
 * PATCH /api/referrals/[id]
 * Updates status of a care referral with patient ownership validation.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const { id } = await params;

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: session.id },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'PATIENT_PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = UpdateReferralSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: parseResult.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateReferralStatus(
      id,
      patientProfile.id,
      parseResult.data.status as ReferralStatus
    );

    return NextResponse.json({ referral: updated });
  } catch (error: unknown) {
    logger.error('REFERRAL_UPDATE_FAILED', error);
    const msg = error instanceof Error ? error.message : 'Failed to update referral.';

    if (msg.startsWith('UNAUTHORIZED_ACCESS')) {
      return NextResponse.json({ error: 'FORBIDDEN', message: msg }, { status: 403 });
    }
    if (msg.startsWith('REFERRAL_NOT_FOUND')) {
      return NextResponse.json({ error: 'NOT_FOUND', message: msg }, { status: 404 });
    }

    return NextResponse.json({ error: 'UPDATE_FAILED', message: msg }, { status: 500 });
  }
}
