'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error digest without exposing raw PHI to console
    console.error('CareNavigator Workspace Error:', {
      name: error.name,
      digest: error.digest ?? 'no-digest',
    });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-acuity-urgent-border bg-surface-container-lowest p-8 shadow-ambient">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-acuity-urgent-bg text-acuity-urgent">
          <MaterialIcon name="error" filled className="text-2xl" />
        </div>
        <h1 className="mt-4 text-headline-md font-bold text-on-surface">
          Clinical Workspace Interrupted
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          We encountered a temporary problem loading this view. Your saved records remain encrypted
          and intact. If you are experiencing a medical emergency, please call <strong>999</strong>{' '}
          immediately.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm"
          >
            <MaterialIcon name="refresh" className="text-[16px]" />
            <span>Retry View</span>
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
          >
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
