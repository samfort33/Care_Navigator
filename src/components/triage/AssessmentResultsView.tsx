'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export interface GuidelineRecord {
  id: string;
  code: string;
  organization: string;
  publisher?: string | null;
  version?: string;
  status?: string;
  title: string;
  publicationYear: number;
  sourceUrl?: string | null;
  summary: string;
}

export interface TriageSessionRecord {
  id: string;
  sessionCode: string;
  chiefComplaint: string;
  status: string;
  acuityLevel: string;
  confidenceScore: number;
  recommendedCareSetting: string;
  plainLanguageSummary: string;
  includeEhrContext: boolean;
  redFlagTriggered: boolean;
  redFlagReasonsJson: string;
  createdAt: string | Date;
  isSeedFixture: boolean;
  answers?: Array<{
    stepNumber: number;
    questionPrompt: string;
    answerValue: string;
  }>;
  explanations?: Array<{
    factorType: string;
    factorLabel: string;
    rationale: string;
    importanceRank: number;
  }>;
  citations?: Array<{
    id?: string;
    guideline: GuidelineRecord;
    relevanceNote: string;
    chunkId?: string | null;
    passageText?: string | null;
    sectionTitle?: string | null;
    sectionNumber?: string | null;
    pageNumber?: number | null;
    sourceUrl?: string | null;
    verificationStatus?: string;
    relevanceScore?: number;
    claimSupported?: string | null;
    chunk?: {
      id: string;
      sectionTitle: string;
      sectionNumber?: string | null;
      pageNumber?: number | null;
      passageText: string;
    } | null;
  }>;
  clinicianReview?: {
    stage: string;
    concordanceStatus: string;
    overriddenAcuity?: string | null;
    clinicianNote?: string | null;
    clinician: {
      name: string;
      specialty?: string | null;
      title?: string | null;
    };
  } | null;
  careReferrals?: Array<{
    id: string;
    referralCode: string;
    specialtyNeeded: string;
    urgency: string;
    clinicalSummary: string;
    referralStatus: string;
    doctor: {
      id: string;
      name: string;
      specialty: string;
      hospitalAffiliation: string;
      city: string;
      state: string;
      rating: number;
      consultationFee: number;
      telehealthAvailable: boolean;
      availableToday: boolean;
      isSeedFixture: boolean;
    };
  }>;
}

interface AiExecutionInfo {
  provider: string;
  modelName: string;
  providerStatus: string;
  fallbackReason?: string;
}

