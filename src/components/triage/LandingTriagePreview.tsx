'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface PreviewScenario {
  id: string;
  stepLabel: string;
  progress: number;
  query: string;
  urgencyBadge: string;
  urgencyStyle: string;
  protocolCode: string;
  redFlagsText: string;
  pathwayText: string;
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: 'neuro',
    stepLabel: 'Step 3 of 4',
    progress: 75,
    query:
      '"I\'ve had a persistent throbbing headache behind my right eye for 6 hours, accompanied by mild sensitivity to bright room lights, no fever or neck stiffness."',
    urgencyBadge: 'MODERATE URGENCY',
    urgencyStyle: 'bg-secondary-container text-on-secondary-container',
    protocolCode: 'Protocol: Neuro-Cef-204',
    redFlagsText: 'No thunderclap onset, focal deficit, or meningeal signs.',
    pathwayText: 'Outpatient Telehealth or Primary Care within 24 hrs.',
  },
  {
    id: 'resp',
    stepLabel: 'Step 2 of 4',
    progress: 50,
    query:
      '"Dry non-productive cough for 4 days with mild sore throat and fatigue. Resting SpO2 is 98% on home pulse oximeter, no shortness of breath at rest."',
    urgencyBadge: 'ROUTINE CARE',
    urgencyStyle: 'bg-primary-fixed text-on-primary-fixed',
    protocolCode: 'Protocol: CDS-RESP-04',
    redFlagsText: 'No hypoxia, stridor, hemoptysis, or rest dyspnea.',
    pathwayText: 'Outpatient evaluation within 24–48 hrs & supportive monitoring.',
  },
  {
    id: 'cardio-redflag',
    stepLabel: 'Step 1 of 4 (Escalated)',
    progress: 100,
    query:
      '"Sudden crushing pressure in the center of my chest radiating to my left jaw and arm, started 15 minutes ago with cold sweats."',
    urgencyBadge: 'EMERGENCY — IMMEDIATE HELP',
    urgencyStyle: 'bg-error-container text-on-error-container',
    protocolCode: 'Protocol: RF-CARDIO-ACS-01',
    redFlagsText: 'CRITICAL RED FLAG: Acute coronary syndrome pattern detected.',
    pathwayText: 'Contact your local emergency service now. Do not wait for an online review.',
  },
];

export function LandingTriagePreview() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const active = PREVIEW_SCENARIOS[selectedIdx] ?? PREVIEW_SCENARIOS[0]!;

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient border border-outline-variant/20 relative">
      {/* Top Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-surface-container">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Interactive Triage Preview
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
          Sample Clinical Workflow
        </span>
      </div>

      {/* Scenario Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Sample clinical scenarios"
        className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-surface-container-low p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedIdx === 0}
          onClick={() => setSelectedIdx(0)}
          className={`h-8 rounded-lg px-2 text-xs font-semibold transition-all ${
            selectedIdx === 0
              ? 'bg-surface-container-lowest text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Neurology Case
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedIdx === 1}
          onClick={() => setSelectedIdx(1)}
          className={`h-8 rounded-lg px-2 text-xs font-semibold transition-all ${
            selectedIdx === 1
              ? 'bg-surface-container-lowest text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Respiratory Case
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedIdx === 2}
          onClick={() => setSelectedIdx(2)}
          className={`h-8 rounded-lg px-2 text-xs font-semibold transition-all ${
            selectedIdx === 2
              ? 'bg-error text-on-error shadow-xs'
              : 'text-on-surface-variant hover:text-error'
          }`}
        >
          Emergency Red-Flag
        </button>
      </div>

      {/* Progress Stepper Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant mb-2">
          <span>{active.stepLabel}</span>
          <span className="text-primary font-semibold">
            Symptom Analysis &amp; Acuity Stratification
          </span>
        </div>
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              selectedIdx === 2 ? 'bg-error' : 'bg-primary'
            }`}
            style={{ width: `${active.progress}%` }}
          />
        </div>
      </div>

      {/* Simulated Input Query */}
      <div className="bg-surface-container-low rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Patient Input (Simulated)
          </span>
          <span className="font-label-sm text-label-sm text-secondary flex items-center gap-1">
            <MaterialIcon name="mic" className="text-[14px]" />
            Voice / Text Parsed
          </span>
        </div>
        <p className="font-body-md text-body-md text-on-surface italic">{active.query}</p>
      </div>

      {/* Simulated Engine Output */}
      <div className="bg-surface-container/60 rounded-xl p-4 mb-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${active.urgencyStyle}`}
          >
            <MaterialIcon
              name={selectedIdx === 2 ? 'emergency' : 'priority_high'}
              className="text-[14px]"
            />
            {active.urgencyBadge}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
            {active.protocolCode}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="bg-surface-container-lowest p-3 rounded-lg">
            <div className="flex items-center gap-1.5 text-primary font-label-md text-label-md mb-1">
              <MaterialIcon
                name={selectedIdx === 2 ? 'warning' : 'check_circle'}
                className={`text-[16px] ${selectedIdx === 2 ? 'text-error' : 'text-primary'}`}
              />
              <span>
                {selectedIdx === 2 ? 'Red Flag Triggered (1/4)' : 'Red Flags Excluded (0/4)'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {active.redFlagsText}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-lg">
            <div className="flex items-center gap-1.5 text-secondary font-label-md text-label-md mb-1">
              <MaterialIcon name="route" className="text-[16px]" />
              <span>Recommended Care Pathway</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {active.pathwayText}
            </p>
          </div>
        </div>

        {showCriteriaModal && (
          <div className="rounded-lg bg-surface-container-lowest p-3 border border-primary/25 text-xs text-on-surface-variant space-y-1">
            <div className="flex items-center justify-between font-semibold text-on-surface">
              <span>Deterministic Rule &amp; Guideline Criteria ({active.protocolCode})</span>
              <button
                type="button"
                onClick={() => setShowCriteriaModal(false)}
                className="text-primary hover:underline"
              >
                Hide
              </button>
            </div>
            <p>
              Evaluates onset velocity, neurological/autonomic red flags, and vital stability
              thresholds prior to LLM contextual synthesis. Non-diagnostic clinical decision support.
            </p>
          </div>
        )}
      </div>

      {/* Preview Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setShowCriteriaModal((prev) => !prev)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors"
        >
          <MaterialIcon name="visibility" className="text-[16px]" />
          <span>{showCriteriaModal ? 'Hide Triage Criteria' : 'View Triage Criteria'}</span>
        </button>
        <Link
          href="/assessments/new"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors"
        >
          <span>Launch Live Workspace</span>
          <MaterialIcon name="open_in_new" className="text-[16px]" />
        </Link>
      </div>
    </div>
  );
}
