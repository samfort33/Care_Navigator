import React from 'react';
import { CANONICAL_COLORS, type AcuityLevel } from '@/lib/design-tokens';
import { MaterialIcon } from './MaterialIcon';
import { cn } from '@/lib/utils';

export interface AcuityBadgeProps {
  level: AcuityLevel;
  customLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const ACUITY_STYLE_MAP: Record<AcuityLevel, string> = {
  SELF_CARE: 'bg-acuity-selfcare-bg text-acuity-selfcare-text border-acuity-selfcare-border',
  ROUTINE: 'bg-acuity-routine-bg text-acuity-routine-text border-acuity-routine-border',
  URGENT: 'bg-acuity-urgent-bg text-acuity-urgent-text border-acuity-urgent-border',
  EMERGENCY: 'bg-acuity-emergency-bg text-acuity-emergency-text border-acuity-emergency-border',
};

/**
 * Semantic Clinical Acuity Badge (AGENTS.md Section 1.2).
 * Uses canonical acuity tokens so clinical severity never depends on ambiguous secondary/tertiary tokens.
 */
export function AcuityBadge({ level, customLabel, size = 'md', className }: AcuityBadgeProps) {
  const token = CANONICAL_COLORS.acuity[level] ?? CANONICAL_COLORS.acuity.ROUTINE;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-tight',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs',
        ACUITY_STYLE_MAP[level],
        className
      )}
    >
      <MaterialIcon name={token.icon} filled className="text-[15px]" />
      <span>{customLabel ?? token.label}</span>
    </span>
  );
}
