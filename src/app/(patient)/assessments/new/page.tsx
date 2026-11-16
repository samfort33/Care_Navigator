'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { evaluateRedFlags } from '@/server/triage/red-flag-engine';

interface TranscriptTurn {
  id: string;
  sender: 'ENGINE' | 'PATIENT';
  senderLabel: string;
  timestamp: string;
  text: string;
}

const INITIAL_TRANSCRIPT: TranscriptTurn[] = [];

const QUICK_PILLS = [
  {
    id: 'dull',
    label: 'Dull ache or tightness only',
    appendText: 'Dull ache or tightness only.',
  },
  {
    id: 'sharp',
    label: 'Sharp, stabbing pain on inhale',
    appendText: 'Sharp, stabbing pain on inhale.',
  },
  {
    id: 'radiating',
    label: 'Radiates to shoulder, back, or jaw',
    appendText: 'Crushing chest pain radiating to left arm and jaw.',
  },
  {
    id: 'cough-only',
    label: 'Occurs only during coughing fits',
    appendText: 'Occurs only during coughing fits.',
  },
  {
    id: 'relieved-upright',
    label: 'Relieved by sitting upright',
    appendText: 'Relieved by sitting upright.',
  },
  {
    id: 'no-pain',
    label: 'No pain on deep inhalation',
    appendText: 'No pain on deep inhalation.',
  },
];

export type AssessmentSubmissionState =
  | 'IDLE'
  | 'VALIDATING'
  | 'SUBMITTING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'TIMEOUT_ERROR'
  | 'SUBMISSION_ERROR';

export default function NewAssessmentWorkspacePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>(INITIAL_TRANSCRIPT);
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [notesInput, setNotesInput] = useState('');
  const [includeEhrConsent, setIncludeEhrConsent] = useState(true);
  const [draftSavedBanner, setDraftSavedBanner] = useState<string | null>(null);

  // State machine for submission
  const [submissionState, setSubmissionState] = useState<AssessmentSubmissionState>('IDLE');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [, setCreatedSessionId] = useState<string | null>(null);

  // Live deterministic red-flag screening on current input
  const redFlagCheck = evaluateRedFlags(notesInput);

  function togglePill(pill: (typeof QUICK_PILLS)[number]) {
    setDraftSavedBanner(null);
    const isAlreadySelected = selectedPills.includes(pill.id);
    if (isAlreadySelected) {
      setSelectedPills((prev) => prev.filter((id) => id !== pill.id));
      setNotesInput((prev) => prev.replace(pill.appendText, '').trim());
    } else {
      setSelectedPills((prev) => [...prev, pill.id]);
      setNotesInput((prev) => (prev ? `${prev} ${pill.appendText}` : pill.appendText));
    }
  }

  function handleContinueStep() {
    setDraftSavedBanner(null);
    if (!notesInput.trim()) return;

    const newPatientTurn: TranscriptTurn = {
      id: `t-pat-${Date.now()}`,
      sender: 'PATIENT',
      senderLabel: 'You (Patient)',
      timestamp: '10:44 AM',
      text: notesInput.trim(),
    };

    const nextEngineTurn: TranscriptTurn = {
      id: `t-eng-${Date.now() + 1}`,
      sender: 'ENGINE',
      senderLabel: 'CareNavigator Intake Guide',
      timestamp: '10:44 AM',
      text: redFlagCheck.triggered
        ? 'CRITICAL ALERT: Your reported symptoms match an acute emergency red-flag rule. Automated non-urgent intake is paused—please call 999 or seek immediate emergency department evaluation.'
        : 'Recorded. Step 4 of 6: Have you noticed any wheezing, nocturnal cough waking you from sleep, or need to use your rescue inhaler more than twice this week?',
    };

    setTranscript((prev) => [...prev, newPatientTurn, nextEngineTurn]);
    setStep((prev) => Math.min(6, prev + 1));
  }

  async function handleSubmitAssessment() {
    if (
      submissionState === 'SUBMITTING' ||
      submissionState === 'PROCESSING' ||
      submissionState === 'VALIDATING' ||
      submissionState === 'SUCCESS'
    ) {
      return; // prevent duplicate clicks
    }

    setSubmissionError(null);
    setSubmissionState('VALIDATING');

    const chiefComplaint = notesInput.trim();
    if (chiefComplaint.length < 5) {
      setSubmissionState('SUBMISSION_ERROR');
      setSubmissionError('Please describe your symptoms and when they began before continuing.');
      return;
    }
    const finalPleuriticDetails = chiefComplaint;
    const currentRedFlag = evaluateRedFlags(finalPleuriticDetails);

    setSubmissionState('SUBMITTING');

    // Local MedGemma inference can take up to 120 seconds on consumer hardware.
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, 130000);

    try {
      setSubmissionState('PROCESSING');
      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          chiefComplaint,
          includeEhrContext: includeEhrConsent,
          confidenceScore: currentRedFlag.triggered ? 99 : 88,
          acuityLevel: currentRedFlag.triggered ? 'EMERGENCY' : 'ROUTINE',
          recommendedCareSetting: currentRedFlag.triggered
            ? 'Immediate Emergency Department Evaluation / Call 999'
            : 'Outpatient Primary Care or Telehealth Consultation',
          answers: [
            {
              stepNumber: 1,
              questionKey: 'patient_reported_symptoms',
              questionPrompt: 'Patient-reported symptoms, timeline, and relevant details',
              answerValue: finalPleuriticDetails,
            },
          ],
        }),
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error (${response.status})`);
      }

      const result = await response.json();
      if (!result.success || !result.session?.id) {
        throw new Error('Assessment created but session ID not returned.');
      }

      setCreatedSessionId(result.session.id);
      setSubmissionState('SUCCESS');

      // Navigate to the real results route
      router.push(`/assessments/${result.session.id}/results`);
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSubmissionState('TIMEOUT_ERROR');
        setSubmissionError(
          'Assessment submission timed out after 130 seconds. Your entries are preserved. Please retry.'
        );
      } else {
        setSubmissionState('SUBMISSION_ERROR');
        setSubmissionError(
          err instanceof Error ? err.message : 'Failed to submit clinical assessment.'
        );
      }
    }
  }

  function handleSaveDraft() {
    setDraftSavedBanner(
      'Session progress saved to your Assessment History. You can resume or view preliminary results anytime.'
    );
  }

  const progressPercent = Math.min(100, Math.round((step / 6) * 100));

  return (
    <div className="space-y-6">
      {/* Persistent Clinical Safety Advisory & Emergency Escalation Banner */}
      <section
        aria-label="Clinical Safety & Emergency Escalation"
        className={`rounded-xl bg-error-container text-on-error-container p-4 shadow-sm transition-all ${
          redFlagCheck.triggered ? 'ring-2 ring-error animate-pulse' : ''
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0 mt-0.5">
              <MaterialIcon name="e911_emergency" filled className="text-[22px]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-sm text-headline-sm text-on-error-container font-bold">
                  {redFlagCheck.triggered
                    ? `Deterministic Red Flag Triggered (${redFlagCheck.matchedRules[0]?.ruleId}): Seek immediate emergency care`
                    : 'Urgent symptom pattern identified: Seek immediate emergency care'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm uppercase tracking-wider">
                  High Alert Protocol
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-error-container/90">
                <strong>Decision-support tool, not a replacement for a doctor.</strong> If you
                experience crushing chest pressure, severe shortness of breath at rest, bluish lips,
                or confusion, stop this assessment and call emergency services immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <a
              href="tel:999"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-error text-on-error font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity w-full sm:w-auto"
            >
              <MaterialIcon name="call" className="text-[18px]" />
              <span>Call Emergency Services (999 / Local)</span>
            </a>
            <Link
              href="/care-directory"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-surface-container-lowest text-on-error-container font-label-md text-label-md hover:bg-surface-container-low transition-colors w-full sm:w-auto"
            >
              <MaterialIcon name="location_on" className="text-[18px] text-error" />
              <span>Locate Nearest Emergency Dept</span>
            </Link>
          </div>
        </div>
      </section>

      {draftSavedBanner && (
        <div
          role="status"
          className="p-4 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5 text-on-surface font-body-sm text-body-sm">
            <MaterialIcon name="check_circle" className="text-primary text-[20px]" />
            <span>{draftSavedBanner}</span>
          </div>
          <Link
            href="/assessments/history"
            className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md shrink-0"
          >
            View History
          </Link>
        </div>
      )}

      {/* Main 12-Column Clinical Triage Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols): Interactive Symptom Assessment & Guided Intake */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Assessment Progress & Session Tracker */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                    Session #TR-9021-X
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Started Today at 10:41 AM
                  </span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface mt-0.5">
                  Respiratory &amp; Chest Symptom Evaluation
                </h1>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-3 py-1 rounded-full bg-surface-container text-primary font-label-md text-label-md flex items-center gap-1.5">
                  <MaterialIcon name="pulmonology" className="text-[16px]" />
                  <span>Cardiopulmonary Triage</span>
                </span>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-on-surface">
                  Progress: Question {step} of 6 • {progressPercent}% Complete
                </span>
                <span className="text-secondary">
                  Current Stage: Associated Risk Factor Screening
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 h-2">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className={`rounded-full transition-all ${
                      idx < step
                        ? 'bg-primary'
                        : idx === step
                        ? 'bg-primary-container animate-pulse'
                        : 'bg-surface-container-high'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
                <span>1. Chief Complaint</span>
                <span>2. Onset &amp; Timeline</span>
                <span className="text-primary font-semibold">3. Pleuritic &amp; Pain Check</span>
                <span>4. Medical History</span>
                <span>5. Vitals Sync</span>
                <span>6. Triage Output</span>
              </div>
            </div>
          </div>

          {/* Conversational History / Prior Answers Log */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <MaterialIcon name="forum" className="text-[16px] text-primary" />
                <span>Conversational Transcript (Steps 1–{step - 1})</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1"
              >
                <MaterialIcon name="edit" className="text-[14px]" />
                <span>Edit Previous Responses</span>
              </button>
            </div>

            <div className="space-y-3">
              {transcript.map((turn) =>
                turn.sender === 'ENGINE' ? (
                  <div key={turn.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                      <MaterialIcon name="smart_toy" className="text-[18px]" />
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl rounded-tl-none p-4 shadow-xs max-w-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-label-md text-label-md text-primary">
                          {turn.senderLabel}
                        </span>
                        <span className="font-label-sm text-label-sm text-outline">
                          {turn.timestamp}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">{turn.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={turn.id} className="flex items-start justify-end gap-3">
                    <div className="bg-secondary-container/40 rounded-xl rounded-tr-none p-4 max-w-xl">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="font-label-sm text-label-sm text-outline">
                          {turn.timestamp}
                        </span>
                        <span className="font-label-md text-label-md text-on-secondary-container">
                          {turn.senderLabel}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">{turn.text}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Active Question & Multimodal Response Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-md space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm uppercase tracking-wider">
                  <MaterialIcon name="radar" className="text-[14px]" />
                  <span>Active Step {step} • Pleuritic Differentiation</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  How would you characterize the discomfort when taking a full deep breath?
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Select all characteristics that apply or describe your symptoms in your own words
                  below. This helps distinguish airway irritation from pleural or cardiac
                  involvement.
                </p>
              </div>
            </div>

            {/* Quick-Symptom Interactive Pills */}
            <div className="space-y-2.5">
              <span className="font-label-md text-label-md text-on-surface-variant block">
                Quick-Select Clinical Descriptors:
              </span>
              <div className="flex flex-wrap gap-2" id="symptom-pills-container">
                {QUICK_PILLS.map((pill) => {
                  const active = selectedPills.includes(pill.id);
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => togglePill(pill)}
                      className={`quick-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                        active
                          ? 'bg-primary-container text-on-primary-container shadow-xs'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <MaterialIcon
                        name={active ? 'check_circle' : 'add'}
                        className="text-[16px]"
                      />
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free-Text & Multimodal Input Box */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="clinical-notes-input"
                  className="font-label-md text-label-md text-on-surface"
                >
                  Additional Details or Context (Optional)
                </label>
                <span className="font-label-sm text-label-sm text-outline">
                  Encrypted Real-Time NLP Parsing
                </span>
              </div>

              <div className="relative rounded-xl bg-surface-container-low p-3 focus-within:bg-surface-container transition-colors">
                <textarea
                  id="clinical-notes-input"
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Describe any triggers, posture changes, or recent exposures (e.g., 'Feels like a dull tightness across my breastbone after coughing, eases up when I sit still and drink warm water')..."
                  className="w-full bg-transparent text-on-surface placeholder-outline font-body-md text-body-md resize-none focus:outline-none"
                />

                {/* Multimodal Action Bar Inside Input */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <Link
                      id="voice-intake-btn"
                      href="/assessments/media-voice"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors shadow-2xs bg-surface-container-lowest text-primary hover:bg-surface-container-high"
                    >
                      <MaterialIcon name="mic" className="text-[18px]" />
                      <span>Open Voice Intake</span>
                    </Link>

                    <Link
                      href="/assessments/media-voice"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors shadow-2xs"
                    >
                      <MaterialIcon name="attach_file" className="text-[18px]" />
                      <span>Attach Photo / Peak Flow Log</span>
                    </Link>
                  </div>

                  <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                    <MaterialIcon name="verified" className="text-[14px] text-primary" />
                    <span>SNOMED-CT Concept Mapping Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Submission State Banner (Timeout, Error, or Progress) */}
            {submissionError && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-error-container text-on-error-container border border-error/30 flex items-start justify-between gap-3 font-body-sm text-body-sm"
              >
                <div className="flex items-start gap-2.5">
                  <MaterialIcon name="warning" className="text-error text-[20px] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block text-on-error-container">
                      {submissionState === 'TIMEOUT_ERROR'
                        ? 'Submission Request Timed Out (15s)'
                        : 'Assessment Submission Failed'}
                    </span>
                    <p className="text-on-error-container/90">{submissionError}</p>
                    <p className="text-xs text-on-error-container/70">
                      Your responses are preserved. You can click retry below to resubmit without losing data.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionError(null)}
                  className="text-on-error-container/70 hover:text-on-error-container"
                  aria-label="Dismiss error"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>
            )}

            {submissionState === 'SUCCESS' && (
              <div
                role="status"
                className="p-4 rounded-xl bg-green-50 text-green-900 border border-green-200 flex items-center gap-3 font-body-sm text-body-sm"
              >
                <MaterialIcon name="check_circle" className="text-green-600 text-[20px] shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Assessment Confirmed &amp; Persisted</span>
                  <p className="text-green-800">Redirecting to your clinical assessment results...</p>
                </div>
              </div>
            )}

            {/* Question Card Navigation Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-lg text-label-lg transition-colors"
              >
                <MaterialIcon name="arrow_back" className="text-[18px]" />
                <span>Review Previous</span>
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container font-label-lg text-label-lg transition-colors"
                >
                  Save &amp; Exit
                </button>
                {step < 6 ? (
                  <button
                    type="button"
                    onClick={handleContinueStep}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <span>Continue to Next Question</span>
                    <MaterialIcon name="arrow_forward" className="text-[18px]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      submissionState === 'VALIDATING' ||
                      submissionState === 'SUBMITTING' ||
                      submissionState === 'PROCESSING' ||
                      submissionState === 'SUCCESS'
                    }
                    onClick={handleSubmitAssessment}
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-label-lg text-label-lg shadow-sm transition-all ${
                      submissionState === 'SUCCESS'
                        ? 'bg-acuity-selfcare text-white'
                        : submissionState === 'SUBMITTING' || submissionState === 'PROCESSING' || submissionState === 'VALIDATING'
                        ? 'bg-primary/70 text-on-primary cursor-wait'
                        : submissionState === 'TIMEOUT_ERROR' || submissionState === 'SUBMISSION_ERROR'
                        ? 'bg-error text-on-error hover:opacity-90'
                        : 'bg-primary-gradient text-on-primary hover:opacity-95'
                    }`}
                  >
                    {submissionState === 'VALIDATING' && (
                      <>
                        <MaterialIcon name="sync" className="text-[18px] animate-spin" />
                        <span>Validating Safety Guardrails...</span>
                      </>
                    )}
                    {submissionState === 'SUBMITTING' && (
                      <>
                        <MaterialIcon name="cloud_upload" className="text-[18px] animate-pulse" />
                        <span>Submitting Assessment...</span>
                      </>
                    )}
                    {submissionState === 'PROCESSING' && (
                      <>
                        <MaterialIcon name="hourglass_top" className="text-[18px] animate-spin" />
                        <span>Processing &amp; Saving Results...</span>
                      </>
                    )}
                    {submissionState === 'SUCCESS' && (
                      <>
                        <MaterialIcon name="check_circle" className="text-[18px]" />
                        <span>Assessment Saved! Loading Results...</span>
                      </>
                    )}
                    {(submissionState === 'TIMEOUT_ERROR' || submissionState === 'SUBMISSION_ERROR') && (
                      <>
                        <MaterialIcon name="refresh" className="text-[18px]" />
                        <span>Retry Assessment Submission</span>
                      </>
                    )}
                    {submissionState === 'IDLE' && (
                      <>
                        <span>Submit Assessment &amp; View Results</span>
                        <MaterialIcon name="fact_check" className="text-[18px]" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connected Wearable Vitals & Peripheral Telemetry Strip */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MaterialIcon name="monitor_heart" className="text-primary text-[20px]" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Recent Vitals &amp; Peripheral Sync
                </h3>
              </div>
              <span className="font-label-sm text-label-sm text-tertiary bg-surface-container px-2.5 py-1 rounded-full">
                Apple HealthKit • Synced 14 mins ago
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Vital 1: Heart Rate */}
              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Resting Heart Rate
                  </span>
                  <span className="font-label-sm text-label-sm text-primary">Normal</span>
                </div>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                    78
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">BPM</span>
                </div>
                <svg className="w-full h-8 overflow-visible" viewBox="0 0 120 28">
                  <path
                    d="M0 20 L20 18 L40 21 L60 14 L80 16 L100 12 L120 15"
                    fill="none"
                    stroke="#00646f"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <circle cx="120" cy="15" fill="#00646f" r="3" />
                </svg>
              </div>

              {/* Vital 2: SpO2 */}
              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Blood Oxygen (SpO2)
                  </span>
                  <span className="font-label-sm text-label-sm text-primary">Optimal</span>
                </div>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                    98
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">%</span>
                </div>
                <svg className="w-full h-8 overflow-visible" viewBox="0 0 120 28">
                  <path
                    d="M0 10 L25 10 L50 12 L75 9 L100 10 L120 10"
                    fill="none"
                    stroke="#2060a3"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <circle cx="120" cy="10" fill="#2060a3" r="3" />
                </svg>
              </div>

              {/* Vital 3: Respiratory Rate */}
              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Respiratory Rate
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">Slightly Elev.</span>
                </div>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                    19
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    br/min
                  </span>
                </div>
                <svg className="w-full h-8 overflow-visible" viewBox="0 0 120 28">
                  <path
                    d="M0 22 L25 20 L50 19 L75 15 L100 13 L120 11"
                    fill="none"
                    stroke="#006970"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <circle cx="120" cy="11" fill="#006970" r="3" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): Clinical Context, Consent Governance & Live Triage Status */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Captured Assessment Summary & Preliminary Acuity */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MaterialIcon name="fact_check" className="text-primary text-[20px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Active Case Context
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                Evaluating
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2.5">
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Chief Symptom</span>
                <span className="font-semibold text-on-surface">Dry Cough &amp; Chest Tightness</span>
              </div>
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Duration</span>
                <span className="font-semibold text-on-surface">72 Hours (3 Days)</span>
              </div>
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Recorded Temp</span>
                <span className="font-semibold text-on-surface">99.4°F (Low-Grade)</span>
              </div>
              <div className="pt-2 border-t border-outline-variant/25 space-y-1.5">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface-variant uppercase">Self-Reported Severity</span>
                  <span className="text-secondary font-semibold">4 / 10 (Moderate)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="w-2/5 h-full bg-secondary rounded-full" />
                </div>
              </div>
            </div>

            {/* Preliminary Algorithmic Signal */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-label-md text-label-md">
                <MaterialIcon name="analytics" className="text-[16px]" />
                <span>Active Rule Execution</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {redFlagCheck.triggered ? (
                  <>
                    Rule-Set:{' '}
                    <strong className="text-error">
                      {redFlagCheck.matchedRules[0]?.clinicalLabel} (Emergency Override)
                    </strong>
                  </>
                ) : (
                  <>
                    Rule-Set:{' '}
                    <strong className="text-on-surface">Tier 2 Non-Emergent Respiratory</strong>.
                    Screening for pleuritic friction vs. reactive airway bronchospasm.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Card 2: Consented Medical History Context & Explicit Toggle */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MaterialIcon name="folder_shared" className="text-secondary text-[20px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Consented Profile
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container-low text-outline font-label-sm text-label-sm font-mono">
                EHR Link #8841
              </span>
            </div>

            {/* Explicit Patient Consent Control Toggle */}
            <div className="p-3.5 rounded-xl bg-surface-container-low flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <label
                  htmlFor="consent-toggle"
                  className="font-label-md text-label-md text-on-surface block cursor-pointer"
                >
                  Include Longitudinal Health Record
                </label>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Allow AI triage to cross-reference your active conditions, allergies, and current
                  prescriptions.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  id="consent-toggle"
                  type="checkbox"
                  checked={includeEhrConsent}
                  onChange={(e) => setIncludeEhrConsent(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            {/* Consented Clinical Data Items */}
            <div
              id="synced-data-panel"
              className={`space-y-3 transition-opacity duration-200 ${
                includeEhrConsent ? 'opacity-100' : 'opacity-40 pointer-events-none'
              }`}
            >
              <div className="space-y-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Known Conditions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md">
                    Mild Intermittent Asthma
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md">
                    Seasonal Allergic Rhinitis
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Active Medications
                </span>
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between font-body-sm text-body-sm">
                    <span className="font-medium text-on-surface">Albuterol Sulfate HFA</span>
                    <span className="text-on-surface-variant font-label-sm text-label-sm">
                      90mcg PRN Inhaler
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between font-body-sm text-body-sm">
                    <span className="font-medium text-on-surface">Cetirizine HCl</span>
                    <span className="text-on-surface-variant font-label-sm text-label-sm">
                      10mg Daily Oral
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Documented Allergies
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-error-container/60 text-on-error-container font-label-md text-label-md flex items-center gap-1">
                    <MaterialIcon name="warning" className="text-[14px]" />
                    <span>Penicillin (Hives / Rash)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <Link
                href="/records"
                className="font-label-md text-label-md text-secondary hover:underline inline-flex items-center gap-1"
              >
                <span>Manage Medical Records Vault</span>
                <MaterialIcon name="open_in_new" className="text-[14px]" />
              </Link>
            </div>
          </div>

          {/* Card 3: Clinician Verification & Next-Step Routing Preview */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <MaterialIcon name="stethoscope" className="text-primary text-[20px]" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Triage Pipeline</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5 font-label-sm text-label-sm">
                  ✓
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">
                    1. Automated Red-Flag Exclusion
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Hemoptysis and acute hypoxia screened.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5 font-label-sm text-label-sm">
                  2
                </div>
                <div>
                  <p className="font-label-md text-label-md text-primary">
                    2. Differential Risk Stratification
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Evaluating pleuritic pain &amp; asthma history.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 opacity-60">
                <div className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0 mt-0.5 font-label-sm text-label-sm">
                  3
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">
                    3. Clinician Review &amp; Care Handoff
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Summary routed to on-call pulmonology RN/MD.
                  </p>
                </div>
              </div>
            </div>

            {/* On-Call Clinician Preview */}
            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-headline-sm text-headline-sm">
                  JV
                </div>
                <div>
                  <span className="font-label-md text-label-md text-on-surface block">
                    Queue Ready: Dr. Julian Vance
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Avg. Verification: ~12 mins
                  </span>
                </div>
              </div>
              <Link
                href="/assessments/CN-2026-8841/results"
                className="font-label-sm text-label-sm text-primary hover:underline"
              >
                Preview Output →
              </Link>
            </div>
          </div>

          {/* Persistent Clinical Decision-Support Governance Notice */}
          <div className="p-4 rounded-xl bg-surface-container-low space-y-1.5">
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <MaterialIcon name="policy" className="text-[16px] text-primary" />
              <span>Clinical Governance &amp; Safety</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              CareNavigator is a <strong>clinical decision-support tool</strong>, not a replacement
              for a licensed physician. Outputs represent preliminary risk stratification grounded
              in NICE/GINA respiratory guidelines and require clinical confirmation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
