import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/server/auth/session';
import { getReviewDossier, submitReviewDecision } from '@/server/reviews/service';
import { logger } from '@/lib/logger';

const SubmitDecisionSchema = z.object({
  decisionType: z.enum([
    'CONCURRED',
    'OVERRIDDEN',
    'CLARIFICATION_REQUESTED',
    'CARE_PLAN_SIGNED',
    'ESCALATED',
  ]),
  newStage: z.enum(['QUEUED', 'REVIEWING', 'SIGNED', 'ESCALATED']),
  overriddenAcuity: z.enum(['SELF_CARE', 'ROUTINE', 'URGENT', 'EMERGENCY']).optional(),
  rationale: z.string().min(3, 'Rationale must be at least 3 characters'),
  clinicianNote: z.string().optional(),
  actionRequiredNote: z.string().optional(),
});

/**
 * GET /api/reviews/[id]
 * Retrieves the complete clinical review dossier for an assessment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    if (session.role !== 'CLINICIAN' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Restricted to authorized clinical personnel.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const dossier = await getReviewDossier(id);

    if (!dossier) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Review dossier not found.' }, { status: 404 });
    }

    return NextResponse.json({ review: dossier });
  } catch (error: unknown) {
    logger.error('REVIEW_DOSSIER_GET_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews/[id]
 * Submits a clinical decision, stage transition, or care plan sign-off.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    if (session.role !== 'CLINICIAN' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Only clinicians or admins can submit review decisions.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parseResult = SubmitDecisionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: parseResult.error.format() },
        { status: 400 }
      );
    }

    const result = await submitReviewDecision({
      reviewId: id,
      clinicianUserId: session.id,
      decisionType: parseResult.data.decisionType,
      newStage: parseResult.data.newStage,
      overriddenAcuity: parseResult.data.overriddenAcuity,
      rationale: parseResult.data.rationale,
      clinicianNote: parseResult.data.clinicianNote,
      actionRequiredNote: parseResult.data.actionRequiredNote,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    logger.error('SUBMIT_REVIEW_DECISION_FAILED', error);
    const msg = error instanceof Error ? error.message : 'Failed to submit review decision.';

    if (msg.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'FORBIDDEN', message: msg }, { status: 403 });
    }
    if (msg.startsWith('REVIEW_NOT_FOUND')) {
      return NextResponse.json({ error: 'NOT_FOUND', message: msg }, { status: 404 });
    }

    return NextResponse.json({ error: 'SUBMIT_FAILED', message: msg }, { status: 500 });
  }
}
