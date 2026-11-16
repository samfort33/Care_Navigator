'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import type { UserRole } from '@/lib/design-tokens';

type HistoryFilterTab = 'ALL' | 'PENDING' | 'COMPLETED' | 'DRAFT' | 'FAILED' | 'CANCELLED';

interface TimelineEntry {
  id: string;
  refCode: string;
  title: string;
  dateLabel: string;
  statusCategory: Exclude<HistoryFilterTab, 'ALL'>;
  statusBadgeLabel: string;
  urgencyLabel: string;
  summaryText: string;
  secondaryNoteTitle?: string;
  secondaryNoteBody?: string;
  modalityLabel: string;
  guidelineLabel: string;
  resultsUrl?: string;
}

const TIMELINE_ENTRIES: TimelineEntry[] = [
  {
    id: 'tl-1',
    refCode: '#AS-9941',
    title: 'Subacute Pleuritic Chest Discomfort & Exertional Fatigue',
    dateLabel: 'Today, Oct 24, 2024 • 09:42 AM',
    statusCategory: 'PENDING',
    statusBadgeLabel: 'Pending Clinician Action',
    urgencyLabel: 'Urgency: Prompt Evaluation (24h)',
    summaryText:
      'Reported 3-day history of intermittent left-sided chest tightness worse on deep inspiration, mild shortness of breath climbing stairs, and resting HR 88 bpm. Automated red-flag rule excluded acute STEMI criteria but triggered mandatory human clinician verification.',
    modalityLabel: 'Multimodal (Text + Apple Watch ECG)',
    guidelineLabel: 'AHA/ACC Chest Pain Pathway',
  },
  {
    id: 'tl-2',
    refCode: '#AS-8910',
    title: 'Seasonal Allergic Rhinitis & Sinus Pressure Evaluation',
    dateLabel: 'Oct 11, 2024 • 04:15 PM',
    statusCategory: 'COMPLETED',
    statusBadgeLabel: 'Completed & Verified',
    urgencyLabel: 'Urgency: Routine / Self-Care',
    summaryText:
      '7-day history of clear rhinorrhea, bilateral maxillary sinus fullness, and post-nasal drip without fever or purulent discharge.',
    secondaryNoteTitle: 'Clinician Final Recommendation — Dr. Marcus Vance, MD (Oct 11, 05:02 PM)',
    secondaryNoteBody:
      '"Concur with AI triage assessment of uncomplicated allergic rhinosinusitis. Recommend intranasal fluticasone 50mcg daily and isotonic saline irrigation. Return or escalate if fever >101.5°F or visual changes develop."',
    modalityLabel: 'Voice Guided Intake (2m 40s)',
    guidelineLabel: 'IDSA Sinusitis Guideline',
  },
  {
    id: 'tl-3',
    refCode: 'Draft Session',
    title: 'Migraine Aura & Visual Sensitivity Check-In',
    dateLabel: 'Oct 03, 2024 • Saved at 11:20 PM',
    statusCategory: 'DRAFT',
    statusBadgeLabel: 'Incomplete Draft (60% Progress)',
    urgencyLabel: 'Step 3 of 5 Saved',
    summaryText:
      'You started describing unilateral throbbing headache with photophobia but paused before completing neurological red-flag screening. No clinical recommendation has been generated yet.',
    modalityLabel: 'Text Questionnaire',
    guidelineLabel: 'Neuro-Cef-204',
  },
  {
    id: 'tl-4',
    refCode: '#AS-7402',
    title: 'Minor Ankle Sprain & Lateral Swelling Post-Exercise',
    dateLabel: 'Sep 19, 2024 • 02:10 PM',
    statusCategory: 'CANCELLED',
    statusBadgeLabel: 'Cancelled by Patient',
    urgencyLabel: 'Withdrawn Prior to Review',
    summaryText:
      'Session was manually cancelled by the patient after initial intake ("Visited walk-in orthopedic clinic directly"). Clinician review request #CR-7104 was closed without charge.',
    modalityLabel: 'Media Upload (1 Photo)',
    guidelineLabel: 'Ottawa Ankle Rules',
  },
  {
    id: 'tl-5',
    refCode: '#AS-6124',
    title: 'Voice-Guided Evening Symptom Check & Audio Upload',
    dateLabel: 'Sep 04, 2024 • 08:55 PM',
    statusCategory: 'FAILED',
    statusBadgeLabel: 'Submission Failed (Sync Timeout)',
    urgencyLabel: 'Error Code: NET-AUDIO-504',
    summaryText:
      'The voice audio stream was interrupted due to a network connection drop before clinical entity extraction could complete. Your local encrypted draft is preserved and can be retried.',
    modalityLabel: 'Voice Stream Interrupted',
    guidelineLabel: 'Retry Available',
  },
];

