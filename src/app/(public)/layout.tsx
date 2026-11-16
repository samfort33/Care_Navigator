import React from 'react';
import { getServerSession, DEMO_PERSONAS } from '@/server/auth/session';
import { PublicHeaderFooter } from '@/components/layout/PublicHeaderFooter';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await getServerSession()) ?? DEMO_PERSONAS.PATIENT;
  return <PublicHeaderFooter currentUser={session}>{children}</PublicHeaderFooter>;
}
