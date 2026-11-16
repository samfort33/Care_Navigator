import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, requireRole, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const signOffSchema = z.object({
  decisionType: z.enum(['CARE_PLAN_SIGNED', 'OVERRIDDEN', 'CONCURRED']).default('CARE_PLAN_SIGNED'),
  concordanceStatus: z.enum(['AGREED', 'OVERRIDDEN_HIGHER', 'OVERRIDDEN_LOWER']).default('AGREED'),
  overriddenAcuity: z.enum(['SELF_CARE', 'ROUTINE', 'URGENT', 'EMERGENCY']).optional(),
  clinicianNote: z.string().min(5, { message: 'Clinician note must be provided for clinical sign-off.' }),
  rationale: z.string().default('Clinical review complete; care plan attested and authorized for patient discharge/referral.'),
});

/**
 * POST /api/reviews/[id]/sign-off
 * Enforces RBAC: Only CLINICIAN or ADMIN roles are permitted to sign off on reviews.
 * Patients receive 403 Forbidden.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    // ENFORCE RBAC: CLINICIAN OR ADMIN ONLY
    requireRole(user, ['CLINICIAN', 'ADMIN']);

    const review = await prisma.clinicianReview.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'Clinician review record not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = signOffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { decisionType, concordanceStatus, overriddenAcuity, clinicianNote, rationale } =
      parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const rev = await tx.clinicianReview.update({
        where: { id },
        data: {
          stage: 'SIGNED',
          concordanceStatus,
          overriddenAcuity: overriddenAcuity || null,
          clinicianNote,
          signedAt: new Date(),
        },
      });

      const decision = await tx.reviewDecision.create({
        data: {
          reviewId: rev.id,
          clinicianUserId: user.id,
          decisionType,
          previousStage: review.stage,
          newStage: 'SIGNED',
          overriddenAcuity: overriddenAcuity || null,
          rationale,
          isSeedFixture: false,
        },
      });

      await tx.triageSession.update({
        where: { id: review.sessionId },
        data: {
          status: 'VERIFIED',
          acuityLevel: overriddenAcuity || review.session.acuityLevel,
        },
      });

      await tx.assessmentStatusHistory.create({
        data: {
          sessionId: review.sessionId,
          fromStatus: review.session.status,
          toStatus: 'VERIFIED',
          transitionReason: `Clinician sign-off completed by ${user.name} (${user.role})`,
          changedByUserId: user.id,
        },
      });

      return { review: rev, decision };
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'CLINICIAN_SIGN_OFF',
      targetEntityType: 'ClinicianReview',
      targetEntityId: id,
      finalAcuity: overriddenAcuity || review.session.acuityLevel,
      metadata: {
        sessionId: review.sessionId,
        concordanceStatus,
        overriddenAcuity,
      },
    });

    return NextResponse.json({
      success: true,
      review: result.review,
      decision: result.decision,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('REVIEW_SIGN_OFF_ERROR', error);
    return NextResponse.json({ error: 'Failed to sign off clinician review.' }, { status: 500 });
  }
}