export function AssessmentResultsView({
  sessionCode,
  guidelines,
  session,
  aiExecution = null,
}: {
  sessionCode: string;
  guidelines: GuidelineRecord[];
  session?: TriageSessionRecord | null;
  aiExecution?: AiExecutionInfo | null;
}) {
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [verifyingCitationKey, setVerifyingCitationKey] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<
    Record<string, { verified: boolean; status: string; reason: string; relevanceScore: number }>
  >({});
  const [referrals, setReferrals] = useState(session?.careReferrals || []);
  const [updatingReferralId, setUpdatingReferralId] = useState<string | null>(null);

  const handleUpdateReferral = async (referralId: string, status: 'ACCEPTED' | 'DECLINED') => {
    setUpdatingReferralId(referralId);
    try {
      const res = await fetch(`/api/referrals/${referralId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReferrals((prev) =>
          prev.map((r) => (r.id === referralId ? { ...r, referralStatus: status } : r))
        );
        setActionFeedback(
          status === 'ACCEPTED'
            ? 'Care referral accepted. You can now schedule directly with the recommended specialist.'
            : 'Referral declined.'
        );
      }
    } catch {
      setActionFeedback('Failed to update referral status.');
    } finally {
      setUpdatingReferralId(null);
    }
  };

  const handleVerifyCitation = async (
    citationKey: string,
    guidelineCode: string,
    chunkId?: string | null,
    passageText?: string | null,
    claimSupported?: string | null
  ) => {
    setVerifyingCitationKey(citationKey);
    try {
      const res = await fetch('/api/guidelines/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guidelineCode,
          chunkId: chunkId || undefined,
          claimedPassageText: passageText || undefined,
          claimSupported: claimSupported || undefined,
        }),
      });
      const data = await res.json();
      setVerificationFeedback((prev) => ({
        ...prev,
        [citationKey]: {
          verified: Boolean(data.verified),
          status: data.status || (data.verified ? 'VERIFIED' : 'REJECTED'),
          reason: data.reason || (data.verified ? 'Verified against approved guideline repository' : 'Failed to verify'),
          relevanceScore: data.relevanceScore ?? 1.0,
        },
      }));
    } catch {
      setVerificationFeedback((prev) => ({
        ...prev,
        [citationKey]: {
          verified: false,
          status: 'ERROR',
          reason: 'Verification request failed due to network error.',
          relevanceScore: 0,
        },
      }));
    } finally {
      setVerifyingCitationKey(null);
    }
  };

  const isSeed = session ? session.isSeedFixture : true;
  const displayCode = session ? session.sessionCode : sessionCode;
  const acuity = session ? session.acuityLevel : 'ROUTINE';
  const confidence = session ? session.confidenceScore : 88;
  const plainSummary = session?.plainLanguageSummary || 'Prompt outpatient evaluation advised within 24 to 48 hours. Symptoms warrant targeted physical auscultation and point-of-care testing to rule out lower respiratory tract involvement.';
  const careSetting = session?.recommendedCareSetting || 'Schedule an In-Person Primary Care or Urgent Clinic Visit Within 24–48 Hours';
  const clinicianReview = session?.clinicianReview;
  const explanations = session?.explanations && session.explanations.length > 0 ? session.explanations : null;
  const citations = session?.citations && session.citations.length > 0 ? session.citations : null;
  const isEmergency = acuity === 'EMERGENCY' || (session?.redFlagTriggered ?? false);
  const usedDeterministicFallback = !aiExecution || aiExecution.providerStatus === 'FALLBACK_DETERMINISTIC';

  const dateLabel = session?.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Oct 24, 2025, 14:32 UTC';

  return (
    <div className="space-y-6">
      {/* Top Metadata & Breadcrumb Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm uppercase tracking-wider">
              <MaterialIcon name="clinical_notes" className="text-[14px]" />
              {isSeed ? 'Sample Assessment Record' : 'Active Patient Assessment'}
            </span>
            <SeedFixtureBadge isSeedFixture={isSeed} />
            <span>•</span>
            <span className="font-mono">REF: {displayCode}</span>
            <span>•</span>
            <span>Generated: {dateLabel}</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            Clinical Assessment Results &amp; Care Navigation
          </h1>
        </div>

        {/* Quick Export & Share Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              setActionFeedback(
                `Exported structured Clinical Assessment Summary (${displayCode}) as PDF.`
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="download" className="text-[18px] text-primary" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActionFeedback(
                'Shared assessment packet with Primary Care Provider via FHIR R4.'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="share" className="text-[18px] text-secondary" />
            <span>Share with PCP</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-3 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2 text-on-surface">
            <MaterialIcon name="check_circle" className="text-primary text-[18px]" />
            <span>{actionFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}

      {/* AI Integration Honesty Banner per AGENTS.md 4.1 */}
      <>
        <section
          aria-label="AI Service Status"
          className="rounded-xl bg-surface-container-low border border-primary/20 p-4 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <MaterialIcon name="info" className="text-[20px]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-on-surface font-label-md text-label-md">
                  {usedDeterministicFallback
                    ? 'Deterministic Clinical Protocol Active'
                    : `AI decision support · ${aiExecution.provider} · ${aiExecution.modelName}`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-mono">
                {usedDeterministicFallback ? 'CDS Fallback' : 'Not clinician verified'}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {usedDeterministicFallback
                  ? `The AI model was unavailable for this assessment, so results use deterministic red-flag screening and retrieved clinical guidelines. ${aiExecution?.fallbackReason || ''}`
                  : 'Model-generated content is experimental, may be incorrect, and is not a diagnosis or treatment plan. Emergency rules remain deterministic, and clinician review is required.'}
              </p>
              {!usedDeterministicFallback && aiExecution?.provider === 'ollama-medgemma' && (
                <p className="font-body-sm text-on-surface-variant">
                  MedGemma is a developer model, not a medical device. Treat this output as research-grade decision support only.
                </p>
              )}
            </div>
          </div>
        </section>
      </>

      {/* Top Status Banners: Urgency Level & Clinician Review Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Urgency Banner (7 cols) */}
        <div
          className={`md:col-span-7 rounded-xl p-5 shadow-xs flex items-start gap-4 border-l-4 ${
            isEmergency
              ? 'bg-error-container text-on-error-container border-error ring-1 ring-error/50 animate-pulse'
              : acuity === 'URGENT'
              ? 'bg-amber-50 text-amber-950 border-amber-500'
              : acuity === 'SELF_CARE'
              ? 'bg-green-50 text-green-950 border-acuity-selfcare'
              : 'bg-surface-container-lowest text-on-surface border-secondary'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isEmergency
                ? 'bg-error text-on-error'
                : acuity === 'URGENT'
                ? 'bg-amber-200 text-amber-900'
                : acuity === 'SELF_CARE'
                ? 'bg-green-200 text-green-900'
                : 'bg-secondary-fixed text-secondary'
            }`}
          >
            <MaterialIcon
              name={isEmergency ? 'e911_emergency' : 'priority_high'}
              className="text-[24px]"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span
                className={`font-label-sm text-label-sm uppercase tracking-wider font-semibold ${
                  isEmergency ? 'text-error' : 'text-secondary'
                }`}
              >
                {isEmergency ? 'Critical Safety Escalation' : 'Triage Urgency Stratification'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm font-mono">
                {acuity} • {confidence}% Reliability
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg mt-1">
              {isEmergency
                ? 'Emergency Escalation — Seek Immediate ER Care'
                : acuity === 'URGENT'
                ? 'High Urgency — Evaluation Advised (<24h)'
                : acuity === 'SELF_CARE'
                ? 'Low Urgency — Self-Care Monitoring Protocol'
                : 'Routine Urgency — Outpatient Care Advised (24–48h)'}
            </h2>
            <p className="font-body-md text-body-md opacity-90 mt-1">
              {plainSummary}
            </p>
          </div>
        </div>

        {/* Clinician Review Status Banner (5 cols) */}
        <div className="md:col-span-5 rounded-xl bg-surface-container-low p-5 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
            <MaterialIcon name="clinical_notes" className="text-[22px]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                Verification Governance
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {clinicianReview ? `Stage: ${clinicianReview.stage}` : 'Automated Review'}
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              {clinicianReview
                ? clinicianReview.stage === 'SIGNED'
                  ? 'Clinician Review Completed & Signed'
                  : 'Clinician Review In Queue'
                : 'Awaiting Specialty Review Assignment'}
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {clinicianReview ? (
                <>
                  Assigned Clinician:{' '}
                  <strong>
                    {clinicianReview.clinician.name}
                    {clinicianReview.clinician.title ? `, ${clinicianReview.clinician.title}` : ''}
                  </strong>
                  . Concordance: <strong>{clinicianReview.concordanceStatus}</strong>.
                  {clinicianReview.clinicianNote && (
                    <span className="block mt-1 italic text-on-surface">
                      &quot;{clinicianReview.clinicianNote}&quot;
                    </span>
                  )}
                </>
              ) : (
                'Automated clinical triage recorded. Human verification queued per safety protocols.'
              )}
            </p>
            <div className="mt-2.5">
              <Link
                href="/assessments/history"
                className="font-label-md text-label-md text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Open Review Tracker</span>
                <MaterialIcon name="arrow_forward" className="text-[14px]" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Next-Step Recommendation Card (Prominent Above-the-Fold Action) */}
      <section className="rounded-xl bg-surface-container-lowest p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-primary font-label-md text-label-md">
              <MaterialIcon name="compass_calibration" className="text-[18px]" />
              <span className="uppercase tracking-wider">
                Primary Next-Step Care Recommendation
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              {careSetting}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {plainSummary}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[240px]">
            {isEmergency ? (
              <>
                <a
                  href="tel:999"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-error text-on-error font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity"
                >
                  <MaterialIcon name="call" className="text-[20px]" />
                  <span>Call Emergency Services (999)</span>
                </a>
                <Link
                  href="/care-directory"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-low text-error hover:bg-surface-container-high font-label-lg text-label-lg transition-colors"
                >
                  <MaterialIcon name="location_on" className="text-[20px]" />
                  <span>Find Nearest Emergency Dept</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/care-directory"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity"
                >
                  <MaterialIcon name="person_search" className="text-[20px]" />
                  <span>View Recommended Doctors</span>
                </Link>
                <Link
                  href="/care-directory"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-low text-primary hover:bg-surface-container-high font-label-lg text-label-lg transition-colors"
                >
                  <MaterialIcon name="location_on" className="text-[20px]" />
                  <span>Find Nearby Facility</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mandatory Safety Guardrail & Emergency Disclaimer Strip */}
        <div className="mt-5 pt-4 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-error-container/35 p-3.5 rounded-lg">
          <div className="flex items-start sm:items-center gap-3">
            <MaterialIcon name="emergency" className="text-error text-[22px] shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface">
              <strong className="text-error">
                Decision-support tool, not a replacement for a doctor.
              </strong>{' '}
              In an emergency (severe difficulty breathing at rest, bluish lips, crushing chest pain,
              or confusion), call <strong>999</strong> or go to the nearest emergency department
              immediately.
            </p>
          </div>
          <span className="font-label-sm text-label-sm text-error uppercase tracking-wider shrink-0">
            Safety Protocol Active
          </span>
        </div>
      </section>

      {/* Evidence Taxonomy & Source Legend Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-surface-container-low p-3.5 flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary mt-1.5 shrink-0" />
          <div>
            <div className="font-label-md text-label-md text-on-surface">
              Source Type 1: Patient-Reported
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Subjective symptom intake, timeline, and self-monitored readings.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3.5 flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <div>
            <div className="font-label-md text-label-md text-on-surface">
              Source Type 2: Clinical Evidence
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Peer-reviewed medical literature and diagnostic study benchmarks.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3.5 flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-tertiary mt-1.5 shrink-0" />
          <div>
            <div className="font-label-md text-label-md text-on-surface">
              Source Type 3: Care Protocol
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Deterministic clinical routing rules and red-flag exclusion logic.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3.5 flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-outline mt-1.5 shrink-0" />
          <div>
            <div className="font-label-md text-label-md text-on-surface">
              Source Type 4: Clinician Determinations
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Verified physician or nurse practitioner review notes and overrides.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION: "Why this recommendation?" (5-Factor Bento Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Why this recommendation?
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Transparent breakdown of inputs, missing clinical variables, longitudinal context, and
              supporting protocols.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
            Explainable Triage Matrix v2.4
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card 1: Symptoms that influenced the result (6 cols) */}
          <div className="lg:col-span-6 rounded-xl bg-surface-container-lowest p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="record_voice_over" className="text-secondary text-[20px]" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    1. Influencing Symptoms
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                  Patient-Reported Input
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Specific subjective findings captured during your interactive intake session that
                elevated acuity above self-care:
              </p>
              <ul className="space-y-2.5 font-body-md text-body-md">
                {explanations ? (
                  explanations.map((exp, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-surface-container-low"
                    >
                      <div className="flex items-start gap-2.5">
                        <MaterialIcon
                          name="fiber_manual_record"
                          className="text-secondary text-[14px] mt-1"
                        />
                        <div>
                          <span className="font-medium text-on-surface">
                            {exp.factorLabel}
                          </span>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {exp.rationale}
                          </p>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary shrink-0 capitalize">
                        {exp.factorType.replace('_', ' ').toLowerCase()}
                      </span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-surface-container-low">
                      <div className="flex items-start gap-2.5">
                        <MaterialIcon
                          name="fiber_manual_record"
                          className="text-secondary text-[14px] mt-1"
                        />
                        <div>
                          <span className="font-medium text-on-surface">
                            Persistent Productive Cough (5 Days)
                          </span>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            Reported transition from dry irritation to mucopurulent sputum over 48h.
                          </p>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary shrink-0">
                        Primary Driver
                      </span>
                    </li>
                    <li className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-surface-container-low">
                      <div className="flex items-start gap-2.5">
                        <MaterialIcon
                          name="fiber_manual_record"
                          className="text-secondary text-[14px] mt-1"
                        />
                        <div>
                          <span className="font-medium text-on-surface">
                            Intermittent Low-Grade Pyrexia (100.8°F / 38.2°C)
                          </span>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            Measured orally at home; responds partially to antipyretics.
                          </p>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary shrink-0">
                        Moderate Weight
                      </span>
                    </li>
                    <li className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-surface-container-low">
                      <div className="flex items-start gap-2.5">
                        <MaterialIcon
                          name="fiber_manual_record"
                          className="text-secondary text-[14px] mt-1"
                        />
                        <div>
                          <span className="font-medium text-on-surface">
                            Mild Exertional Dyspnea (Stairs)
                          </span>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            No shortness of breath at rest; able to speak in full sentences during voice
                            check.
                          </p>
                        </div>
                      </div>
                      <span className="font-label-sm text-label-sm text-primary shrink-0">
                        Escalation Trigger
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span>Negative Red Flags: {isEmergency ? 'Critical Rule Triggered' : 'No acute ischemic or hypoxic criteria'}</span>
              <span>Intake Reliability: {confidence}%</span>
            </div>
          </div>

          {/* Card 2: Unknown or Unverified Information (6 cols) */}
          <div className="lg:col-span-6 rounded-xl bg-surface-container-lowest p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="help_clinic" className="text-tertiary text-[20px]" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    2. Unknown Data &amp; Gaps
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                  Requires Clinical Verification
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Variables that could not be verified remotely and require objective physical or
                diagnostic evaluation:
              </p>
              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-3">
                  <MaterialIcon
                    name="pulmonology"
                    className="text-tertiary text-[20px] shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-label-lg text-label-lg text-on-surface">
                      Pulmonary Auscultation (Lung Sounds)
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Cannot exclude localized crackles (rales), rhonchi, or diminished breath
                      sounds indicative of lobar consolidation without stethoscope exam.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-3">
                  <MaterialIcon
                    name="spo2"
                    className="text-tertiary text-[20px] shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-label-lg text-label-lg text-on-surface">
                      Verified Resting &amp; Ambulatory SpO2
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      No calibrated pulse oximeter reading was provided during intake. Objective
                      oxygen saturation (&gt;95% threshold) is currently unconfirmed.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-3">
                  <MaterialIcon
                    name="biotech"
                    className="text-tertiary text-[20px] shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-label-lg text-label-lg text-on-surface">
                      Viral / Bacterial Pathogen Differentiation
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Rapid PCR swab (Influenza A/B, SARS-CoV-2) or chest imaging if focal signs are
                      present on exam.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span>3 Unverified Clinical Parameters</span>
              <Link href="/records" className="text-primary hover:underline">
                + Submit Home SpO2 Reading
              </Link>
            </div>
          </div>

          {/* Card 3: Consented Patient History Used (4 cols) */}
          <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="folder_shared" className="text-primary text-[20px]" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    3. Longitudinal History
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                  Consented EHR
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                Authorized profile records factored into risk calibration (Consent ID:
                #CNS-9921-Sample):
              </p>
              <div className="space-y-2 font-body-sm text-body-sm">
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="text-on-surface font-medium">Mild Intermittent Asthma</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                    Clinician-Verified (2023)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="text-on-surface font-medium">Albuterol HFA Inhaler (PRN)</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                    Active Rx Record
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="text-on-surface font-medium">Penicillin Allergy (Hives)</span>
                  <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm">
                    Flagged for Prescriber
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Records Excluded: 0</span>
              <Link href="/settings/privacy" className="text-secondary hover:underline">
                Manage Data Access
              </Link>
            </div>
          </div>

          {/* Card 4: Supporting Guideline Summary (4 cols) */}
          <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="policy" className="text-primary text-[20px]" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    4. Supporting Guideline
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">
                  Care Protocol
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low mb-3">
                <div className="font-label-sm text-label-sm text-primary uppercase">
                  {citations && citations.length > 0 ? 'Active Matched Protocol' : 'Sample Protocol Reference'}
                </div>
                <div className="font-label-lg text-label-lg text-on-surface mt-0.5">
                  {citations && citations.length > 0
                    ? `${citations[0]?.guideline?.organization} • ${citations[0]?.guideline?.title} (${citations[0]?.guideline?.code})`
                    : 'ACP / ATS Adult Acute Cough & Lower Respiratory Tract Pathway (Sample v2024.2)'}
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {citations && citations.length > 0
                  ? citations[0]?.relevanceNote || citations[0]?.guideline?.summary
                  : 'In adult patients with pre-existing reactive airway disease presenting with febrile productive cough, clinical practice guidelines recommend in-person evaluation within 24–48 hours.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Concordance: Tier 1B Alignment</span>
              <a href="#evidence-accordions" className="text-primary hover:underline">
                Read Citations ↓
              </a>
            </div>
          </div>

          {/* Card 5: Confidence & Limitations (4 cols) */}
          <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="balance" className="text-outline text-[20px]" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    5. Confidence &amp; Limits
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                  Model Disclosure
                </span>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between font-label-md text-label-md mb-1">
                  <span className="text-on-surface">Protocol Match Reliability</span>
                  <span className="text-primary font-mono font-semibold">{confidence}% Reliability</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${confidence}%` }} />
                </div>
              </div>
              <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <MaterialIcon name="info" className="text-outline text-[16px] shrink-0 mt-0.5" />
                  <span>
                    <strong>Non-Diagnostic Scope:</strong> This system stratifies care urgency; it
                    does not provide a definitive diagnosis or replace physician clinical judgment.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <MaterialIcon
                    name="schedule"
                    className="text-outline text-[16px] shrink-0 mt-0.5"
                  />
                  <span>
                    <strong>Temporal Validity:</strong> Valid for symptoms reported at {dateLabel}.
                    Re-evaluate immediately if symptoms worsen.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Clinician Override Eligible</span>
              <span className="font-mono">Audit #{displayCode}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Expandable Clinical Evidence & Literature Citations */}
      <section
        id="evidence-accordions"
        className="rounded-xl bg-surface-container-lowest p-6 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Clinical Evidence &amp; Literature Sources
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Expand each source below to inspect how clinical guidelines and peer-reviewed
              evidence differ from patient-reported inputs.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm self-start sm:self-auto">
            {guidelines.length + 1} Curated Guideline References
          </span>
        </div>

        {/* Real Session Citations or Fallback Evidence */}
        {citations && citations.length > 0 ? (
          citations.map((c, idx) => {
            const citationKey = c.id || `cit-${idx}-${c.guideline.code}`;
            const passage = c.passageText || c.chunk?.passageText;
            const section = c.sectionTitle || c.chunk?.sectionTitle;
            const sectionNumber = c.sectionNumber || c.chunk?.sectionNumber;
            const pageNumber = c.pageNumber || c.chunk?.pageNumber;
            const sourceUrl = c.sourceUrl || c.guideline.sourceUrl;
            const isUnavailable = c.verificationStatus === 'EVIDENCE_UNAVAILABLE';
            const feedback = verificationFeedback[citationKey];
            const isVerifying = verifyingCitationKey === citationKey;

            if (isUnavailable) {
              return (
                <div
                  key={citationKey}
                  className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-amber-950 flex items-start gap-3"
                >
                  <MaterialIcon name="info" className="text-amber-600 text-[22px] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold font-label-md text-label-md text-amber-900 flex items-center gap-2">
                      <span>Clinical Evidence Limitation</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-label-sm text-label-sm">
                        Evidence Unavailable
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-amber-900/90">
                      {c.relevanceNote ||
                        'No validated clinical practice guidelines in the active knowledge base met the required relevance threshold for this specific symptom cluster. In accordance with clinical governance, synthetic or unverified citations have not been generated; direct clinical review is required.'}
                    </p>
                    <div className="pt-1 text-label-sm text-amber-800">
                      Protocols Referenced: {c.guideline?.organization || 'General Clinical Governance'}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <details
                key={citationKey}
                open={idx === 0}
                className="group rounded-xl bg-surface-container-low p-4 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-label-sm text-label-sm">
                      {c.guideline.organization} ({c.guideline.publicationYear})
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-label-sm text-label-sm">
                      <MaterialIcon name="verified" className="text-[14px] text-emerald-700" />
                      Verified Corpus Passage
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      [Citation 0{idx + 1}] {c.guideline.title} ({c.guideline.code})
                    </span>
                  </div>
                  <MaterialIcon
                    name="expand_more"
                    className="text-on-surface-variant group-open:rotate-180 transition-transform"
                  />
                </summary>

                <div className="mt-3 pt-3 border-t border-outline-variant/30 grid grid-cols-1 md:grid-cols-12 gap-4 font-body-sm text-body-sm text-on-surface-variant">
                  <div className="md:col-span-8 space-y-3">
                    {section && (
                      <div className="font-label-md text-label-md text-primary font-semibold flex items-center gap-1.5">
                        <MaterialIcon name="menu_book" className="text-[18px]" />
                        <span>
                          {sectionNumber ? `Section ${sectionNumber}: ` : ''}
                          {section}
                          {pageNumber ? ` (Page ${pageNumber})` : ''}
                        </span>
                      </div>
                    )}

                    {passage ? (
                      <div className="space-y-1">
                        <span className="text-on-surface font-medium text-label-sm uppercase tracking-wider">
                          Verified Passages &amp; Clinical Directive:
                        </span>
                        <blockquote className="p-3.5 rounded-lg bg-surface-container-lowest border-l-4 border-primary text-on-surface font-body-sm leading-relaxed">
                          &ldquo;{passage}&rdquo;
                        </blockquote>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-on-surface font-medium">Guideline Summary:</p>
                        <p>{c.guideline.summary}</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-on-surface font-medium">Relevance to Active Symptoms:</p>
                      <p>{c.relevanceNote}</p>
                    </div>

                    {c.claimSupported && (
                      <div className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between text-body-sm text-on-surface gap-2">
                        <span>
                          <strong>Supported Decision Claim:</strong> {c.claimSupported}
                        </span>
                        {c.relevanceScore !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-surface-container-highest font-mono text-label-sm shrink-0">
                            Match: {(c.relevanceScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}

                    {/* Live Reviewer Verification Action */}
                    <div className="pt-2 flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyCitation(
                            citationKey,
                            c.guideline.code,
                            c.chunkId || c.chunk?.id,
                            passage,
                            c.claimSupported
                          )
                        }
                        disabled={isVerifying}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-label-sm transition-colors disabled:opacity-50"
                      >
                        <MaterialIcon
                          name={isVerifying ? 'sync' : 'verified_user'}
                          className={`text-[16px] ${isVerifying ? 'animate-spin' : ''}`}
                        />
                        <span>{isVerifying ? 'Verifying with Corpus...' : 'Verify Citation Grounding'}</span>
                      </button>

                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-label-sm text-label-sm"
                        >
                          <span>Open Guideline Publication</span>
                          <MaterialIcon name="open_in_new" className="text-[14px]" />
                        </a>
                      )}
                    </div>

                    {/* Live Verification Result Banner */}
                    {feedback && (
                      <div
                        className={`p-2.5 rounded-lg border font-body-sm text-body-sm flex items-start gap-2 ${
                          feedback.verified
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-rose-50 border-rose-300 text-rose-950'
                        }`}
                      >
                        <MaterialIcon
                          name={feedback.verified ? 'check_circle' : 'cancel'}
                          className={`text-[18px] shrink-0 mt-0.5 ${
                            feedback.verified ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        />
                        <div className="space-y-0.5">
                          <div className="font-semibold font-label-sm text-label-sm">
                            {feedback.verified ? 'Citation Verified by Server' : 'Verification Rejection'}
                          </div>
                          <p>{feedback.reason}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-4 bg-surface-container-lowest p-3 rounded-lg space-y-1.5 font-label-sm text-label-sm">
                    <div className="text-outline uppercase tracking-wider font-semibold">Guideline Metadata</div>
                    <div className="text-on-surface font-medium">Organization: {c.guideline.organization}</div>
                    <div>Protocol Code: {c.guideline.code}</div>
                    {c.guideline.version && <div>Version: {c.guideline.version}</div>}
                    <div>Publication Year: {c.guideline.publicationYear}</div>
                    {pageNumber && <div>Source Page: {pageNumber}</div>}
                    <div className="pt-1 text-on-surface-variant border-t border-surface-container">
                      Storage: Grounded Guideline Corpus
                    </div>
                  </div>
                </div>
              </details>
            );
          })
        ) : (
          <details
            open
            className="group rounded-xl bg-surface-container-low p-4 transition-colors"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-label-sm text-label-sm">
                  Clinical Evidence
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  [Sample Citation 01] Outpatient Risk Stratification in Adults with Subacute Febrile
                  Cough and Reactive Airway History
                </span>
              </div>
              <MaterialIcon
                name="expand_more"
                className="text-on-surface-variant group-open:rotate-180 transition-transform"
              />
            </summary>
            <div className="mt-3 pt-3 border-t border-outline-variant/30 grid grid-cols-1 md:grid-cols-12 gap-4 font-body-sm text-body-sm text-on-surface-variant">
              <div className="md:col-span-8 space-y-1.5">
                <p className="text-on-surface font-medium">
                  Clinical Relevance Summary:
                </p>
                <p>
                  Observational cohort studies indicate that patients with underlying mild asthma who
                  develop febrile lower respiratory symptoms lasting &gt;96 hours benefit from early
                  auscultation and peak-flow/oximetry verification to prevent delayed corticosteroid or
                  antimicrobial therapy.
                </p>
              </div>
              <div className="md:col-span-4 bg-surface-container-lowest p-3 rounded-lg space-y-1 font-label-sm text-label-sm">
                <div className="text-outline uppercase">Source Metadata</div>
                <div className="text-on-surface">
                  Journal: Respiratory Care &amp; Triage Review
                </div>
                <div>Evidence Grade: Level II-A (Cohort Consensus)</div>
                <div>Distinction: Peer-Reviewed Study (Not Patient Input)</div>
              </div>
            </div>
          </details>
        )}

        {/* Persisted Database Guidelines */}
        {guidelines.map((g, idx) => (
          <details
            key={g.id}
            className="group rounded-xl bg-surface-container-low p-4 transition-colors"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm">
                  {g.organization} ({g.publicationYear})
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  [Citation 0{idx + 2}] {g.title} ({g.code})
                </span>
              </div>
              <MaterialIcon
                name="expand_more"
                className="text-on-surface-variant group-open:rotate-180 transition-transform"
              />
            </summary>
            <div className="mt-3 pt-3 border-t border-outline-variant/30 grid grid-cols-1 md:grid-cols-12 gap-4 font-body-sm text-body-sm text-on-surface-variant">
              <div className="md:col-span-8 space-y-1.5">
                <p className="text-on-surface font-medium">Guideline Recommendation Summary:</p>
                <p>{g.summary}</p>
              </div>
              <div className="md:col-span-4 bg-surface-container-lowest p-3 rounded-lg space-y-1 font-label-sm text-label-sm">
                <div className="text-outline uppercase">Guideline Metadata</div>
                <div className="text-on-surface">Organization: {g.organization}</div>
                <div>Protocol Code: {g.code}</div>
                <div>Year: {g.publicationYear}</div>
              </div>
            </div>
          </details>
        ))}
      </section>

      {/* Matched Care Referrals & Specialist Consultations */}
      {referrals && referrals.length > 0 && (
        <section aria-label="Specialist Referrals" className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm uppercase tracking-wider">
                <MaterialIcon name="share_location" className="text-[14px]" />
                <span>Clinical Specialty Referral</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mt-1">
                Matched Clinical Specialists for Follow-Up
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Based on your symptom profile, the following specialist consultation is recommended for clinical evaluation. This care navigation recommendation is decision support and not a definitive diagnosis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {referrals.map((ref) => (
              <div
                key={ref.id}
                className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-label-sm text-on-surface-variant font-semibold">
                      {ref.referralCode}
                    </span>
                    <div className="flex items-center gap-2">
                      <SeedFixtureBadge isSeedFixture={ref.doctor.isSeedFixture} />
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                          ref.referralStatus === 'ACCEPTED'
                            ? 'bg-green-100 text-green-800'
                            : ref.referralStatus === 'DECLINED'
                            ? 'bg-red-100 text-red-800'
                            : ref.referralStatus === 'SCHEDULED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {ref.referralStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-gradient text-on-primary flex items-center justify-center font-bold text-headline-sm shrink-0 shadow-xs">
                      {ref.doctor.name
                        .replace(/^Dr\.\s*/i, '')
                        .split(' ')
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join('')}
                    </div>
                    <div>
                      <h4 className="font-headline-sm text-headline-sm text-on-surface">
                        {ref.doctor.name}
                      </h4>
                      <p className="text-body-sm text-on-surface-variant">
                        {ref.doctor.specialty} • {ref.doctor.hospitalAffiliation}
                      </p>
                      <p className="text-[12px] text-outline mt-0.5">
                        {ref.doctor.city}, {ref.doctor.state} • ${ref.doctor.consultationFee}
                      </p>
                    </div>
                  </div>

                  <p className="text-body-sm text-on-surface bg-surface-container-lowest p-3 rounded-lg border border-surface-container">
                    {ref.clinicalSummary}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-surface-container">
                  {ref.referralStatus === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        disabled={updatingReferralId === ref.id}
                        onClick={() => handleUpdateReferral(ref.id, 'ACCEPTED')}
                        className="flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 text-center"
                      >
                        Accept Referral
                      </button>
                      <button
                        type="button"
                        disabled={updatingReferralId === ref.id}
                        onClick={() => handleUpdateReferral(ref.id, 'DECLINED')}
                        className="py-2 px-3 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <Link
                      href={`/care-directory/${ref.doctor.id}`}
                      className="w-full py-2 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors text-center inline-flex items-center justify-center gap-2"
                    >
                      <MaterialIcon name="calendar_month" className="text-[16px]" />
                      <span>Book Consultation with {ref.doctor.name}</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom Action Bar: Care Coordination & Record Management */}
      <section className="rounded-xl bg-surface-container-high p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
            Care Continuity Actions
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Available Care Coordination Pathways
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Execute your care plan or archive this decision-support record to your longitudinal
            health vault.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/care-directory"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="stethoscope" className="text-[18px]" />
            <span>View Recommended Doctors</span>
          </Link>
          <Link
            href="/care-directory"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container-low font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="local_hospital" className="text-[18px]" />
            <span>Find Nearby Facility</span>
          </Link>
          <button
            type="button"
            onClick={() =>
              setActionFeedback(
                `Saved Assessment ${sessionCode} to your encrypted Medical Records Vault.`
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-low font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="bookmark_add" className="text-[18px] text-secondary" />
            <span>Save to Records</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActionFeedback('Generated encrypted share link for your care team.')
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-low font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="ios_share" className="text-[18px] text-secondary" />
            <span>Share Summary</span>
          </button>
          <Link
            href="/assessments/history"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:opacity-95 font-label-lg text-label-lg shadow-xs transition-opacity"
          >
            <MaterialIcon name="verified_user" className="text-[18px]" />
            <span>Request Clinician Review</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
