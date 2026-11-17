import React from 'react';
import { getServerSession } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { redirect } from 'next/navigation';

export default async function PatientWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession({ strictCookieOnly: true });
  if (!session) redirect('/login');
  if (session.role !== 'PATIENT') {
    redirect(session.role === 'ADMIN' ? '/admin/impact' : '/assessments/history');
  }

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
