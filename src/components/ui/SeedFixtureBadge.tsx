import React from 'react';
import { MaterialIcon } from './MaterialIcon';
import { cn } from '@/lib/utils';

export interface SeedFixtureBadgeProps {
  isSeedFixture: boolean;
  className?: string;
}

/**
 * Explicitly distinguishes seeded development/demo fixtures from live user-created records
 * per AGENTS.md Rule 3.2.
 */
export function SeedFixtureBadge({ isSeedFixture, className }: SeedFixtureBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium border',
        isSeedFixture
          ? 'bg-surface-container text-on-surface-variant border-outline-variant/40'
          : 'bg-primary-fixed/40 text-on-primary-fixed border-primary/20',
        className
      )}
      title={
        isSeedFixture
          ? 'Seeded clinical fixture (isSeedFixture: true)'
          : 'Live user-generated database record'
      }
    >
      <MaterialIcon
        name={isSeedFixture ? 'science' : 'cloud_done'}
        className="text-[13px]"
      />
      <span>{isSeedFixture ? 'Seed Fixture' : 'Live Record'}</span>
    </span>
  );
}
