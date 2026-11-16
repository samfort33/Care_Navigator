import React from 'react';

export default function GlobalLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-ambient">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-container-highest" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 animate-pulse rounded bg-surface-container-highest" />
            <div className="h-3 w-32 animate-pulse rounded bg-surface-container-high" />
          </div>
        </div>
        <div className="h-24 w-full animate-pulse rounded-xl bg-surface-container-low" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-16 animate-pulse rounded-xl bg-surface-container-high" />
          <div className="h-16 animate-pulse rounded-xl bg-surface-container-high" />
          <div className="h-16 animate-pulse rounded-xl bg-surface-container-high" />
        </div>
      </div>
      <span className="sr-only">Loading clinical workspace...</span>
    </div>
  );
}
