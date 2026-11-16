import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/auth/session';
import { ClinicianReviewQueueWorkspace } from '@/components/clinical/ClinicianReviewQueueWorkspace';

export default async function ClinicianReviewsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Server-side RBAC guard: Clinician or Admin only
  if (session.role !== 'CLINICIAN' && session.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <ClinicianReviewQueueWorkspace />;
}
