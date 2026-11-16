import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession, DEMO_PERSONAS } from '@/server/auth/session';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export default async function PatientDashboardPage() {
  const session = (await getServerSession()) ?? DEMO_PERSONAS.PATIENT;

  const profile = await prisma.patientProfile.findFirst({
    where: { userId: session.id },
    include: {
      user: true,
      allergies: true,
      conditions: true,
      vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 1 },
      prescriptions: { where: { status: 'ACTIVE' }, take: 2 },
      appointments: {
        where: { status: 'UPCOMING' },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        include: { doctor: true },
      },
      triageSessions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          citations: { include: { guideline: true } },
          clinicianReview: {
            include: { clinician: true },
          },
        },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
        take: 4,
        include: { biomarkers: true },
      },
    },
  });

  const firstName = session.name.split(' ')[0] ?? 'Sarah';
  const mrn = session.mrn ?? '#44092-B';

  return (
    <div className="space-y-8">
      {/* SECTION 1: TOP PATIENT GREETING BANNER & CONTEXTUAL ALERT STRIP */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-label-md text-label-md mb-1 flex-wrap">
            <MaterialIcon name="calendar_today" className="text-[16px]" />
            <span>Thursday, October 24, 2024 • MRN {mrn}</span>
            <SeedFixtureBadge isSeedFixture={profile?.isSeedFixture ?? true} />
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            Good morning, {firstName}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Your longitudinal health records and AI triage pathways are up to date.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-xl bg-surface-container-lowest flex items-center gap-2.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-label-md text-label-md text-on-surface">
              Clinical Network Synced
            </span>
          </div>
          <Link
            href="/settings/privacy#section-data-rights"
            className="px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-primary font-label-lg text-label-lg flex items-center gap-2 transition-colors shadow-xs"
          >
            <MaterialIcon name="download" className="text-[18px]" />
            <span>Export Summary</span>
          </Link>
        </div>
      </section>

      {/* Contextual Telemetry & Reminders Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Alert 1: Profile Incomplete */}
        <div className="bg-surface-container-lowest p-4 rounded-xl flex items-start gap-3.5 shadow-xs border-l-4 border-error">
          <div className="w-9 h-9 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0 mt-0.5">
            <MaterialIcon name="assignment_late" className="text-[20px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-error">
                Administrative Task
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                85% Complete
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface mt-0.5 truncate">
              Insurance coverage verification pending
            </p>
            <Link
              href="/settings/privacy"
              className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline mt-1.5"
            >
              <span>Complete Setup</span>
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
        </div>

        {/* Alert 2: Upcoming Appointment */}
        <div className="bg-surface-container-lowest p-4 rounded-xl flex items-start gap-3.5 shadow-xs border-l-4 border-primary">
          <div className="w-9 h-9 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 mt-0.5">
            <MaterialIcon name="videocam" className="text-[20px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                Next Clinical Visit
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Tomorrow, 10:30 AM
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface mt-0.5 truncate">
              Cardiology Telehealth Consultation
            </p>
            <Link
              href="/care-directory"
              className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline mt-1.5"
            >
              <span>Join Prep Check</span>
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
        </div>

        {/* Alert 3: Medication Refill */}
        <div className="bg-surface-container-lowest p-4 rounded-xl flex items-start gap-3.5 shadow-xs border-l-4 border-secondary">
          <div className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5">
            <MaterialIcon name="medication" className="text-[20px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Pharmacy Telemetry
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Due in 3 Days
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface mt-0.5 truncate">
              Lisinopril 10 mg Oral Tablet
            </p>
            <Link
              href="/records?tab=prescriptions"
              className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:underline mt-1.5"
            >
              <span>Request Refill</span>
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: HERO ACTION CARD — START AI-ASSISTED HEALTH ASSESSMENT */}
      <section className="bg-surface-container-low rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm uppercase tracking-wider shadow-2xs">
              <MaterialIcon name="auto_awesome" filled className="text-[14px]" />
              <span>Clinical Triage Protocol v4.2 • HIPAA Certified</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface">
              Start an AI-Assisted Health Assessment
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Experience a structured clinical intake powered by peer-reviewed triage guidelines.
              Select your preferred modality below to evaluate new symptoms, upload lab diagnostics,
              or record a guided voice summary for physician sign-off.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-3.5 rounded-xl max-w-xs shrink-0 self-start lg:self-center shadow-2xs">
            <div className="flex items-start gap-2.5">
              <MaterialIcon name="emergency" className="text-error text-[18px] mt-0.5" />
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-snug">
                <strong className="text-on-surface font-semibold">Emergency Notice:</strong>{' '}
                Decision-support tool, not a replacement for a doctor. For chest pain, severe
                shortness of breath, or stroke signs, call <strong>999</strong> immediately.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Modality Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Link
            href="/assessments/new"
            className="group bg-surface-container-lowest hover:bg-primary hover:text-on-primary p-5 rounded-xl transition-all duration-200 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary-fixed group-hover:bg-primary-container text-on-primary-fixed group-hover:text-on-primary flex items-center justify-center transition-colors">
                  <MaterialIcon name="chat_paste_go" className="text-[24px]" />
                </div>
                <span className="px-2.5 py-1 rounded-md bg-surface-container group-hover:bg-primary-container text-on-surface-variant group-hover:text-on-primary font-label-sm text-label-sm">
                  ~3 Mins
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-on-primary">
                Describe Symptoms
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-primary-container mt-1.5 leading-relaxed">
                Interactive step-by-step symptom questionnaire with dynamic clinical branching and
                acuity scoring.
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-label-lg text-label-lg text-primary group-hover:text-on-primary mt-5">
              <span>Begin Text Intake</span>
              <MaterialIcon
                name="arrow_forward"
                className="text-[18px] group-hover:translate-x-1 transition-transform"
              />
            </div>
          </Link>

          <Link
            href="/assessments/media-voice"
            className="group bg-surface-container-lowest hover:bg-primary hover:text-on-primary p-5 rounded-xl transition-all duration-200 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-secondary-fixed group-hover:bg-primary-container text-on-secondary-fixed group-hover:text-on-primary flex items-center justify-center transition-colors">
                  <MaterialIcon name="upload_file" className="text-[24px]" />
                </div>
                <span className="px-2.5 py-1 rounded-md bg-surface-container group-hover:bg-primary-container text-on-surface-variant group-hover:text-on-primary font-label-sm text-label-sm">
                  PDF • DICOM • IMG
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-on-primary">
                Upload Media &amp; Records
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-primary-container mt-1.5 leading-relaxed">
                Attach dermatological photos, lab result PDFs, or discharge summaries for automated
                clinical extraction.
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-label-lg text-label-lg text-secondary group-hover:text-on-primary mt-5">
              <span>Attach Clinical Files</span>
              <MaterialIcon
                name="arrow_forward"
                className="text-[18px] group-hover:translate-x-1 transition-transform"
              />
            </div>
          </Link>

          <Link
            href="/assessments/media-voice?tab=voice"
            className="group bg-surface-container-lowest hover:bg-primary hover:text-on-primary p-5 rounded-xl transition-all duration-200 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-tertiary-fixed group-hover:bg-primary-container text-on-tertiary-fixed group-hover:text-on-primary flex items-center justify-center transition-colors">
                  <MaterialIcon name="mic" className="text-[24px]" />
                </div>
                <span className="px-2.5 py-1 rounded-md bg-surface-container group-hover:bg-primary-container text-on-surface-variant group-hover:text-on-primary font-label-sm text-label-sm">
                  Hands-Free
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-on-primary">
                Voice Guided Intake
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-primary-container mt-1.5 leading-relaxed">
                Speak naturally with our real-time clinical transcription assistant to log symptoms
                and timeline details.
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-label-lg text-label-lg text-tertiary group-hover:text-on-primary mt-5">
              <span>Start Voice Session</span>
              <MaterialIcon
                name="arrow_forward"
                className="text-[18px] group-hover:translate-x-1 transition-transform"
              />
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION 3: MAIN 2-COLUMN ASYMMETRIC CLINICAL GRID (8 COLS / 4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 COLS): RECENT ASSESSMENTS, UPCOMING VISITS & MEDICAL RECORDS */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* Card: Recent Assessments & Clinician Review Status */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-surface-container">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Recent Clinical Assessments
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  AI triage evaluations and human clinician verification status
                </p>
              </div>
              <Link
                href="/assessments/history"
                className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
              >
                <span>View All ({profile?.triageSessions?.length ?? 0})</span>
                <MaterialIcon name="chevron_right" className="text-[18px]" />
              </Link>
            </div>

            <div className="space-y-4">
              {profile?.triageSessions && profile.triageSessions.length > 0 ? (
                profile.triageSessions.map((sessionItem) => {
                  const acuityColors: Record<string, { bg: string; label: string }> = {
                    EMERGENCY: { bg: 'bg-error-container text-on-error-container', label: 'Emergency Care Required' },
                    URGENT: { bg: 'bg-acuity-urgent-container text-acuity-urgent', label: 'Urgent Care (<24h)' },
                    ROUTINE: { bg: 'bg-secondary-fixed text-on-secondary-fixed', label: 'Routine Consultation' },
                    SELF_CARE: { bg: 'bg-acuity-selfcare-container text-acuity-selfcare', label: 'Self-Care & Monitoring' },
                  };
                  const acuityConfig = acuityColors[sessionItem.acuityLevel] ?? {
                    bg: 'bg-surface-container-high text-on-surface',
                    label: sessionItem.acuityLevel,
                  };

                  const reviewStage = sessionItem.clinicianReview?.stage;
                  const reviewBadge =
                    reviewStage === 'SIGNED' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                        <MaterialIcon name="verified" filled className="text-[14px]" />
                        <span>Clinician Verified • {sessionItem.clinicianReview?.clinician?.name || 'Attending Physician'}</span>
                      </div>
                    ) : reviewStage === 'REVIEWING' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-secondary font-label-sm text-label-sm">
                        <MaterialIcon name="schedule" className="text-[14px]" />
                        <span>Under Specialty Review</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm">
                        <MaterialIcon name="hourglass_empty" className="text-[14px]" />
                        <span>Queued for Review</span>
                      </div>
                    );

                  return (
                    <div
                      key={sessionItem.id}
                      className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm uppercase ${acuityConfig.bg}`}>
                            {acuityConfig.label}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                            {new Date(sessionItem.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • ID #{sessionItem.sessionCode}
                          </span>
                          <SeedFixtureBadge isSeedFixture={sessionItem.isSeedFixture} />
                        </div>
                        {reviewBadge}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        {sessionItem.chiefComplaint}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                        {sessionItem.plainLanguageSummary}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3.5 pt-3 border-t border-outline-variant/20">
                        <div className="flex items-center gap-4 text-on-surface-variant font-body-sm text-body-sm">
                          {sessionItem.citations?.[0]?.guideline ? (
                            <span className="flex items-center gap-1">
                              <MaterialIcon name="fact_check" className="text-[16px] text-primary" />
                              Guideline: {sessionItem.citations[0].guideline.code}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <MaterialIcon name="fact_check" className="text-[16px] text-primary" />
                              Clinical Triage Protocol
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-mono text-xs">
                            Conf: {sessionItem.confidenceScore}%
                          </span>
                        </div>
                        <Link
                          href={`/assessments/${sessionItem.sessionCode || sessionItem.id}/results`}
                          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
                        >
                          <span>View Triage Report</span>
                          <MaterialIcon name="open_in_new" className="text-[15px]" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <MaterialIcon name="assignment" className="text-[24px]" />
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">No Clinical Assessments Yet</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-md mx-auto">
                      You haven&apos;t recorded any health intake sessions yet. Start an assessment to evaluate symptoms with clinical guidance.
                    </p>
                  </div>
                  <Link
                    href="/assessments/new"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
                  >
                    <MaterialIcon name="add" className="text-[18px]" />
                    <span>Start First Assessment</span>
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Card: Upcoming Visits & Recommended Next Steps */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-surface-container">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Upcoming Care Encounters
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Scheduled appointments and pre-visit clinical preparation tasks
                </p>
              </div>
              <Link
                href="/care-directory"
                className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <MaterialIcon name="add" className="text-[16px]" />
                <span>Schedule Visit</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Visit 1 */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-primary text-on-primary font-label-sm text-label-sm">
                      Video Telehealth
                    </span>
                    <span className="font-label-md text-label-md text-primary">
                      Tomorrow • 10:30 AM
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-sm font-bold shrink-0">
                      AT
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Dr. Ayesha Rahman, MBBS, FCPS
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Cardiovascular &amp; Pulmonary Medicine • Pacific Heart Institute
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                    <MaterialIcon name="check_circle" className="text-[15px] text-primary" />
                    Triage packet shared
                  </span>
                  <Link
                    href="/care-directory"
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    Manage Visit →
                  </Link>
                </div>
              </div>

              {/* Visit 2 */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-highest text-on-surface font-label-sm text-label-sm">
                      In-Clinic Diagnostic
                    </span>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      Nov 04, 2024 • 08:15 AM
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-surface-container-highest text-secondary flex items-center justify-center shrink-0">
                      <MaterialIcon name="biotech" className="text-[22px]" />
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        LabCorp Diagnostics — Suite 200
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Fasting Lipid Panel &amp; HbA1c Blood Draw
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-error flex items-center gap-1">
                    <MaterialIcon name="info" className="text-[15px]" />
                    12h Fasting Required
                  </span>
                  <Link
                    href="/records?tab=reports"
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    View Order →
                  </Link>
                </div>
              </div>
            </div>

            {/* Recommended Pre-Visit Next Steps Checklist */}
            <div className="mt-4 p-4 rounded-xl bg-surface-container/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <MaterialIcon name="checklist" className="text-primary text-[22px] mt-0.5" />
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">
                    Recommended Next Steps Before Tomorrow&apos;s Visit
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Log your morning resting blood pressure reading and confirm your active
                    medication dosages.
                  </p>
                </div>
              </div>
              <Link
                href="/records"
                className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shrink-0 transition-colors text-center"
              >
                Log Vitals Now
              </Link>
            </div>
          </section>

          {/* Card: Recent Medical Records & Diagnostic Files */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-surface-container">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Recent Medical Records &amp; Diagnostic Files
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Synchronized EHR documents, laboratory panels, and imaging summaries
                </p>
              </div>
              <Link
                href="/records"
                className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
              >
                <span>Open Document Vault</span>
                <MaterialIcon name="chevron_right" className="text-[18px]" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {profile?.documents && profile.documents.length > 0 ? (
                profile.documents.map((doc) => {
                  const categoryIcon: Record<string, { name: string; color: string }> = {
                    LAB_RESULTS: { name: 'science', color: 'text-primary' },
                    IMAGING: { name: 'monitor_heart', color: 'text-tertiary' },
                    DISCHARGE_SUMMARY: { name: 'description', color: 'text-secondary' },
                    CONSULT_NOTE: { name: 'clinical_notes', color: 'text-secondary' },
                    CLINICAL_PHOTO: { name: 'photo_camera', color: 'text-primary' },
                    SUPPLEMENTAL: { name: 'attachment', color: 'text-outline' },
                  };
                  const iconConfig = categoryIcon[doc.category] ?? { name: 'description', color: 'text-primary' };

                  return (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-lg bg-surface-container-lowest ${iconConfig.color} flex items-center justify-center shrink-0 shadow-2xs`}>
                          <MaterialIcon name={iconConfig.name} className="text-[20px]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                            {doc.title}
                          </h3>
                          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                            {new Date(doc.uploadedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • {doc.facilityName || 'Medical Vault'} • {doc.biomarkers?.length ? `${doc.biomarkers.length} Biomarkers` : (doc.aiPlainSummary || `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-mono uppercase">
                          {doc.category.replace('_', ' ')}
                        </span>
                        <Link
                          href="/records"
                          aria-label={`Inspect ${doc.title}`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors"
                        >
                          <MaterialIcon name="visibility" className="text-[18px]" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 space-y-2">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    No medical records uploaded yet.
                  </p>
                  <Link
                    href="/records"
                    className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:underline"
                  >
                    <MaterialIcon name="upload_file" className="text-[16px]" />
                    <span>Upload First Document</span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (4 COLS): COMPACT HEALTH PROFILE & RECOMMENDED DOCTORS */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {/* Card: Compact Health Profile Summary */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container">
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="badge" className="text-primary text-[22px]" />
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Health Profile
                </h2>
              </div>
              <Link
                href="/records"
                className="font-label-md text-label-md text-primary hover:underline"
              >
                Edit Profile
              </Link>
            </div>

            {/* Key Biometrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Blood Type
                </span>
                <p className="font-headline-md text-headline-md text-on-surface mt-0.5">
                  {profile?.bloodType ?? 'O Positive (O+)'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Primary Care
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface mt-1 truncate">
                  {profile?.primaryCarePhysician ?? 'Dr. Evelyn Vance, MD'}
                </p>
              </div>
            </div>

            {/* Clinical Summary Tags */}
            <div className="space-y-3.5">
              {/* Allergies */}
              <div className="p-3.5 rounded-xl bg-error-container/40">
                <div className="flex items-center gap-1.5 text-error font-label-sm text-label-sm uppercase tracking-wider mb-1.5">
                  <MaterialIcon name="warning" className="text-[15px]" />
                  <span>Critical Allergy Flag</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-error text-on-error font-label-sm text-label-sm">
                    Penicillin — Severe (Anaphylaxis)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest text-on-error-container font-label-sm text-label-sm">
                    Sulfa Antibiotics (Rash)
                  </span>
                </div>
              </div>

              {/* Active Conditions */}
              <div className="p-3.5 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Key Chronic Conditions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest text-on-surface font-body-sm text-body-sm">
                    Mild Persistent Asthma (J45.30)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest text-on-surface font-body-sm text-body-sm">
                    Essential Hypertension
                  </span>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">
                    Emergency Contact
                  </span>
                  <p className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
                    {profile?.emergencyContactName ?? 'David Jenkins (Spouse)'}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                    {profile?.emergencyContactPhone ?? '+1 (415) 890-3319'}
                  </p>
                </div>
                <a
                  href="tel:+14158903319"
                  aria-label="Call Emergency Contact"
                  className="w-9 h-9 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center shadow-2xs hover:bg-primary hover:text-on-primary transition-colors"
                >
                  <MaterialIcon name="call" className="text-[18px]" />
                </a>
              </div>
            </div>

            <Link
              href="/records"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 transition-colors"
            >
              <MaterialIcon name="qr_code_2" className="text-[18px] text-primary" />
              <span>View Emergency Medical ID</span>
            </Link>
          </section>

          {/* Card: Recommended Specialists & Care Directory */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Matched In-Network Care
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Based on recent respiratory &amp; joint triage
                </p>
              </div>
              <Link
                href="/care-directory"
                className="font-label-md text-label-md text-primary hover:underline"
              >
                Directory
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Doctor 1 */}
              <div className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-sm font-bold shrink-0">
                    AT
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                        Dr. Ayesha Rahman, MBBS, FCPS
                      </h3>
                      <span className="inline-flex items-center gap-0.5 font-label-sm text-label-sm text-primary">
                        <MaterialIcon name="star" filled className="text-[13px]" />
                        4.9
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Pulmonary &amp; Respiratory Medicine
                    </p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-outline-variant/20">
                      <span className="font-label-sm text-label-sm text-primary">
                        Next Slot: Thu, 2:00 PM
                      </span>
                      <Link
                        href="/care-directory?doctor=doc-aris-thorne"
                        className="px-2.5 py-1 rounded-md bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary font-label-sm text-label-sm transition-colors"
                      >
                        Book Visit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doctor 2 */}
              <div className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-sm font-bold shrink-0">
                    KR
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                        Dr. Kavita Rao, DO
                      </h3>
                      <span className="inline-flex items-center gap-0.5 font-label-sm text-label-sm text-primary">
                        <MaterialIcon name="star" filled className="text-[13px]" />
                        4.8
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Orthopedics &amp; Sports Medicine
                    </p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-outline-variant/20">
                      <span className="font-label-sm text-label-sm text-secondary">
                        Next Slot: Fri, 11:15 AM
                      </span>
                      <Link
                        href="/care-directory?specialty=Orthopedics"
                        className="px-2.5 py-1 rounded-md bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary font-label-sm text-label-sm transition-colors"
                      >
                        Book Visit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* MANDATORY CLINICAL DECISION-SUPPORT DISCLAIMER FOOTER */}
      <footer className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-on-surface-variant font-body-sm text-body-sm">
        <div className="flex items-center gap-2.5">
          <MaterialIcon name="gavel" className="text-outline text-[18px]" />
          <span>
            <strong>Clinical Governance Notice:</strong> CareNavigator is a clinical
            decision-support tool, not a replacement for a licensed physician. If you experience a
            medical emergency, call 999 immediately.
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0 font-label-sm text-label-sm">
          <Link href="/settings/privacy" className="hover:text-primary transition-colors">
            HIPAA Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/assessments/CN-2026-8841/results" className="hover:text-primary transition-colors">
            Triage Methodology
          </Link>
        </div>
      </footer>
    </div>
  );
}
