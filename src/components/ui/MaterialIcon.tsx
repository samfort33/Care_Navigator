import React from 'react';
import { cn } from '@/lib/utils';

export interface MaterialIconProps {
  name: string;
  filled?: boolean;
  className?: string;
  ariaHidden?: boolean;
}

/**
 * Canonical Material Symbols Outlined icon component (AGENTS.md Section 1.3).
 * Preserves consistent icon identity and filled active-state variation settings.
 */
export function MaterialIcon({
  name,
  filled = false,
  className,
  ariaHidden = true,
}: MaterialIconProps) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn(
        'material-symbols-outlined select-none inline-flex items-center justify-center leading-none',
        className
      )}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
