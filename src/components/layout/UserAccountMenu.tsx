'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/server/auth/session';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useLanguage } from '@/lib/language';

export function UserAccountMenu({ currentUser }: { currentUser: SessionUser }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initials = currentUser.name
    .replace(/^Dr\.\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-white px-2.5 py-1.5 text-left hover:bg-surface-container-low"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{initials}</span>
        <span className="hidden max-w-36 sm:block">
          <span className="block truncate text-xs font-semibold text-on-surface">{currentUser.name}</span>
          <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant">{t(currentUser.role)}</span>
        </span>
        <MaterialIcon name="expand_more" className="text-lg text-on-surface-variant" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-outline-variant/40 bg-white p-2 shadow-ambient-lg">
          <p className="truncate px-3 py-2 text-xs text-on-surface-variant">{currentUser.email}</p>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-error hover:bg-error-container/40 disabled:opacity-60"
          >
            <MaterialIcon name="logout" className="text-lg" />
            {busy ? t('Signing out...') : t('Sign Out')}
          </button>
        </div>
      )}
    </div>
  );
}
