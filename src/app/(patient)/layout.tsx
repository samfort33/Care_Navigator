import React from 'react';
import { getServerSession, DEMO_PERSONAS } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';

export default async function PatientWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await getServerSession()) ?? DEMO_PERSONAS.PATIENT;

  const [unreadNotificationsCount, pendingReviewsCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.id, isRead: false, isDismissed: false },
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
      portalMode="patient"
    >
      {children}
    </WorkspaceShell>
  );
}
