import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CareNavigator — AI-Assisted Clinical Triage & Care Navigation',
  description:
    'HIPAA-conscious multimodal AI health assessment, deterministic safety guardrails, longitudinal medical records, and board-certified clinician care navigation.',
};

import { OfflineConnectivityDetector } from '@/components/ui/OfflineConnectivityDetector';
import { cookies } from 'next/headers';
import { LanguageProvider, type AppLanguage } from '@/lib/language';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLanguage: AppLanguage = cookieStore.get('cn_language')?.value === 'bn' ? 'bn' : 'en';

  return (
    <html lang={initialLanguage}>
      <body className="min-h-screen bg-surface text-on-surface font-sans antialiased">
        <LanguageProvider initialLanguage={initialLanguage}>
          <OfflineConnectivityDetector />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
