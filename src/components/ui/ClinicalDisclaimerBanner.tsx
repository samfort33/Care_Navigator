import React from 'react';
import { MaterialIcon } from './MaterialIcon';
import { cn } from '@/lib/utils';

export interface ClinicalDisclaimerBannerProps {
  compact?: boolean;
  className?: string;
}

/**
 * Mandatory Non-Diagnostic Clinical Decision Support Disclaimer (AGENTS.md Section 4.2).
 * Frames all AI outputs as preliminary considerations requiring clinician review.
 */
export function ClinicalDisclaimerBanner({
  compact = false,
  className,
}: ClinicalDisclaimerBannerProps) {
  return (
    <div
      role="note"
      aria-label="Clinical Decision Support Disclaimer"
      className={cn(
        'rounded-xl border border-secondary/20 bg-surface-container-low text-on-surface-variant',
        compact ? 'px-3.5 py-2.5 text-xs' : 'p-4 text-sm',
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <MaterialIcon
          name="verified_user"
          filled
          className="mt-0.5 shrink-0 text-secondary text-[18px]"
        />
        <p className="leading-relaxed">
          <strong className="font-semibold text-on-surface">
            Clinical Decision Support Notice:
          </strong>{' '}
          CareNavigator outputs represent non-diagnostic clinical considerations and preliminary
          acuity signals for clinician review. They do not constitute a confirmed medical diagnosis.
          If you experience life-threatening symptoms, call <strong>999</strong> immediately.
        </p>
      </div>
    </div>
  );
}
