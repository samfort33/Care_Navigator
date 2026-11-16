import React from 'react';
import Link from 'next/link';
import { MaterialIcon } from './MaterialIcon';
import { AcuityBadge } from './AcuityBadge';
import { ClinicalDisclaimerBanner } from './ClinicalDisclaimerBanner';
import { SeedFixtureBadge } from './SeedFixtureBadge';
import type { AcuityLevel } from '@/lib/design-tokens';

export interface ScreenFoundationCardProps {
  screenNumber: number;
  title: string;
  subtitle: string;
  designReferenceDir: string;
  routePath: string;
  milestoneTarget: string;
  acuityPreview?: AcuityLevel;
  isSeedFixture?: boolean;
  metrics?: { label: string; value: string; mono?: boolean }[];
  primaryAction?: { label: string; href: string; icon: string };
  secondaryAction?: { label: string; href: string; icon: string };
  children?: React.ReactNode;
}

/**
 * Reusable Milestone 1 Technical Foundation view card that binds live Prisma database records,
 * canonical M3 tokens, and navigation links across all 11 CareNavigator routes.
 */
export function ScreenFoundationCard({
  screenNumber,
  title,
  subtitle,
  designReferenceDir,
  routePath,
  milestoneTarget,
  acuityPreview,
  isSeedFixture = true,
  metrics = [],
  primaryAction,
  secondaryAction,
  children,
}: ScreenFoundationCardProps) {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 sm:p-8 shadow-ambient">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary-container px-3 py-1 font-mono text-xs font-bold text-on-secondary-container">
              Screen {screenNumber.toString().padStart(2, '0')} • {routePath}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1 font-mono text-xs font-medium text-on-surface-variant">
              {milestoneTarget}
            </span>
            <SeedFixtureBadge isSeedFixture={isSeedFixture} />
          </div>
          {acuityPreview && <AcuityBadge level={acuityPreview} />}
        </div>

        <h1 className="mt-4 text-headline-lg sm:text-headline-xl font-bold text-on-surface">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-body-lg text-on-surface-variant">{subtitle}</p>

        <div className="mt-3 flex items-center gap-2 font-mono text-xs text-on-surface-variant">
          <MaterialIcon name="palette" className="text-[16px] text-primary" />
          <span>Design Reference:</span>
          <code className="rounded bg-surface-container-low px-2 py-0.5 text-on-surface">
            design-reference:/{designReferenceDir}
          </code>
        </div>

        {metrics.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4"
              >
                <p className="text-body-sm uppercase tracking-wider text-on-surface-variant">
                  {m.label}
                </p>
                <p
                  className={`mt-1 text-lg font-bold text-on-surface ${
                    m.mono ? 'font-mono' : ''
                  }`}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {(primaryAction || secondaryAction) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-outline-variant/20">
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-xs font-bold text-on-primary shadow-sm transition hover:opacity-95"
              >
                <MaterialIcon name={primaryAction.icon} filled className="text-[18px]" />
                <span>{primaryAction.label}</span>
              </Link>
            )}
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container transition"
              >
                <MaterialIcon name={secondaryAction.icon} className="text-[18px] text-primary" />
                <span>{secondaryAction.label}</span>
              </Link>
            )}
          </div>
        )}
      </section>

      {children}

      <ClinicalDisclaimerBanner />
    </div>
  );
}
