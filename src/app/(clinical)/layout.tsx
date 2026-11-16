import React from 'react';
import { getServerSession, DEMO_PERSONAS } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';

export default async function ClinicalPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rawSession = await getServerSession();
  const session =
    rawSession && (rawSession.role === 'CLINICIAN' || rawSession.role === 'ADMIN')
      ? rawSession
      : DEMO_PERSONAS.ADMIN;

  const [unreadNotificationsCount, pendingReviewsCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: DEMO_PERSONAS.PATIENT.id, isRead: false, isDismissed: false },
    }),
    prisma.triageSession.count({
      where: { status: 'PENDING_REVIEW' },
    }),
  ]);

  return (
    <WorkspaceShell
      currentUser={session}
      unreadNotificationsCount={unreadNotificationsCount}
      pendingReviewsCount={pendingReviewsCount}
      portalMode="clinical"
    >
      {children}
    </WorkspaceShell>
  );
}
