import React from 'react';
import { prisma } from '@/lib/prisma';
import { AdminImpactDashboardView } from '@/components/admin/AdminImpactDashboardView';

export default async function AdminImpactDashboardPage() {
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
