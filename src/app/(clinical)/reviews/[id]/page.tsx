import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from '@/server/auth/session';
import { getReviewDossier } from '@/server/reviews/service';
import {
  ClinicianReviewDossierWorkspace,
  type ReviewDossierData,
} from '@/components/clinical/ClinicianReviewDossierWorkspace';

export default async function ClinicianReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Server-side RBAC guard: Clinician or Admin only
  if (session.role !== 'CLINICIAN' && session.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const { id } = await params;
  const dossier = await getReviewDossier(id);

  if (!dossier) {
    notFound();
  }

  return <ClinicianReviewDossierWorkspace dossier={dossier as unknown as ReviewDossierData} />;
}
