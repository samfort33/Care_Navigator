'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CLINICAL_ADMIN_NAV_SECTIONS,
  CLINICIAN_NAV_SECTIONS,
  PATIENT_NAV_SECTIONS,
  type NavSection,
} from '@/lib/design-tokens';
import type { SessionUser } from '@/server/auth/session';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Emergency911Modal } from './Emergency911Modal';
import { UserAccountMenu } from './UserAccountMenu';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export interface WorkspaceShellProps {
  currentUser: SessionUser;
  unreadNotificationsCount: number;
  pendingReviewsCount: number;
  portalMode?: 'patient' | 'clinical';
  children: React.ReactNode;
}

/**
 * Canonical Workspace Shell (AGENTS.md Section 1.3 & 1.4).
 * Enforces:
 * - Fixed w-64 (256px) desktop sidebar + collapsible mobile/tablet drawer
 * - Fixed h-16 (64px) top header bar with glassmorphism (bg-white/80 backdrop-blur-md)
 * - Active sidebar item state: bg-secondary-container/60 text-primary font-semibold rounded-xl + filled Material Symbol
 */
export function WorkspaceShell({
  currentUser,
  unreadNotificationsCount,
  pendingReviewsCount,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navSections: NavSection[] = currentUser.role === 'ADMIN'
    ? CLINICAL_ADMIN_NAV_SECTIONS
    : currentUser.role === 'CLINICIAN'
      ? CLINICIAN_NAV_SECTIONS
      : PATIENT_NAV_SECTIONS;

  function isRouteActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function getBadgeValue(badgeKey?: 'unreadNotifications' | 'pendingReviews'): number {
    if (badgeKey === 'unreadNotifications') return unreadNotificationsCount;
    if (badgeKey === 'pendingReviews') return pendingReviewsCount;
    return 0;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-surface-container-low px-4 py-5">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pb-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-on-primary shadow-sm">
              <MaterialIcon name="health_and_safety" filled className="text-[22px]" />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-on-surface">
                CareNavigator
              </span>
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                Clinical Clarity
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container lg:hidden"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav aria-label="Workspace Navigation" className="space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t(section.title)}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isRouteActive(item.href);
                  const badgeCount = getBadgeValue(item.badgeKey);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-colors',
                          active
                            ? 'bg-secondary-container/60 text-primary font-semibold border-l-4 border-primary'
                            : 'text-on-surface-variant font-medium hover:bg-surface-container hover:text-on-surface'
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <MaterialIcon
                            name={item.icon}
                            filled={active}
                            className={cn(
                              'text-[20px]',
                              active ? 'text-primary' : 'text-on-surface-variant'
                            )}
                          />
                          <span>{t(item.label)}</span>
                        </span>
                        {badgeCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[11px] font-bold text-on-primary">
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Primary CTA & 999 Escalation */}
      <div className="space-y-2.5 pt-4 border-t border-outline-variant/25">
        <Link
          href="/assessments/new"
          onClick={() => setMobileDrawerOpen(false)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-gradient px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition hover:opacity-95"
        >
          <MaterialIcon name="add_circle" filled className="text-[18px]" />
          <span>{t('New AI Assessment')}</span>
        </Link>
        <Emergency911Modal variant="sidebar-block" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-surface text-on-surface flex">
      {/* Desktop Persistent w-64 Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 border-r border-outline-variant/25">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 shadow-ambient-lg">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0 w-full max-w-full overflow-x-hidden">
        {/* Sticky h-16 Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 sm:gap-4 border-b border-outline-variant/25 bg-white/80 px-3 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl p-2 text-on-surface hover:bg-surface-container lg:hidden shrink-0"
            >
              <MaterialIcon name="menu" />
            </button>

            {/* Quick Navigation / Search Link */}
            <Link
              href="/care-directory"
              className="hidden md:flex items-center gap-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low px-3.5 py-1.5 text-xs text-on-surface-variant hover:border-primary/40 transition w-72"
            >
              <MaterialIcon name="search" className="text-[18px] text-on-surface-variant" />
              <span>Search specialists, labs, or guidelines...</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Emergency911Modal variant="header-pill" />
            <LanguageSwitcher />

            <Link
              href="/notifications"
              aria-label={`Notifications (${unreadNotificationsCount} unread)`}
              className="relative rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition"
            >
              <MaterialIcon name="notifications" className="text-[20px]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] font-bold text-on-error">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            <UserAccountMenu currentUser={currentUser} />
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1440px] w-full mx-auto min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
