import { prisma } from '@/lib/prisma';
import { recordAuditLog, AuditActionType } from '@/server/audit/audit-logger';

export interface ListReviewsFilter {
  stage?: string;
  acuity?: string;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export async function listClinicianReviews(filters?: ListReviewsFilter) {
  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters?.limit ?? 15));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};

  if (filters?.stage && filters.stage !== 'ALL') {
    whereClause.stage = filters.stage;
  }

  if (filters?.acuity && filters.acuity !== 'ALL') {
    whereClause.session = {
      ...((whereClause.session as Record<string, unknown>) || {}),
      acuityLevel: filters.acuity,
    };
  }

  if (filters?.searchQuery && filters.searchQuery.trim().length > 0) {
    const q = filters.searchQuery.trim();
    whereClause.OR = [
      { session: { chiefComplaint: { contains: q } } },
      { session: { sessionCode: { contains: q } } },
      { session: { patientProfile: { user: { name: { contains: q } } } } },
      { session: { patientProfile: { user: { mrn: { contains: q } } } } },
    ];
  }

  // Get tab metrics across all stages
  const [queuedCount, reviewingCount, signedCount, escalatedCount, totalFiltered, reviews] =
    await Promise.all([
      prisma.clinicianReview.count({ where: { stage: 'QUEUED' } }),
      prisma.clinicianReview.count({ where: { stage: 'REVIEWING' } }),
      prisma.clinicianReview.count({ where: { stage: 'SIGNED' } }),
      prisma.clinicianReview.count({ where: { stage: 'ESCALATED' } }),
      prisma.clinicianReview.count({ where: whereClause }),
      prisma.clinicianReview.findMany({
        where: whereClause,
        include: {
          clinician: {
            select: {
              id: true,
              name: true,
              email: true,
              title: true,
            },
          },
          session: {
            include: {
              patientProfile: {
                select: {
                  id: true,
                  age: true,
                  sex: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      mrn: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  citations: true,
                  uploadedMedia: true,
                },
              },
            },
          },
          reviewDecisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

  return {
    reviews,
    metrics: {
      queued: queuedCount,
      reviewing: reviewingCount,
      signed: signedCount,
      escalated: escalatedCount,
      total: queuedCount + reviewingCount + signedCount + escalatedCount,
    },
    pagination: {
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit),
    },
  };
}

export async function getReviewDossier(reviewId: string) {
  const review = await prisma.clinicianReview.findFirst({
    where: {
      OR: [{ id: reviewId }, { sessionId: reviewId }],
    },
    include: {
      clinician: {
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          specialty: true,
        },
      },
      session: {
        include: {
          patientProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  mrn: true,
                },
              },
              conditions: true,
              medications: true,
              allergies: true,
            },
          },
          answers: {
            orderBy: { stepNumber: 'asc' },
          },
          explanations: {
            orderBy: { importanceRank: 'asc' },
          },
          citations: {
            include: {
              guideline: true,
              chunk: true,
            },
            orderBy: { relevanceScore: 'desc' },
          },
          uploadedMedia: {
            orderBy: { createdAt: 'desc' },
          },
          careReferrals: {
            include: { doctor: true },
          },
        },
      },
      reviewDecisions: {
        include: {
          clinicianUser: {
            select: {
              id: true,
              name: true,
              title: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return review;
}

export interface SubmitReviewDecisionInput {
  reviewId: string;
  clinicianUserId: string;
  decisionType: 'CONCURRED' | 'OVERRIDDEN' | 'CLARIFICATION_REQUESTED' | 'CARE_PLAN_SIGNED' | 'ESCALATED';
  newStage: 'QUEUED' | 'REVIEWING' | 'SIGNED' | 'ESCALATED';
  overriddenAcuity?: string;
  rationale: string;
  clinicianNote?: string;
  actionRequiredNote?: string;
}

export async function submitReviewDecision(input: SubmitReviewDecisionInput) {
  const clinicianUser = await prisma.user.findUnique({
    where: { id: input.clinicianUserId },
  });

  if (!clinicianUser || (clinicianUser.role !== 'CLINICIAN' && clinicianUser.role !== 'ADMIN')) {
    throw new Error('UNAUTHORIZED: Only verified clinicians or administrators can submit review decisions.');
  }

  const review = await prisma.clinicianReview.findFirst({
    where: {
      OR: [{ id: input.reviewId }, { sessionId: input.reviewId }],
    },
    include: { session: true },
  });

  if (!review) {
    throw new Error('REVIEW_NOT_FOUND: The requested clinician review was not found.');
  }

  const previousStage = review.stage;
  let concordanceStatus = review.concordanceStatus;

  if (input.decisionType === 'OVERRIDDEN' && input.overriddenAcuity) {
    const acuityRanks: Record<string, number> = {
      SELF_CARE: 1,
      ROUTINE: 2,
      URGENT: 3,
      EMERGENCY: 4,
    };
    const origRank = acuityRanks[review.session.acuityLevel] ?? 2;
    const newRank = acuityRanks[input.overriddenAcuity] ?? 2;
    concordanceStatus = newRank > origRank ? 'OVERRIDDEN_HIGHER' : 'OVERRIDDEN_LOWER';
  } else if (input.decisionType === 'CONCURRED' || input.decisionType === 'CARE_PLAN_SIGNED') {
    concordanceStatus = 'AGREED';
  }

  const isSigning = input.newStage === 'SIGNED' || input.decisionType === 'CARE_PLAN_SIGNED';
  const isEscalating = input.newStage === 'ESCALATED' || input.decisionType === 'ESCALATED';

  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Create immutable ReviewDecision
    const decision = await tx.reviewDecision.create({
      data: {
        reviewId: review.id,
        clinicianUserId: input.clinicianUserId,
        decisionType: input.decisionType,
        previousStage,
        newStage: input.newStage,
        overriddenAcuity: input.overriddenAcuity ?? null,
        rationale: input.rationale.trim(),
        isSeedFixture: false,
      },
    });

    // 2. Update ClinicianReview state
    const updatedReview = await tx.clinicianReview.update({
      where: { id: review.id },
      data: {
        stage: input.newStage,
        concordanceStatus,
        overriddenAcuity: input.overriddenAcuity ?? review.overriddenAcuity,
        clinicianNote: input.clinicianNote?.trim() ?? review.clinicianNote,
        actionRequiredNote: input.actionRequiredNote?.trim() ?? review.actionRequiredNote,
        signedAt: isSigning ? new Date() : review.signedAt,
      },
      include: {
        session: true,
        clinician: true,
        reviewDecisions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 3. Update parent TriageSession if acuity was overridden or care plan signed
    const sessionUpdates: Record<string, unknown> = {};
    if (input.overriddenAcuity) {
      sessionUpdates.acuityLevel = input.overriddenAcuity;
    }
    if (isSigning) {
      sessionUpdates.status = 'VERIFIED';
      sessionUpdates.completedAt = new Date();
    } else if (isEscalating) {
      sessionUpdates.status = 'ACTION_REQUIRED';
    }

    if (Object.keys(sessionUpdates).length > 0) {
      await tx.triageSession.update({
        where: { id: review.sessionId },
        data: sessionUpdates,
      });
    }

    // 4. Notify patient
    const patientProfile = await tx.patientProfile.findUnique({
      where: { id: review.session.patientProfileId },
      select: { userId: true },
    });

    if (patientProfile?.userId) {
      const notifTitle = isSigning
        ? `Care Plan Signed & Verified by ${clinicianUser.name}`
        : isEscalating
        ? `Clinical Priority Escalated for Assessment #${review.session.sessionCode}`
        : `Assessment Update: Notes Added by Clinician`;

      const notifBody = isSigning
        ? `Your assessment #${review.session.sessionCode} has completed clinician review. The verified care plan is now ready.`
        : isEscalating
        ? `A clinician flagged critical care considerations. Please review immediate guidance.`
        : `Dr. ${clinicianUser.name} submitted an update regarding your assessment #${review.session.sessionCode}.`;

      await tx.notification.create({
        data: {
          userId: patientProfile.userId,
          category: 'clinical',
          title: notifTitle,
          body: notifBody,
          actionLabel: 'View Results',
          actionHref: `/assessments/${review.session.id}/results`,
          isRead: false,
        },
      });
    }

    return { review: updatedReview, decision };
  });

  // 5. Immutable Audit Log (recorded post-transaction to prevent lock contention in SQLite)
  const auditAction: AuditActionType = isSigning
    ? 'CLINICIAN_SIGN_OFF'
    : input.decisionType === 'OVERRIDDEN'
    ? 'CLINICIAN_OVERRIDE'
    : isEscalating
    ? 'HIGH_RISK_ESCALATION'
    : 'CLINICIAN_SIGN_OFF';

  await recordAuditLog({
    actorUserId: input.clinicianUserId,
    actorRole: clinicianUser.role,
    actionType: auditAction,
    targetEntityType: 'ClinicianReview',
    targetEntityId: review.id,
    aiAcuity: review.session.acuityLevel,
    finalAcuity: input.overriddenAcuity ?? review.session.acuityLevel,
    metadata: {
      sessionId: review.sessionId,
      decisionType: input.decisionType,
      previousStage,
      newStage: input.newStage,
      concordanceStatus,
    },
  });

  return txResult;
}
