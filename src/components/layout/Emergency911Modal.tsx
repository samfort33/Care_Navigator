'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useLanguage } from '@/lib/language';

export interface Emergency911ModalProps {
  variant?: 'header-pill' | 'sidebar-block';
}

/**
 * High-contrast emergency escalation guidance for users in different regions.
 */
export function Emergency911Modal({ variant = 'header-pill' }: Emergency911ModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {variant === 'header-pill' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-acuity-emergency-border bg-acuity-emergency-bg px-3.5 py-1.5 text-xs font-bold text-acuity-emergency-text transition hover:bg-error hover:text-on-error focus:outline-none focus:ring-2 focus:ring-error/40"
        >
          <MaterialIcon name="emergency" filled className="text-[16px]" />
          <span>{t('Emergency Help')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-acuity-emergency-border bg-acuity-emergency-bg px-4 py-2.5 text-xs font-bold text-acuity-emergency-text transition hover:bg-error hover:text-on-error"
        >
          <MaterialIcon name="e911_emergency" filled className="text-[18px]" />
          <span>{t('Emergency Help')}</span>
        </button>
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-on-surface/60 p-4 backdrop-blur-sm"
        >
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border-2 border-acuity-emergency-border bg-surface-container-lowest p-6 shadow-ambient-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-acuity-emergency-bg text-error">
                  <MaterialIcon name="emergency" filled className="text-2xl" />
                </div>
                <div>
                  <span className="inline-block rounded-full bg-acuity-emergency-bg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-acuity-emergency-text">
                    {t('Immediate Emergency Guidance')}
                  </span>
                  <h2
                    id="emergency-modal-title"
                    className="mt-1 text-headline-md font-bold text-on-surface"
                  >
                    {t('Contact Local Emergency Services')}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close emergency modal"
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-acuity-emergency-border bg-acuity-emergency-bg/50 p-4 text-sm text-acuity-emergency-text">
              <p className="font-semibold">
                {t('If you are in Bangladesh and experiencing any of the following red-flag symptoms, do not wait for an online clinician review. Call 999 or go to the nearest emergency department now.')}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
                <li>{t('Crushing chest pain, pressure, or pain radiating to the left arm, back, or jaw')}</li>
                <li>{t('Severe shortness of breath at rest, gasping for air, or bluish lips/face')}</li>
                <li>{t('Sudden facial droop, arm weakness, slurred speech (FAST stroke signs)')}</li>
                <li>{t('Throat/tongue swelling, severe allergic anaphylaxis, or uncontrolled bleeding')}</li>
                <li>{t('Thoughts of self-harm or an acute psychiatric crisis')}</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 rounded-xl bg-surface-container px-5 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
              >
                {t('Close guidance')}
              </button>
              <a
                href="tel:999"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-error px-5 py-2.5 text-sm font-bold text-on-error transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                aria-label="Call Bangladesh emergency services on 999"
              >
                <MaterialIcon name="call" className="text-[18px]" />
                {t('Call 999')}
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
