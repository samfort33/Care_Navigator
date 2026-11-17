import React from 'react';
import { getServerSession } from '@/server/auth/session';
import { PublicHeaderFooter } from '@/components/layout/PublicHeaderFooter';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession({ strictCookieOnly: true });
  return <PublicHeaderFooter currentUser={session}>{children}</PublicHeaderFooter>;
}
