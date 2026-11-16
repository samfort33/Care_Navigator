import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import {
  AssessmentResultsView,
  type TriageSessionRecord,
} from '@/components/triage/AssessmentResultsView';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default async function AssessmentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userSession = await getServerSession();

  if (!userSession) {
    redirect('/login');
  }

  const triageSession = await prisma.triageSession.findFirst({
    where: {
      OR: [{ id }, { sessionCode: id }],
    },
    include: {
      answers: { orderBy: { stepNumber: 'asc' } },
      explanations: { orderBy: { importanceRank: 'asc' } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
      citations: { include: { guideline: true, chunk: true } },
      clinicianReview: {
        include: {
          clinician: { select: { id: true, name: true, specialty: true, title: true } },
        },
      },
      careReferrals: {
        include: { doctor: true },
      },
      patientProfile: {
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, name: true, mrn: true, email: true } },
        },
      },
    },
  });

  // If session has no referrals yet, auto-suggest specialist matches
  if (triageSession && (!triageSession.careReferrals || triageSession.careReferrals.length === 0)) {
    try {
      const { suggestReferralsForAssessment } = await import('@/server/referrals/service');
      await suggestReferralsForAssessment(triageSession.id, triageSession.patientProfile.id);
      // Re-fetch careReferrals
      const updatedRefs = await prisma.careReferral.findMany({
        where: { triageSessionId: triageSession.id },
        include: { doctor: true },
      });
      (triageSession as Record<string, unknown>).careReferrals = updatedRefs;
    } catch {
      // Non-blocking fallback
    }
  }

  // Strict record ownership check
  if (triageSession && userSession.role === 'PATIENT') {
    if (triageSession.patientProfile.userId !== userSession.id) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-surface-container-lowest shadow-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-error-container text-error mx-auto flex items-center justify-center">
            <MaterialIcon name="shield" className="text-[32px]" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Access Denied</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            You do not have permission to view this clinical assessment record. You can only view assessments associated with your verified patient profile.
          </p>
          <div className="pt-4">
            <Link
              href="/assessments/history"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg"
            >
              <MaterialIcon name="arrow_back" className="text-[18px]" />
              <span>Back to Your Assessments</span>
            </Link>
          </div>
        </div>
      );
    }
  }

  const guidelines = await prisma.clinicalGuideline.findMany({
    take: 4,
    orderBy: { publicationYear: 'desc' },
  });

  const assessmentAudit = triageSession
    ? await prisma.auditLog.findFirst({
        where: {
          targetEntityType: 'TriageSession',
          targetEntityId: triageSession.id,
          actionType: { in: ['TRIAGE_CREATED', 'HIGH_RISK_ESCALATION'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { metadataJson: true },
      })
    : null;
  let aiExecution: { provider: string; modelName: string; providerStatus: string; fallbackReason?: string } | null = null;
  try {
    const metadata = JSON.parse(assessmentAudit?.metadataJson || '{}') as Record<string, unknown>;
    if (typeof metadata.provider === 'string' && typeof metadata.modelName === 'string') {
      aiExecution = {
        provider: metadata.provider,
        modelName: metadata.modelName,
        providerStatus: typeof metadata.providerStatus === 'string' ? metadata.providerStatus : 'UNKNOWN',
        ...(typeof metadata.fallbackReason === 'string' ? { fallbackReason: metadata.fallbackReason } : {}),
      };
    }
  } catch {
    // Keep the result view available if older audit metadata is malformed.
  }

  return (
    <AssessmentResultsView
      sessionCode={triageSession?.sessionCode || id}
      guidelines={guidelines}
      session={triageSession as unknown as TriageSessionRecord}
      aiExecution={aiExecution}
    />
  );
}
