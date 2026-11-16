import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import {
  AssessmentHistoryTracker,
  type LiveHistorySessionRecord,
} from '@/components/triage/AssessmentHistoryTracker';

export default async function AssessmentHistoryPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: session.id },
  });

  let triageSessions: LiveHistorySessionRecord[] = [];
  if (profile) {
    triageSessions = await prisma.triageSession.findMany({
      where: { patientProfileId: profile.id },
      include: {
        clinicianReview: {
          include: {
            clinician: { select: { id: true, name: true, specialty: true, title: true } },
          },
        },
        citations: { include: { guideline: true } },
        answers: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return (
    <AssessmentHistoryTracker
      userRole={session.role}
      liveSessions={triageSessions}
    />
  );
}
