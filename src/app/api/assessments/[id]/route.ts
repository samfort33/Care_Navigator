import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, requireRecordOwnership, AuthError } from '@/server/auth/guards';
import { logger } from '@/lib/logger';

/**
 * GET /api/assessments/[id]
 * Enforces strict record ownership: returns 403 Forbidden if another patient tries to access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const triageSession = await prisma.triageSession.findFirst({
      where: {
        OR: [{ id }, { sessionCode: id }],
      },
      include: {
        answers: { orderBy: { stepNumber: 'asc' } },
        explanations: { orderBy: { importanceRank: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        citations: { include: { guideline: true } },
        clinicianReview: {
          include: {
            clinician: { select: { id: true, name: true, specialty: true, title: true } },
            reviewDecisions: { orderBy: { createdAt: 'desc' } },
          },
        },
        patientProfile: {
          select: {
            id: true,
            userId: true,
            dateOfBirth: true,
            age: true,
            sex: true,
            user: { select: { id: true, name: true, mrn: true, email: true } },
          },
        },
      },
    });

    if (!triageSession) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }

    // ENFORCE OWNERSHIP
    requireRecordOwnership(user, triageSession.patientProfile.userId, { allowClinicalAccess: true });

    return NextResponse.json({ success: true, session: triageSession });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('ASSESSMENT_BY_ID_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve assessment details.' }, { status: 500 });
  }
}
