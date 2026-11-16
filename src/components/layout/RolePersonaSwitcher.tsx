'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/server/auth/session';
import type { UserRole } from '@/lib/design-tokens';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';

export interface RolePersonaSwitcherProps {
  currentUser: SessionUser;
}

const ROLE_OPTIONS: {
  role: UserRole;
  label: string;
  name: string;
  subtitle: string;
  icon: string;
  defaultRoute: string;
}[] = [
  {
    role: 'PATIENT',
    label: 'Patient View',
    name: 'Nusrat Jahan',
    subtitle: 'MRN: #CN-84920',
    icon: 'person',
    defaultRoute: '/dashboard',
  },
  {
    role: 'CLINICIAN',
    label: 'Clinician Reviewer',
    name: 'Dr. Ayesha Rahman, MBBS, FCPS',
    subtitle: 'Internal Medicine & Pulmonology',
    icon: 'medical_information',
    defaultRoute: '/reviews',
  },
  {
    role: 'ADMIN',
    label: 'CMO Admin Portal',
    name: 'Dr. Farhan Ahmed, MBBS, MPH',
    subtitle: 'Chief Medical Officer',
    icon: 'admin_panel_settings',
    defaultRoute: '/admin/impact',
  },
];

/**
 * Role-Consistent Header Persona & Demo Role Switcher (AGENTS.md Section 1.3 & PROJECT_PLAN.md 4.4).
 * Ensures patient screens display the active Patient persona while enabling instant RBAC role testing.
 */
export function RolePersonaSwitcher({ currentUser }: RolePersonaSwitcherProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);

  async function handleSelectRole(role: UserRole, defaultRoute: string) {
    try {
      setLoadingRole(role);
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        setOpen(false);
        if (role === 'ADMIN') {
          router.push(defaultRoute);
        }
        router.refresh();
      }
    } finally {
      setLoadingRole(null);
    }
  }

  const initials = currentUser.name
    .replace(/^Dr\.\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex shrink-0 items-center gap-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-left transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-gradient text-xs font-bold text-on-primary">
          {initials}
        </div>
        <div className="hidden xl:block">
          <div className="flex items-center gap-1.5">
            <span className="max-w-[150px] text-xs font-bold leading-tight text-on-surface line-clamp-2">{t(currentUser.name)}</span>
            <span className="rounded-full bg-secondary-container px-2 py-0.5 font-mono text-[10px] font-semibold text-on-secondary-container">
              {currentUser.role}
            </span>
          </div>
          <p className="font-mono text-[11px] text-on-surface-variant">
            {t(currentUser.mrn ?? currentUser.title ?? '')}
          </p>
        </div>
        <MaterialIcon name="expand_more" className="text-[18px] text-on-surface-variant" />
      </button>

      {open && (
        <div
          role="menu"
            aria-label={t('Switch Active Clinical Persona')}
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-2 shadow-ambient-lg z-50"
        >
          <div className="px-3 py-2 border-b border-outline-variant/25">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {t('Active Session Persona (RBAC)')}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {t('Switch roles to test Patient, Clinician, and Admin permissions.')}
            </p>
          </div>
          <div className="mt-1 space-y-1">
            {ROLE_OPTIONS.map((option) => {
              const isSelected = currentUser.role === option.role;
              const isSwitching = loadingRole === option.role;
              return (
                <button
                  key={option.role}
                  type="button"
                  role="menuitem"
                  disabled={isSwitching}
                  onClick={() => handleSelectRole(option.role, option.defaultRoute)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition',
                    isSelected
                      ? 'bg-secondary-container/60 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-container-low'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <MaterialIcon
                      name={option.icon}
                      filled={isSelected}
                      className={cn('text-[20px]', isSelected ? 'text-primary' : 'text-on-surface-variant')}
                    />
                    <div>
                      <div className="text-xs font-bold leading-snug">{t(option.name)}</div>
                      <div className="text-[11px] text-on-surface-variant">
                        {t(option.label)} • {t(option.subtitle)}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <MaterialIcon name="check_circle" filled className="text-[18px] text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
