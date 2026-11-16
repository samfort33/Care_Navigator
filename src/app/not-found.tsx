import React from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function NotFound() {
  return (
    <div className="flex min-h-[75vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-ambient text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container text-secondary">
          <MaterialIcon name="find_in_page" filled className="text-2xl" />
        </div>
        <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
          404 • Route Not Found
        </p>
        <h1 className="mt-1 text-headline-md font-bold text-on-surface">
          Clinical View Unavailable
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          The page or clinical record you requested could not be found. Use the links below to
          return to your CareNavigator workspace.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm"
          >
            <MaterialIcon name="dashboard" className="text-[16px]" />
            <span>Patient Dashboard</span>
          </Link>
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
          >
            <MaterialIcon name="vital_signs" className="text-[16px]" />
            <span>Start AI Triage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
