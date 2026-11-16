import React from 'react';
import { DoctorDirectoryWorkspace } from '@/components/directory/DoctorDirectoryWorkspace';

export default async function CareDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ specialty?: string }>;
}) {
  const resolved = await searchParams;
  return <DoctorDirectoryWorkspace initialSpecialty={resolved.specialty ?? ''} />;
}
