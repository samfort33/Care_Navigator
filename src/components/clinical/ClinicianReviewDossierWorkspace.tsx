'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export interface ReviewDossierData {
  id: string;
  sessionId: string;
  stage: 'QUEUED' | 'REVIEWING' | 'SIGNED' | 'ESCALATED';
  concordanceStatus: string;
  overriddenAcuity: string | null;
  clinicianNote: string | null;
  actionRequiredNote: string | null;
  signedAt: string | Date | null;
  isSeedFixture: boolean;
  clinician: {
    id: string;
    name: string;
    title: string | null;
    specialty: string | null;
  };
  session: {
    id: string;
    sessionCode: string;
    chiefComplaint: string;
    status: string;
    acuityLevel: string;
    confidenceScore: number;
    recommendedCareSetting: string;
    plainLanguageSummary: string;
    redFlagTriggered: boolean;
    redFlagReasonsJson: string;
    voiceTranscript: string | null;
    createdAt: string | Date;
    patientProfile: {
      age: number;
      sex: string;
      bloodType: string | null;
      conditions?: Array<{ id: string; name: string }>;
      medications?: Array<{ id: string; name: string; dosage: string }>;
      allergies?: Array<{ id: string; allergen: string }>;
      user: {
        id: string;
        name: string;
        email: string;
        mrn?: string | null;
      };
    };
    answers: Array<{
      id: string;
      stepNumber: number;
      questionPrompt: string;
      answerValue: string;
    }>;
    explanations: Array<{
      id: string;
      factorType: string;
      factorLabel: string;
      rationale: string;
      importanceRank: number;
    }>;
    citations: Array<{
      id: string;
      relevanceScore: number;
      relevanceNote: string;
      passageText: string | null;
      verificationStatus: string;
      guideline: {
        code: string;
        organization: string;
        title: string;
        publicationYear: number;
      };
    }>;
    uploadedMedia: Array<{
      id: string;
      fileName: string;
      modality: string;
      processingStatus: string;
      extractedSummary: string | null;
    }>;
  };
  reviewDecisions: Array<{
    id: string;
    decisionType: string;
    previousStage: string | null;
    newStage: string;
    overriddenAcuity: string | null;
    rationale: string;
    createdAt: string | Date;
    clinicianUser: {
      name: string;
      title: string | null;
      role: string;
    };
  }>;
}

