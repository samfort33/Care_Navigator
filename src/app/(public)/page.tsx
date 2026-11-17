import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/auth/session';

export default async function HomePage() {
  const user = await getServerSession({ strictCookieOnly: true });
  if (!user) redirect('/login');

  if (user.role === 'ADMIN') redirect('/admin/impact');
  if (user.role === 'CLINICIAN') redirect('/assessments/history');
  redirect('/dashboard');
}
