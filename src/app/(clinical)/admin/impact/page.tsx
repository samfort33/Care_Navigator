import React from 'react';
import { prisma } from '@/lib/prisma';
import { AdminImpactDashboardView } from '@/components/admin/AdminImpactDashboardView';
import { getServerSession } from '@/server/auth/session';
import { redirect } from 'next/navigation';

export default async function AdminImpactDashboardPage() {
  const session = await getServerSession({ strictCookieOnly: true });
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') {
    redirect(session.role === 'PATIENT' ? '/dashboard' : '/assessments/history');
  }

  const [sessionsCount, completedReviewsCount, guidelinesCount, auditLogsCount] =
    await Promise.all([
      prisma.triageSession.count(),
      prisma.clinicianReview.count({ where: { stage: 'SIGNED' } }),
      prisma.clinicalGuideline.count(),
      prisma.auditLog.count(),
    ]);

  return (
    <AdminImpactDashboardView
      telemetry={{
        sessionsCount,
        completedReviewsCount,
        guidelinesCount,
        auditLogsCount,
      }}
    />
  );
}