export function ClinicianReviewDossierWorkspace({ dossier }: { dossier: ReviewDossierData }) {
  const router = useRouter();

  const [decisionType, setDecisionType] = useState<
    'CARE_PLAN_SIGNED' | 'CONCURRED' | 'OVERRIDDEN' | 'CLARIFICATION_REQUESTED' | 'ESCALATED'
  >('CARE_PLAN_SIGNED');
  const [newStage, setNewStage] = useState<'QUEUED' | 'REVIEWING' | 'SIGNED' | 'ESCALATED'>('SIGNED');
  const [overriddenAcuity, setOverriddenAcuity] = useState<string>(
    dossier.overriddenAcuity || dossier.session.acuityLevel
  );
  const [rationale, setRationale] = useState<string>('');
  const [clinicianNote, setClinicianNote] = useState<string>(dossier.clinicianNote || '');
  const [actionRequiredNote, setActionRequiredNote] = useState<string>(dossier.actionRequiredNote || '');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentAcuity = dossier.overriddenAcuity || dossier.session.acuityLevel;

  async function handleSubmitDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!rationale.trim()) {
      setFeedback({ type: 'error', message: 'Clinical rationale is required for decision attestation.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload: {
        decisionType: string;
        newStage: string;
        overriddenAcuity?: string;
        rationale: string;
        clinicianNote?: string;
        actionRequiredNote?: string;
      } = {
        decisionType,
        newStage,
        rationale: rationale.trim(),
        clinicianNote: clinicianNote.trim() || undefined,
        actionRequiredNote: actionRequiredNote.trim() || undefined,
      };

      if (decisionType === 'OVERRIDDEN') {
        payload.overriddenAcuity = overriddenAcuity;
      }

      const res = await fetch(`/api/reviews/${dossier.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit clinical decision.');
      }

      setFeedback({
        type: 'success',
        message: `Clinical decision recorded successfully. Stage transitioned to ${newStage}.`,
      });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error submitting decision',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:underline"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          <span>Back to Clinician Review Queue</span>
        </Link>
        <div className="flex items-center gap-2">
          <SeedFixtureBadge isSeedFixture={dossier.isSeedFixture} />
          <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-label-sm text-label-sm font-semibold text-on-surface-variant">
            MRN: {dossier.session.patientProfile.user.mrn || 'N/A'}
          </span>
          <span
            className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
              dossier.stage === 'SIGNED'
                ? 'bg-primary-fixed text-on-primary-fixed'
                : dossier.stage === 'ESCALATED'
                ? 'bg-red-100 text-red-900'
                : 'bg-blue-100 text-blue-900'
            }`}
          >
            STAGE: {dossier.stage}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border-l-4 font-body-sm text-body-sm flex items-center justify-between gap-4 ${
            feedback.type === 'success'
              ? 'bg-surface-container-lowest border-primary text-on-surface shadow-sm'
              : 'bg-error-container text-on-error-container border-error'
          }`}
        >
          <div className="flex items-center gap-2">
            <MaterialIcon
              name={feedback.type === 'success' ? 'check_circle' : 'error'}
              className="text-[20px]"
            />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
      )}

      {/* Hero Dossier Banner */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-container">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-headline-sm font-bold text-primary">
                #{dossier.session.sessionCode}
              </span>
              <span className="text-on-surface-variant">•</span>
              <span className="font-headline-sm text-on-surface font-semibold">
                {dossier.session.patientProfile.user.name}
              </span>
              <span className="text-body-sm text-on-surface-variant font-mono">
                ({dossier.session.patientProfile.age}y / {dossier.session.patientProfile.sex})
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Chief Complaint:{' '}
              <strong className="text-on-surface">{dossier.session.chiefComplaint}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
              <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">AI Acuity Signal</div>
              <div className="font-bold text-body-sm text-on-surface">{dossier.session.acuityLevel}</div>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
              <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">Current Acuity</div>
              <div
                className={`font-bold text-body-sm ${
                  currentAcuity === 'EMERGENCY'
                    ? 'text-error'
                    : currentAcuity === 'URGENT'
                    ? 'text-amber-800'
                    : 'text-primary'
                }`}
              >
                {currentAcuity}
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
              <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">Concordance</div>
              <div className="font-bold text-body-sm text-on-surface">{dossier.concordanceStatus}</div>
            </div>
          </div>
        </div>

        {/* Clinical Patient Context Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-body-sm p-3.5 rounded-xl bg-surface-container-low">
          <div>
            <span className="text-outline uppercase text-[11px] font-semibold block">Allergies</span>
            <span className="text-on-surface font-medium">
              {Array.isArray(dossier.session.patientProfile.allergies) && dossier.session.patientProfile.allergies.length > 0
                ? dossier.session.patientProfile.allergies.map((a) => a.allergen).join(', ')
                : 'NKDA (None reported)'}
            </span>
          </div>
          <div>
            <span className="text-outline uppercase text-[11px] font-semibold block">Chronic Conditions</span>
            <span className="text-on-surface font-medium">
              {Array.isArray(dossier.session.patientProfile.conditions) && dossier.session.patientProfile.conditions.length > 0
                ? dossier.session.patientProfile.conditions.map((c) => c.name).join(', ')
                : 'None documented'}
            </span>
          </div>
          <div>
            <span className="text-outline uppercase text-[11px] font-semibold block">Current Medications</span>
            <span className="text-on-surface font-medium">
              {Array.isArray(dossier.session.patientProfile.medications) && dossier.session.patientProfile.medications.length > 0
                ? dossier.session.patientProfile.medications.map((m) => `${m.name} (${m.dosage})`).join(', ')
                : 'None reported'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Grid: Clinical Dossier (8 cols) vs Decision Attestation Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dossier Evidence */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI Assessment Plain Summary */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-3">
            <div className="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider">
              <MaterialIcon name="summarize" className="text-[18px]" />
              <span>Assessment Clinical Summary</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface leading-relaxed">
              {dossier.session.plainLanguageSummary}
            </p>
            <div className="text-body-sm text-on-surface-variant">
              Recommended Care Setting:{' '}
              <strong className="text-on-surface">{dossier.session.recommendedCareSetting}</strong>
            </div>
          </section>

          {/* Structured Questionnaire Answers */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider">
                <MaterialIcon name="quiz" className="text-[18px]" />
                <span>Patient Assessment Answers ({dossier.session.answers.length})</span>
              </div>
            </div>

            <div className="divide-y divide-surface-container">
              {dossier.session.answers.map((ans) => (
                <div key={ans.id} className="py-2.5 space-y-0.5">
                  <div className="text-[12px] text-outline font-semibold">
                    Step {ans.stepNumber}: {ans.questionPrompt}
                  </div>
                  <div className="text-body-sm font-medium text-on-surface">
                    {ans.answerValue}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Clinical Explanations & Risk Modifiers */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
            <div className="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider">
              <MaterialIcon name="insights" className="text-[18px]" />
              <span>Explainability Factors &amp; Risk Modifiers</span>
            </div>

            <div className="space-y-2.5">
              {dossier.session.explanations.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-body-sm text-on-surface">
                      {exp.factorLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-secondary-container text-on-secondary-container font-mono">
                      {exp.factorType}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">{exp.rationale}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Guideline Citations */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
            <div className="flex items-center gap-2 text-secondary font-label-md text-label-md uppercase tracking-wider">
              <MaterialIcon name="menu_book" className="text-[18px]" />
              <span>Grounded Clinical Guideline Citations ({dossier.session.citations.length})</span>
            </div>

            <div className="space-y-3">
              {dossier.session.citations.map((cite) => (
                <div
                  key={cite.id}
                  className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-secondary text-on-secondary text-[11px] font-semibold">
                      {cite.guideline.organization} • {cite.guideline.code}
                    </span>
                    <span className="text-[11px] font-mono text-outline">
                      Relevance Score: {cite.relevanceScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="font-semibold text-body-sm text-on-surface">
                    {cite.guideline.title} ({cite.guideline.publicationYear})
                  </div>
                  {cite.passageText && (
                    <blockquote className="p-3 rounded bg-surface-container-lowest border-l-2 border-secondary text-body-sm text-on-surface-variant italic">
                      &quot;{cite.passageText}&quot;
                    </blockquote>
                  )}
                  <p className="text-body-sm text-on-surface-variant">{cite.relevanceNote}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Uploaded Media & Voice Intake */}
          {(dossier.session.uploadedMedia.length > 0 || dossier.session.voiceTranscript) && (
            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
              <div className="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider">
                <MaterialIcon name="perm_media" className="text-[18px]" />
                <span>Multimodal Intake Artifacts</span>
              </div>

              {dossier.session.voiceTranscript && (
                <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
                  <div className="flex items-center gap-1.5 text-primary text-[12px] font-semibold uppercase">
                    <MaterialIcon name="mic" className="text-[16px]" />
                    <span>Transcribed Voice Intake</span>
                  </div>
                  <p className="text-body-sm text-on-surface italic">
                    &quot;{dossier.session.voiceTranscript}&quot;
                  </p>
                </div>
              )}

              {dossier.session.uploadedMedia.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <MaterialIcon name="attach_file" className="text-secondary text-[20px]" />
                    <div>
                      <div className="font-medium text-body-sm text-on-surface">{m.fileName}</div>
                      <div className="text-[11px] text-outline">{m.modality} • {m.processingStatus}</div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Audit History & Decisions Log */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20 space-y-4">
            <div className="flex items-center gap-2 text-outline font-label-md text-label-md uppercase tracking-wider">
              <MaterialIcon name="history" className="text-[18px]" />
              <span>Attestation Audit Trail ({dossier.reviewDecisions.length})</span>
            </div>

            {dossier.reviewDecisions.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant italic">
                No clinical decisions recorded yet. Triage is pending clinician review.
              </p>
            ) : (
              <div className="space-y-3">
                {dossier.reviewDecisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-1 text-body-sm"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-primary">{dec.decisionType}</span>
                      <span className="text-[11px] text-outline font-mono">
                        {new Date(dec.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-on-surface">{dec.rationale}</p>
                    <div className="text-[12px] text-on-surface-variant">
                      Reviewer: {dec.clinicianUser.name} ({dec.clinicianUser.title || dec.clinicianUser.role})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Interactive Attestation Form */}
        <aside aria-label="Clinical Decision Attestation" className="lg:col-span-5 sticky top-20">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-primary/20 space-y-5">
            <div className="pb-3 border-b border-surface-container">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                Physician Attestation &amp; Sign-off
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
                Certify Clinical Care Plan
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Human-in-the-loop attestation. Decisions create an immutable audit record and update the patient&apos;s verified results.
              </p>
            </div>

            <form onSubmit={handleSubmitDecision} className="space-y-4">
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface uppercase tracking-wider mb-1.5">
                  Decision Type
                </label>
                <select
                  value={decisionType}
                  onChange={(e) => {
                    const dt = e.target.value as typeof decisionType;
                    setDecisionType(dt);
                    if (dt === 'CARE_PLAN_SIGNED') setNewStage('SIGNED');
                    else if (dt === 'ESCALATED') setNewStage('ESCALATED');
                    else if (dt === 'CLARIFICATION_REQUESTED') setNewStage('REVIEWING');
                    else if (dt === 'OVERRIDDEN') setNewStage('REVIEWING');
                    else if (dt === 'CONCURRED') setNewStage('SIGNED');
                  }}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="CARE_PLAN_SIGNED">Sign &amp; Certify Care Plan (Complete)</option>
                  <option value="CONCURRED">Concur with AI Triage (Agreed)</option>
                  <option value="OVERRIDDEN">Override Acuity Level</option>
                  <option value="CLARIFICATION_REQUESTED">Request Clarification / More Info</option>
                  <option value="ESCALATED">Escalate Critical Priority (Emergency 999)</option>
                </select>
              </div>

              {decisionType === 'OVERRIDDEN' && (
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface uppercase tracking-wider mb-1.5">
                    Override Acuity Level To:
                  </label>
                  <select
                    value={overriddenAcuity}
                    onChange={(e) => setOverriddenAcuity(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                  >
                    <option value="EMERGENCY">EMERGENCY (Acuity 1)</option>
                    <option value="URGENT">URGENT (Acuity 2)</option>
                    <option value="ROUTINE">ROUTINE (Acuity 3)</option>
                    <option value="SELF_CARE">SELF_CARE (Acuity 4)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-label-sm text-label-sm text-on-surface uppercase tracking-wider mb-1.5">
                  Target Review Stage:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['QUEUED', 'REVIEWING', 'SIGNED', 'ESCALATED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewStage(st)}
                      className={`py-2 px-3 rounded-xl font-label-sm text-label-sm font-semibold transition-colors ${
                        newStage === st
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="rationale"
                  className="block font-label-sm text-label-sm text-on-surface uppercase tracking-wider mb-1.5"
                >
                  Clinical Rationale (Required):
                </label>
                <textarea
                  id="rationale"
                  required
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Detail clinical rationale, guideline alignment, or basis for override..."
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="clinician-note"
                  className="block font-label-sm text-label-sm text-on-surface uppercase tracking-wider mb-1.5"
                >
                  Patient-Facing Note:
                </label>
                <textarea
                  id="clinician-note"
                  rows={2}
                  value={clinicianNote}
                  onChange={(e) => setClinicianNote(e.target.value)}
                  placeholder="Notes visible to patient on assessment results screen..."
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {(decisionType === 'CLARIFICATION_REQUESTED' || decisionType === 'ESCALATED') && (
                <div>
                  <label
                    htmlFor="action-required-note"
                    className="block font-label-sm text-label-sm text-error uppercase tracking-wider mb-1.5"
                  >
                    Action Required / Escalation Notice:
                  </label>
                  <textarea
                    id="action-required-note"
                    rows={2}
                    value={actionRequiredNote}
                    onChange={(e) => setActionRequiredNote(e.target.value)}
                    placeholder="Specific instructions or tests needed immediately..."
                    className="w-full p-3 rounded-xl bg-error-container/20 border border-error/40 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-error/20"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg font-semibold shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <>
                    <MaterialIcon name="sync" className="animate-spin text-[20px]" />
                    <span>Signing Decision...</span>
                  </>
                ) : (
                  <>
                    <MaterialIcon name="verified" className="text-[20px]" />
                    <span>Submit &amp; Attest Review</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
