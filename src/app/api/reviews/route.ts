import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/server/auth/session';
import { listClinicianReviews } from '@/server/reviews/service';
import { logger } from '@/lib/logger';

/**
 * GET /api/reviews
 * Role-protected endpoint for clinicians and administrators to view the triage review queue.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // Role check: Only CLINICIAN or ADMIN can view the clinical review queue
    if (session.role !== 'CLINICIAN' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Access to clinical review queue is restricted to authorized clinicians.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage') || 'ALL';
    const acuity = searchParams.get('acuity') || 'ALL';
    const searchQuery = searchParams.get('q') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    const result = await listClinicianReviews({
      stage,
      acuity,
      searchQuery,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('REVIEWS_QUERY_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