export interface LiveHistorySessionRecord {
  id: string;
  sessionCode: string;
  chiefComplaint: string;
  status: string;
  acuityLevel: string;
  plainLanguageSummary?: string | null;
  createdAt: string | Date;
  clinicianReview?: {
    reviewStage?: string | null;
    clinicianNotes?: string | null;
    clinicianNote?: string | null;
    clinician?: {
      id?: string | null;
      name?: string | null;
      specialty?: string | null;
      title?: string | null;
    } | null;
  } | null;
  citations?: Array<{
    guideline?: {
      code?: string | null;
      title?: string | null;
    } | null;
  }> | null;
  isSeedFixture?: boolean;
}

export function AssessmentHistoryTracker({
  userRole,
  liveSessions = [],
}: {
  userRole: UserRole;
  liveSessions?: LiveHistorySessionRecord[];
}) {
  const [activeStage, setActiveStage] = useState<number>(4);
  const [filterTab, setFilterTab] = useState<HistoryFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [clarificationNote, setClarificationNote] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const mappedLiveEntries: TimelineEntry[] = (liveSessions || []).map((s) => {
    let statusCategory: Exclude<HistoryFilterTab, 'ALL'> = 'PENDING';
    if (s.status === 'VERIFIED') statusCategory = 'COMPLETED';
    else if (s.status === 'DRAFT') statusCategory = 'DRAFT';
    else if (s.status === 'FAILED') statusCategory = 'FAILED';
    else if (s.status === 'CANCELLED') statusCategory = 'CANCELLED';

    const dateFormatted = new Date(s.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const clinicianNote = s.clinicianReview?.clinicianNotes || s.clinicianReview?.clinicianNote;

    return {
      id: s.id,
      refCode: s.sessionCode,
      title: s.chiefComplaint,
      dateLabel: dateFormatted,
      statusCategory,
      statusBadgeLabel:
        s.status === 'VERIFIED'
          ? 'Completed & Verified'
          : s.status === 'ACTION_REQUIRED'
          ? 'Action Required'
          : s.status === 'PENDING_REVIEW'
          ? 'Pending Clinician Action'
          : s.status,
      urgencyLabel: `Acuity: ${s.acuityLevel}`,
      summaryText: s.plainLanguageSummary || s.chiefComplaint,
      resultsUrl: `/assessments/${s.id}/results`,
      secondaryNoteTitle: clinicianNote
        ? `Clinician Review — ${s.clinicianReview?.clinician?.name || 'Physician'}`
        : undefined,
      secondaryNoteBody: clinicianNote || undefined,
      modalityLabel: 'Interactive Intake',
      guidelineLabel: s.citations?.[0]?.guideline?.code || 'CDS Standard Protocol',
    };
  });

  const allEntries = mappedLiveEntries.length > 0 ? [...mappedLiveEntries, ...TIMELINE_ENTRIES] : TIMELINE_ENTRIES;

  const filteredEntries = allEntries.filter((entry) => {
    const matchesTab = filterTab === 'ALL' || entry.statusCategory === filterTab;
    const matchesSearch =
      !searchQuery.trim() ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.refCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.summaryText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  function handleClarificationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clarificationNote.trim()) return;
    setActiveStage(5);
    setShowMessageModal(false);
    setBannerMessage(
      'Clarification and home SpO2 response transmitted to Dr. Sarah Chen, MD. Review Tracker advanced to Stage 5 (Recommendation Updated).'
    );
    setClarificationNote('');
  }

  function handleClinicianSignOff() {
    setActiveStage(6);
    setBannerMessage(
      'Clinician Sign-Off Complete: Final Care Plan for #AS-9941 attested and released to patient portal.'
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header & Global Action */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-wider mb-1">
            <MaterialIcon name="clinical_notes" className="text-[16px]" />
            <span>Clinical Continuity &amp; Audit</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            Assessment History &amp; Clinician Review Tracker
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1 max-w-3xl">
            Monitor real-time physician validation of your recent AI triage sessions, respond to
            clinical clarification requests, and inspect your longitudinal assessment archive.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() =>
              setBannerMessage('Exported longitudinal assessment log (#AS-9941 through #AS-6124).')
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-lg text-label-lg shadow-xs transition-colors"
          >
            <MaterialIcon name="download" className="text-[18px] text-primary" />
            <span>Export Full Log</span>
          </button>
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity"
          >
            <MaterialIcon name="add_circle" className="text-[18px]" />
            <span>New Health Assessment</span>
          </Link>
        </div>
      </div>

      {/* Mandatory Clinical Safety & Dynamic Symptom Escalation Banner */}
      <section
        aria-label="Clinical Safety & Dynamic Escalation Advisory"
        className="rounded-xl bg-surface-container-low p-4 border-l-4 border-primary shadow-2xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 mt-0.5">
              <MaterialIcon name="health_and_safety" className="text-[22px]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Clinical Decision-Support &amp; Dynamic Symptom Advisory
                </h2>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-mono">
                  RULE REF: CDS-NOTIF-09
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                <strong>Decision-support tool, not a replacement for a doctor.</strong> Past
                assessments reflect only the symptoms reported at that specific timestamp.{' '}
                <strong className="text-on-surface">
                  If your symptoms worsen, change, or new red-flag signs appear while awaiting
                  clinician review, do not wait for asynchronous sign-off
                </strong>
                —start an updated assessment or call <strong>999</strong> / visit the nearest
                emergency department immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="tel:999"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-error-container text-on-error-container hover:bg-error hover:text-on-error font-label-md text-label-md transition-colors"
            >
              <MaterialIcon name="emergency" className="text-[16px]" />
              <span>Emergency 999 Protocol</span>
            </a>
          </div>
        </div>
      </section>

      {bannerMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-3 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2 text-on-surface">
            <MaterialIcon name="check_circle" className="text-primary text-[18px]" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}

      {/* SECTION A: ACTIVE CLINICIAN REVIEW TRACKER (7 CANONICAL STATES) */}
      <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-container">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                {activeStage === 4
                  ? 'Stage 4 of 7: Patient Clarification Requested'
                  : activeStage === 5
                  ? 'Stage 5 of 7: Recommendation Updated'
                  : 'Stage 6 of 7: Review Completed'}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant font-mono">
                Active Review Ref #CR-88219 • Linked to Assessment #AS-9941
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Subacute Pleuritic Chest Discomfort &amp; Exertional Fatigue
            </h2>
          </div>

          <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-xl shrink-0">
            <div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-headline-sm text-headline-sm">
              SC
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface">
                Assigned Reviewer: Dr. Sarah Chen, MD
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">
                Board-Certified Internal Medicine • SLA Target: &lt; 2 Hours
              </div>
            </div>
          </div>
        </div>

        {/* 7-Stage Canonical Clinician Review Lifecycle Stepper */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
              Clinician Verification Lifecycle (7 Canonical States)
            </span>
            <span className="font-label-sm text-label-sm text-primary">
              Last updated: 14 mins ago (10:28 AM)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
            {[
              {
                stage: 1,
                title: '1. Requested',
                desc: 'Submitted Today, 09:42 AM by Patient.',
              },
              {
                stage: 2,
                title: '2. Awaiting Assignment',
                desc: 'Routed to Internal Medicine Queue (09:43 AM).',
              },
              {
                stage: 3,
                title: '3. In Progress',
                desc: 'Claimed by Dr. S. Chen, MD at 10:05 AM.',
              },
              {
                stage: 4,
                title: '4. Action Required',
                desc: 'Additional information requested from patient (10:28 AM).',
              },
              {
                stage: 5,
                title: '5. Recommendation',
                desc: 'Clinician updates or signs off on care urgency.',
              },
              {
                stage: 6,
                title: '6. Completed',
                desc: 'Final signed summary saved to Health Vault.',
              },
              {
                stage: 7,
                title: '7. Escalation Path',
                desc: 'Direct urgent clinic or ED handoff if red flags emerge.',
              },
            ].map((item) => {
              const isDone = item.stage < activeStage;
              const isCurrent = item.stage === activeStage;
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => setActiveStage(item.stage)}
                  className={`text-left p-3 rounded-xl flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'bg-error-container/50 ring-2 ring-error'
                      : isDone
                      ? 'bg-surface-container-low border-t-4 border-primary'
                      : 'bg-surface-container-low/60 border-t-4 border-outline-variant'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-label-sm text-label-sm ${
                          isCurrent
                            ? 'bg-error text-on-error'
                            : isDone
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-highest text-on-surface-variant'
                        }`}
                      >
                        {isDone ? '✓' : item.stage}
                      </span>
                      <span
                        className={`font-label-sm text-label-sm font-semibold ${
                          isCurrent
                            ? 'text-error'
                            : isDone
                            ? 'text-primary'
                            : 'text-outline'
                        }`}
                      >
                        {isCurrent ? 'Active' : isDone ? 'Done' : 'Pending'}
                      </span>
                    </div>
                    <h3 className="font-label-md text-label-md text-on-surface">{item.title}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Required Callout Box (Supporting State 4 + Clinician Sign-Off Controls) */}
        <div className="rounded-xl bg-surface-container-low p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-l-4 border-error">
          <div className="flex items-start gap-3.5 max-w-3xl">
            <div className="w-10 h-10 rounded-xl bg-error-container text-on-error-container flex items-center justify-center shrink-0 mt-0.5">
              <MaterialIcon name="mark_chat_unread" className="text-[22px]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Action Required from You: Additional Symptom Details Needed
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm">
                  Dr. Sarah Chen, MD • 10:28 AM
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                &ldquo;Thank you for submitting your respiratory triage log. Before I finalize your
                outpatient care recommendation, please clarify:{' '}
                <strong className="text-on-surface">
                  (1) Have you experienced any calf swelling or recent long-haul travel? (2) Please
                  attach or enter your resting pulse oximeter (SpO2) reading from this morning.
                </strong>
                &rdquo;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <Link
              href="/assessments/media-voice"
              className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg shadow-xs transition-colors"
            >
              <MaterialIcon name="upload_file" className="text-[18px]" />
              <span>Upload Clarification / Documents</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowMessageModal((prev) => !prev)}
              className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container-high font-label-lg text-label-lg shadow-xs transition-colors"
            >
              <MaterialIcon name="reply" className="text-[18px]" />
              <span>Respond via Secure Message</span>
            </button>
            <Link
              href="/assessments/CN-2026-8841/results"
              className="inline-flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"
            >
              <span>Review Original Assessment</span>
            </Link>
            {(userRole === 'CLINICIAN' || userRole === 'ADMIN') && (
              <button
                type="button"
                onClick={handleClinicianSignOff}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-label-lg text-label-lg shadow-xs hover:opacity-95"
              >
                <MaterialIcon name="verified" className="text-[18px]" />
                <span>Clinician Sign-Off (#CR-88219)</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Secure Clarification Response Form */}
        {showMessageModal && (
          <form
            onSubmit={handleClarificationSubmit}
            className="rounded-xl bg-surface-container p-4 space-y-3 border border-primary/30"
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="clarification-input"
                className="font-headline-sm text-headline-sm text-on-surface"
              >
                Send Clarification to Dr. Sarah Chen, MD (Ref #CR-88219)
              </label>
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <MaterialIcon name="close" className="text-[18px]" />
              </button>
            </div>
            <textarea
              id="clarification-input"
              rows={3}
              required
              value={clarificationNote}
              onChange={(e) => setClarificationNote(e.target.value)}
              placeholder="e.g., No calf swelling or recent flights. Morning resting SpO2 on home pulse oximeter is 98% on room air."
              className="w-full rounded-lg bg-surface-container-lowest p-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5"
              >
                <MaterialIcon name="send" className="text-[16px]" />
                <span>Transmit to Reviewing Physician</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* SECTION B: COMPREHENSIVE ASSESSMENT HISTORY TIMELINE */}
      <section className="space-y-4">
        {/* Filter & Search Bar */}
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <MaterialIcon
                name="search"
                className="text-outline text-[18px] absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by symptom, assessment ID (#AS-xxxx), or clinician..."
                aria-label="Filter assessment history"
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface-container-low text-on-surface placeholder-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container transition-colors"
              />
            </div>
          </div>

          {/* Status Filter Tabs (Consistent Tab Bar Dimensions per AGENTS.md 1.3) */}
          <div
            role="tablist"
            aria-label="Assessment status filters"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
          >
            {(
              [
                { id: 'ALL', label: 'All (5)' },
                { id: 'PENDING', label: 'Pending', dotColor: 'bg-secondary' },
                { id: 'COMPLETED', label: 'Completed', dotColor: 'bg-primary' },
                { id: 'DRAFT', label: 'Draft', dotColor: 'bg-outline' },
                { id: 'FAILED', label: 'Failed', dotColor: 'bg-error' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ] as const
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterTab(tab.id)}
                  className={`h-10 px-4 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {'dotColor' in tab && tab.dotColor && (
                    <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vertical Timeline Container */}
        <div className="relative pl-6 sm:pl-8 space-y-5 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-surface-container-highest">
          {filteredEntries.map((entry) => {
            const isPending = entry.statusCategory === 'PENDING';
            const isCompleted = entry.statusCategory === 'COMPLETED';
            const isDraft = entry.statusCategory === 'DRAFT';
            const isCancelled = entry.statusCategory === 'CANCELLED';
            const isFailed = entry.statusCategory === 'FAILED';

            return (
              <article key={entry.id} className="relative group">
                <span
                  className={`absolute -left-6 sm:-left-8 top-5 w-5 h-5 rounded-full ring-4 ring-surface flex items-center justify-center ${
                    isPending
                      ? 'bg-secondary text-on-secondary'
                      : isCompleted
                      ? 'bg-primary text-on-primary'
                      : isDraft
                      ? 'bg-surface-container-highest text-on-surface'
                      : isCancelled
                      ? 'bg-outline-variant text-on-surface'
                      : 'bg-error text-on-error'
                  }`}
                >
                  <MaterialIcon
                    name={
                      isPending
                        ? 'hourglass_top'
                        : isCompleted
                        ? 'check'
                        : isDraft
                        ? 'edit_note'
                        : isCancelled
                        ? 'block'
                        : 'priority_high'
                    }
                    className="text-[12px]"
                  />
                </span>

                <div
                  className={`rounded-xl bg-surface-container-lowest p-5 shadow-xs hover:shadow-md transition-shadow ${
                    isFailed ? 'border-l-4 border-error' : ''
                  } ${isCancelled ? 'opacity-90' : ''}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm uppercase ${
                            isPending
                              ? 'bg-secondary-fixed text-on-secondary-fixed'
                              : isCompleted
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : isDraft
                              ? 'bg-surface-container-highest text-on-surface'
                              : isCancelled
                              ? 'bg-surface-container text-outline'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {entry.statusBadgeLabel}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                          {entry.urgencyLabel}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                          {entry.dateLabel} • ID {entry.refCode}
                        </span>
                      </div>

                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {entry.title}
                      </h3>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {entry.summaryText}
                      </p>

                      {entry.secondaryNoteTitle && entry.secondaryNoteBody && (
                        <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-label-md text-label-md text-primary flex items-center gap-1.5">
                              <MaterialIcon name="verified" className="text-[16px]" />
                              <span>{entry.secondaryNoteTitle}</span>
                            </span>
                            <span className="font-label-sm text-label-sm text-outline">
                              Signed &amp; Locked
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface">
                            {entry.secondaryNoteBody}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1 font-body-sm text-body-sm text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <MaterialIcon name="mic" className="text-[16px] text-primary" />
                          Modality: {entry.modalityLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <MaterialIcon name="fact_check" className="text-[16px] text-primary" />
                          Guideline: {entry.guidelineLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-row lg:flex-col items-stretch gap-2 shrink-0 min-w-[200px]">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowMessageModal(true)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors"
                          >
                            <MaterialIcon name="reply" className="text-[16px]" />
                            <span>Respond to Dr. Chen</span>
                          </button>
                          <Link
                            href={entry.resultsUrl || '/assessments/CN-2026-8841/results'}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors"
                          >
                            <span>View Preliminary Result</span>
                          </Link>
                        </>
                      )}

                      {isCompleted && (
                        <>
                          <Link
                            href={entry.resultsUrl || '/assessments/CN-2026-8841/results'}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-label-md text-label-md transition-colors"
                          >
                            <MaterialIcon name="description" className="text-[16px]" />
                            <span>View Signed Report</span>
                          </Link>
                          <Link
                            href="/care-directory"
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors"
                          >
                            <MaterialIcon name="calendar_add_on" className="text-[16px]" />
                            <span>Book Follow-Up</span>
                          </Link>
                        </>
                      )}

                      {isDraft && (
                        <Link
                          href="/assessments/new"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-on-secondary hover:opacity-95 font-label-md text-label-md transition-opacity"
                        >
                          <MaterialIcon name="play_arrow" className="text-[16px]" />
                          <span>Resume Draft</span>
                        </Link>
                      )}

                      {isCancelled && (
                        <Link
                          href="/assessments/new"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors"
                        >
                          <MaterialIcon name="restart_alt" className="text-[16px]" />
                          <span>Start New From Copy</span>
                        </Link>
                      )}

                      {isFailed && (
                        <Link
                          href="/assessments/media-voice?tab=voice"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-error text-on-error hover:opacity-95 font-label-md text-label-md transition-opacity"
                        >
                          <MaterialIcon name="refresh" className="text-[16px]" />
                          <span>Retry Submission</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
