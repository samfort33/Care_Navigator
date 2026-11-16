import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import {
  HealthProfileRecordsWorkspace,
  type ProfileSubTab,
  type LivePatientProfile,
} from '@/components/records/HealthProfileRecordsWorkspace';

export default async function PatientRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: session.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mrn: true,
          role: true,
        },
      },
      vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 10 },
      conditions: { orderBy: { diagnosedDate: 'desc' } },
      medications: true,
      allergies: true,
      prescriptions: { orderBy: { prescribedDate: 'desc' } },
      testReports: { orderBy: { reportedAt: 'desc' } },
      documents: { orderBy: { uploadedAt: 'desc' }, include: { biomarkers: true } },
    },
  });

  const resolved = await searchParams;
  const validTabs: ProfileSubTab[] = [
    'overview',
    'history',
    'prescriptions',
    'reports',
    'diagnoses',
    'documents',
  ];
  const initialSubTab: ProfileSubTab = validTabs.includes(resolved.tab as ProfileSubTab)
    ? (resolved.tab as ProfileSubTab)
    : 'documents';

  return (
    <HealthProfileRecordsWorkspace
      initialSubTab={initialSubTab}
      profile={profile as unknown as LivePatientProfile}
    />
  );
}
