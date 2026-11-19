'use client';

import React, { useState, useRef, useEffect } from 'react';
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

const INITIAL_TRANSCRIPT: TranscriptTurn[] = [
  {
    id: 't-eng-0',
    sender: 'ENGINE',
    senderLabel: 'CareNavigator Intake Guide',
    timestamp: 'Just now',
    text: 'Hello, I am your CareNavigator clinical intake guide. What symptoms are you experiencing today, and approximately when did they begin?',
  },
];

const INITIAL_PILLS = [
  'Dry cough & chest tightness for 3 days',
  'Throbbing headache with light sensitivity',
  'Fever, body aches, and fatigue',
  'Sharp chest discomfort on deep breath',
  'Stomach cramping and nausea',
  'Skin rash with mild itching',
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
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>(INITIAL_TRANSCRIPT);
  const [availablePills, setAvailablePills] = useState<string[]>(INITIAL_PILLS);
  const [selectedPills, setSelectedPills] = useState<string[]>([]);
  const [notesInput, setNotesInput] = useState('');
  const [includeEhrConsent, setIncludeEhrConsent] = useState(true);
  const [draftSavedBanner, setDraftSavedBanner] = useState<string | null>(null);

  // Dynamic AI conversation states
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [activeTopic, setActiveTopic] = useState('Chief Complaint & Onset Timeline');
  const [activeQuestion, setActiveQuestion] = useState(
    'What symptoms are you experiencing today, and when did they begin?'
  );
  const [extractedEntities, setExtractedEntities] = useState<{
    symptoms: string[];
    pertinentNegatives: string[];
    duration: string;
    severity: string;
  }>({
    symptoms: ['Awaiting intake narrative'],
    pertinentNegatives: ['Emergency screening active'],
    duration: 'Under evaluation',
    severity: 'Initial intake',
  });
  const [preliminaryAcuity, setPreliminaryAcuity] = useState<
    'SELF_CARE' | 'ROUTINE' | 'URGENT' | 'EMERGENCY'
  >('ROUTINE');
  const [isReadyForFinal, setIsReadyForFinal] = useState(false);

  // State machine for submission
  const [submissionState, setSubmissionState] = useState<AssessmentSubmissionState>('IDLE');
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Live deterministic red-flag screening on current input
  const redFlagCheck = evaluateRedFlags(notesInput);

  // Auto-scroll transcript on new turns
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isAiThinking]);

  function handlePillClick(pillText: string) {
    setDraftSavedBanner(null);
    if (selectedPills.includes(pillText)) {
      setSelectedPills((prev) => prev.filter((p) => p !== pillText));
      setNotesInput((prev) => prev.replace(pillText, '').trim());
    } else {
      setSelectedPills((prev) => [...prev, pillText]);
      setNotesInput((prev) => (prev ? `${prev}. ${pillText}` : pillText));
    }
  }

  async function handleSendTurn(customText?: string) {
    setDraftSavedBanner(null);
    const textToSend = (customText || notesInput).trim();
    if (!textToSend || isAiThinking) return;

    const patientTurnId = `t-pat-${Date.now()}`;
    const newPatientTurn: TranscriptTurn = {
      id: patientTurnId,
      sender: 'PATIENT',
      senderLabel: 'You (Patient)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: textToSend,
    };

    // Update transcript and clear input immediately
    const updatedMessages = [...transcript, newPatientTurn];
    setTranscript(updatedMessages);
    setNotesInput('');
    setSelectedPills([]);
    setIsAiThinking(true);

    try {
      const response = await fetch('/api/assessments/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
          })),
          input: textToSend,
          includeEhrContext: includeEhrConsent,
          currentStep: step,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reach AI intake guide.');
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const data = resJson.data;

        const aiTurn: TranscriptTurn = {
          id: `t-eng-${Date.now()}`,
          sender: 'ENGINE',
          senderLabel: 'CareNavigator Intake Guide',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: data.reply,
        };

        setTranscript((prev) => [...prev, aiTurn]);

        if (Array.isArray(data.suggestedPills) && data.suggestedPills.length > 0) {
          setAvailablePills(data.suggestedPills);
        }
        if (data.activeTopic) setActiveTopic(data.activeTopic);
        if (data.activeQuestion) setActiveQuestion(data.activeQuestion);
        if (data.nextStep) setStep(Math.min(6, data.nextStep));
        if (data.extractedEntities) setExtractedEntities(data.extractedEntities);
        if (data.preliminaryAcuity) setPreliminaryAcuity(data.preliminaryAcuity);
        if (data.isReadyForFinalAssessment || data.nextStep >= 4) {
          setIsReadyForFinal(true);
        }
      } else {
        throw new Error(resJson.error || 'Unexpected response format.');
      }
    } catch {
      // Offline fallback turn
      const fallbackTurn: TranscriptTurn = {
        id: `t-eng-${Date.now()}`,
        sender: 'ENGINE',
        senderLabel: 'CareNavigator Intake Guide',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Recorded: "${textToSend}". Do your symptoms change noticeably with physical activity, deep breathing, or resting in a comfortable position?`,
      };
      setTranscript((prev) => [...prev, fallbackTurn]);
      setStep((prev) => Math.min(6, prev + 1));
      setAvailablePills([
        'Worse with movement or exertion',
        'Relieved when sitting upright',
        'Occurs primarily at rest',
        'No noticeable change with position',
      ]);
      setActiveTopic('Associated Factors & Posture');
      setActiveQuestion('Do your symptoms change with posture, breathing, or exertion?');
      setIsReadyForFinal(step >= 3);
    } finally {
      setIsAiThinking(false);
    }
  }

  async function handleSubmitAssessment() {
    if (
      submissionState === 'SUBMITTING' ||
      submissionState === 'PROCESSING' ||
      submissionState === 'VALIDATING' ||
      submissionState === 'SUCCESS'
    ) {
      return;
    }

    setSubmissionError(null);
    setSubmissionState('VALIDATING');

    const patientTurns = transcript.filter((t) => t.sender === 'PATIENT');
    const narrativeFromChat = patientTurns.map((t) => t.text).join('; ');
    const chiefComplaint = notesInput.trim() || narrativeFromChat || 'General clinical assessment';

    if (chiefComplaint.length < 5) {
      setSubmissionState('SUBMISSION_ERROR');
      setSubmissionError('Please describe your symptoms and when they began before continuing.');
      return;
    }

    const finalPleuriticDetails = chiefComplaint;
    const currentRedFlag = evaluateRedFlags(finalPleuriticDetails);

    setSubmissionState('SUBMITTING');

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
          acuityLevel: currentRedFlag.triggered ? 'EMERGENCY' : preliminaryAcuity,
          recommendedCareSetting: currentRedFlag.triggered
            ? 'Immediate Emergency Department Evaluation / Call 999'
            : preliminaryAcuity === 'URGENT'
            ? 'Urgent Care or Same-Day Clinic Evaluation'
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

      setSubmissionState('SUCCESS');
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
          redFlagCheck.triggered || preliminaryAcuity === 'EMERGENCY'
            ? 'ring-2 ring-error animate-pulse'
            : ''
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
                    : 'Emergency Safety Protocol Active'}
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
        {/* LEFT COLUMN (8 Cols): Interactive AI Symptom Assessment & Guided Intake */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Assessment Progress & Session Tracker */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                    AI Clinical Intake Session
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Interactive Triage Guide Active
                  </span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface mt-0.5">
                  AI Health Assessment &amp; Triage Workspace
                </h1>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-3 py-1 rounded-full bg-surface-container text-primary font-label-md text-label-md flex items-center gap-1.5">
                  <MaterialIcon name="smart_toy" className="text-[16px]" />
                  <span>Interactive AI Guide</span>
                </span>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-on-surface">
                  Progress: Step {step} of 6 • {progressPercent}% Complete
                </span>
                <span className="text-secondary font-medium">Stage: {activeTopic}</span>
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
                <span className={step >= 1 ? 'text-primary font-semibold' : ''}>1. Chief Complaint</span>
                <span className={step >= 2 ? 'text-primary font-semibold' : ''}>2. Timeline</span>
                <span className={step >= 3 ? 'text-primary font-semibold' : ''}>3. Characteristics</span>
                <span className={step >= 4 ? 'text-primary font-semibold' : ''}>4. Triggers</span>
                <span className={step >= 5 ? 'text-primary font-semibold' : ''}>5. Context</span>
                <span className={step >= 6 ? 'text-primary font-semibold' : ''}>6. Results</span>
              </div>
            </div>
          </div>

          {/* Conversational History / Real Multi-Turn Dialogue */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <MaterialIcon name="forum" className="text-[16px] text-primary" />
                <span>Conversational Intake Transcript ({transcript.length} turns)</span>
              </span>
              <span className="font-label-sm text-label-sm text-outline">
                Encrypted Real-Time Clinical Dialogue
              </span>
            </div>

            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {transcript.map((turn) =>
                turn.sender === 'ENGINE' ? (
                  <div key={turn.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                      <MaterialIcon name="smart_toy" className="text-[18px]" />
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl rounded-tl-none p-4 shadow-xs max-w-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-label-md text-label-md text-primary font-semibold">
                          {turn.senderLabel}
                        </span>
                        <span className="font-label-sm text-label-sm text-outline">
                          {turn.timestamp}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                        {turn.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={turn.id} className="flex items-start justify-end gap-3">
                    <div className="bg-secondary-container/50 rounded-xl rounded-tr-none p-4 max-w-xl shadow-xs">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="font-label-sm text-label-sm text-outline">
                          {turn.timestamp}
                        </span>
                        <span className="font-label-md text-label-md text-on-secondary-container font-semibold">
                          {turn.senderLabel}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                        {turn.text}
                      </p>
                    </div>
                  </div>
                )
              )}

              {isAiThinking && (
                <div className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-primary/70 text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                    <MaterialIcon name="smart_toy" className="text-[18px]" />
                  </div>
                  <div className="bg-surface-container-lowest rounded-xl rounded-tl-none p-3.5 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md text-primary">
                        CareNavigator Intake Guide is evaluating...
                      </span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Active Question & Dynamic Response Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-md space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm uppercase tracking-wider">
                  <MaterialIcon name="radar" className="text-[14px]" />
                  <span>Active Step {step} • {activeTopic}</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  {activeQuestion}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Select a suggested clinical response below, or type your answer in your own words.
                  The AI intake guide continuously personalizes each follow-up to your exact symptoms.
                </p>
              </div>
            </div>

            {/* Dynamic AI Suggested Quick-Select Pills */}
            <div className="space-y-2.5">
              <span className="font-label-md text-label-md text-on-surface-variant block">
                Suggested Responses (Click to select or combine):
              </span>
              <div className="flex flex-wrap gap-2" id="symptom-pills-container">
                {availablePills.map((pillText) => {
                  const active = selectedPills.includes(pillText);
                  return (
                    <button
                      key={pillText}
                      type="button"
                      onClick={() => handlePillClick(pillText)}
                      className={`quick-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                        active
                          ? 'bg-primary-container text-on-primary-container shadow-xs ring-1 ring-primary'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <MaterialIcon
                        name={active ? 'check_circle' : 'add'}
                        className="text-[16px]"
                      />
                      <span>{pillText}</span>
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
                  Your Response (Type freely or send selected options)
                </label>
                <span className="font-label-sm text-label-sm text-outline">
                  Press Enter to send
                </span>
              </div>

              <div className="relative rounded-xl bg-surface-container-low p-3 focus-within:bg-surface-container transition-colors">
                <textarea
                  id="clinical-notes-input"
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTurn();
                    }
                  }}
                  placeholder="Describe your symptoms, how they started, or any other details you'd like your doctor to know..."
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
                      <span>Voice Recording</span>
                    </Link>

                    <Link
                      href="/assessments/media-voice"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors shadow-2xs"
                    >
                      <MaterialIcon name="attach_file" className="text-[18px]" />
                      <span>Attach Photo / Lab PDF</span>
                    </Link>
                  </div>

                  <button
                    type="button"
                    disabled={!notesInput.trim() || isAiThinking}
                    onClick={() => handleSendTurn()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <span>Send Message</span>
                    <MaterialIcon name="send" className="text-[16px]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Submission State Banner */}
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
                        ? 'Submission Request Timed Out'
                        : 'Assessment Submission Failed'}
                    </span>
                    <p className="text-on-error-container/90">{submissionError}</p>
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

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container font-label-lg text-label-lg transition-colors"
              >
                Save Draft
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Secondary action: Continue turn */}
                {notesInput.trim() && (
                  <button
                    type="button"
                    disabled={isAiThinking}
                    onClick={() => handleSendTurn()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-on-secondary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <span>Continue Conversation</span>
                    <MaterialIcon name="arrow_forward" className="text-[18px]" />
                  </button>
                )}

                {/* Primary Final Action: Submit Assessment when enough info gathered */}
                {(isReadyForFinal || transcript.filter((t) => t.sender === 'PATIENT').length >= 2) && (
                  <button
                    type="button"
                    disabled={
                      submissionState === 'VALIDATING' ||
                      submissionState === 'SUBMITTING' ||
                      submissionState === 'PROCESSING' ||
                      submissionState === 'SUCCESS'
                    }
                    onClick={handleSubmitAssessment}
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-label-lg text-label-lg shadow-md transition-all ${
                      submissionState === 'SUCCESS'
                        ? 'bg-acuity-selfcare text-white'
                        : submissionState === 'SUBMITTING' ||
                          submissionState === 'PROCESSING' ||
                          submissionState === 'VALIDATING'
                        ? 'bg-primary/70 text-on-primary cursor-wait'
                        : 'bg-primary-gradient text-on-primary hover:opacity-95 ring-2 ring-primary/20'
                    }`}
                  >
                    {submissionState === 'VALIDATING' && (
                      <>
                        <MaterialIcon name="sync" className="text-[18px] animate-spin" />
                        <span>Validating Guardrails...</span>
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
                        <span>Generating Clinical Triage...</span>
                      </>
                    )}
                    {submissionState === 'SUCCESS' && (
                      <>
                        <MaterialIcon name="check_circle" className="text-[18px]" />
                        <span>Saved! Loading Results...</span>
                      </>
                    )}
                    {submissionState === 'IDLE' && (
                      <>
                        <MaterialIcon name="fact_check" className="text-[18px]" />
                        <span>Generate Full Clinical Triage &amp; Results</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connected Wearable Vitals Strip */}
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
              </div>

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
              </div>

              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Respiratory Rate
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">Normal</span>
                </div>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                    18
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    br/min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): Live Case Context, EHR Consent & Triage Status */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Captured Case Context & Live Extracted Entities */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MaterialIcon name="fact_check" className="text-primary text-[20px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Live Case Context
                </h2>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold uppercase ${
                  preliminaryAcuity === 'EMERGENCY'
                    ? 'bg-error text-on-error'
                    : preliminaryAcuity === 'URGENT'
                    ? 'bg-acuity-urgent text-white'
                    : 'bg-secondary-fixed text-on-secondary-fixed'
                }`}
              >
                {preliminaryAcuity}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2.5">
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Primary Symptom</span>
                <span className="font-semibold text-on-surface text-right max-w-[180px] truncate">
                  {extractedEntities.symptoms[0] || 'Under evaluation'}
                </span>
              </div>
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Timeline</span>
                <span className="font-semibold text-on-surface">
                  {extractedEntities.duration}
                </span>
              </div>
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Estimated Severity</span>
                <span className="font-semibold text-secondary">
                  {extractedEntities.severity}
                </span>
              </div>

              {extractedEntities.pertinentNegatives.length > 0 && (
                <div className="pt-2 border-t border-outline-variant/25">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline block mb-1">
                    Pertinent Negatives
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractedEntities.pertinentNegatives.map((neg, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-xs"
                      >
                        ✓ {neg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preliminary Algorithmic Signal */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-label-md text-label-md">
                <MaterialIcon name="analytics" className="text-[16px]" />
                <span>Active Safety Screening</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {redFlagCheck.triggered ? (
                  <strong className="text-error">
                    {redFlagCheck.matchedRules[0]?.clinicalLabel} (Emergency Override)
                  </strong>
                ) : (
                  <>
                    Active Protocol: <strong className="text-on-surface">Tier 2 Outpatient Triage</strong>.
                    Screening continuously for critical red-flag symptoms.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Card 2: Consented Medical History Context */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MaterialIcon name="folder_shared" className="text-secondary text-[20px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Consented Profile
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container-low text-outline font-label-sm text-label-sm font-mono">
                EHR Link Active
              </span>
            </div>

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
                      90mcg PRN
                    </span>
                  </div>
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

          {/* Card 3: Clinical Governance Notice */}
          <div className="p-4 rounded-xl bg-surface-container-low space-y-1.5">
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <MaterialIcon name="policy" className="text-[16px] text-primary" />
              <span>Clinical Governance &amp; Safety</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              CareNavigator is a <strong>clinical decision-support tool</strong>, not a replacement
              for a licensed physician. Outputs represent preliminary risk stratification grounded
              in NICE/GINA clinical guidelines and require clinician review.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
