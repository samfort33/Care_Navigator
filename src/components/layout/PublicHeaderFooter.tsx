'use client';

import React from 'react';
import Link from 'next/link';
import type { SessionUser } from '@/server/auth/session';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Emergency911Modal } from './Emergency911Modal';
import { UserAccountMenu } from './UserAccountMenu';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useLanguage } from '@/lib/language';

export interface PublicHeaderFooterProps {
  currentUser: SessionUser | null;
  children: React.ReactNode;
}

export function PublicHeaderFooter({ currentUser, children }: PublicHeaderFooterProps) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex flex-col overflow-x-clip bg-surface-bright text-on-surface">
      {/* Sticky Top Navbar */}
      <header
        data-purpose="global-header"
        className="sticky top-0 z-30 border-b border-outline-variant/25 bg-white/85 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-on-primary shadow-sm">
                <MaterialIcon name="health_and_safety" filled className="text-[22px]" />
              </div>
              <div>
                <span className="block text-base font-extrabold tracking-tight text-on-surface">
                  CareNavigator
                </span>
                <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {t('Clinical Clarity')}
                </span>
              </div>
            </Link>

            <details className="relative shrink-0">
              <summary aria-label="Open navigation menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-primary hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <MaterialIcon name="menu" className="text-[22px]" />
              </summary>
              <nav aria-label="Mobile Navigation" className="absolute left-0 top-full z-40 mt-2 grid w-64 gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2 shadow-ambient-lg sm:left-auto sm:right-0">
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low">{t('Patient Dashboard')}</Link>
                <Link href="/assessments/new" className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low">{t('AI Symptom Triage')}</Link>
                <Link href="/care-directory" className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low">{t('Find Specialists')}</Link>
                <Link href="/records" className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low">{t('Health Vault')}</Link>
                <Link href="/admin/impact" className="rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low">{t('Clinical Impact')}</Link>
                <Link href="/login" className="mt-1 border-t border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container-low">{t('Sign In')}</Link>
              </nav>
            </details>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <div className="hidden lg:block">
              <Emergency911Modal variant="header-pill" />
            </div>
            {currentUser ? (
              <UserAccountMenu currentUser={currentUser} />
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low">{t('Sign In')}</Link>
                <Link href="/register" className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary hover:bg-primary-container">{t('Create Account')}</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/25 bg-surface-container-low pt-12 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-gradient text-on-primary">
                  <MaterialIcon name="health_and_safety" filled className="text-[18px]" />
                </div>
                <span className="text-base font-extrabold text-on-surface">CareNavigator</span>
              </div>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                {t('Clinical decision support for clearer intake, transparent next steps, and clinician review.')}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                {t('Patient Workspace')}
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-on-surface-variant">
                <li>
                  <Link href="/dashboard" className="hover:text-primary">
                    {t('Patient Dashboard')}
                  </Link>
                </li>
                <li>
                  <Link href="/assessments/new" className="hover:text-primary">
                    {t('AI Triage Workspace')}
                  </Link>
                </li>
                <li>
                  <Link href="/assessments/media-voice" className="hover:text-primary">
                    {t('Media & Voice Intake')}
                  </Link>
                </li>
                <li>
                  <Link href="/records" className="hover:text-primary">
                    {t('Health Profile & Lab Vault')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                {t('Clinical Verification')}
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-on-surface-variant">
                <li>
                  <Link href="/assessments/CN-2026-8841/results" className="hover:text-primary">
                    {t('Clinical Assessment Results')}
                  </Link>
                </li>
                <li>
                  <Link href="/assessments/history" className="hover:text-primary">
                    {t('Clinician Review Tracker')}
                  </Link>
                </li>
                <li>
                  <Link href="/care-directory" className="hover:text-primary">
                    {t('Specialist & Care Directory')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                {t('Governance & Trust')}
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-on-surface-variant">
                <li>
                  <Link href="/settings/privacy" className="hover:text-primary">
                    {t('Privacy & Consent Settings')}
                  </Link>
                </li>
                <li>
                  <Link href="/notifications" className="hover:text-primary">
                    {t('Notification Center')}
                  </Link>
                </li>
                <li>
                  <Link href="/admin/impact" className="hover:text-primary">
                    {t('CMO Impact & Audit Telemetry')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-outline-variant/25 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
            <p>© 2026 CareNavigator Clinical Systems. Non-Diagnostic Decision Support Platform.</p>
            <p className="font-mono text-[11px]">
              Emergency Protocol: Contact your local emergency service immediately for life-threatening symptoms.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
