import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export default async function PatientDashboardPage() {
  const session = await getServerSession({ strictCookieOnly: true });
  if (!session) redirect('/login');
  if (session.role !== 'PATIENT') redirect(session.role === 'ADMIN' ? '/admin/impact' : '/assessments/history');

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

  const firstName = session.name.split(' ')[0];
  const mrn = session.mrn ?? 'Pending';
  const today = new Intl.DateTimeFormat('en-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(new Date());

  return (
    <div className="space-y-8">
      {/* SECTION 1: TOP PATIENT GREETING BANNER & CONTEXTUAL ALERT STRIP */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-label-md text-label-md mb-1 flex-wrap">
            <MaterialIcon name="calendar_today" className="text-[16px]" />
            <span>{today} • MRN {mrn}</span>
            {session.isSeedFixture && <SeedFixtureBadge isSeedFixture />}
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

      <section aria-label="Your care overview" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Health profile</p>
          <p className="mt-2 font-semibold text-on-surface">{profile ? 'Your profile is ready to update' : 'Profile details are not available'}</p>
          <Link href="/records" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Review health records <MaterialIcon name="arrow_forward" className="text-sm" /></Link>
        </article>

        <article className="rounded-xl border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Next appointment</p>
          {profile?.appointments[0] ? (
            <>
              <p className="mt-2 font-semibold text-on-surface">{profile.appointments[0].doctor.name}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(profile.appointments[0].scheduledAt)}</p>
            </>
          ) : <p className="mt-2 text-sm text-on-surface-variant">No upcoming appointment saved.</p>}
          <Link href="/care-directory" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Find care <MaterialIcon name="arrow_forward" className="text-sm" /></Link>
        </article>

        <article className="rounded-xl border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Active prescriptions</p>
          {profile?.prescriptions.length ? (
            <ul className="mt-2 space-y-1 text-sm text-on-surface">
              {profile.prescriptions.map((prescription) => <li key={prescription.id}>{prescription.medicationName} · {prescription.dosage}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-on-surface-variant">No active prescriptions saved.</p>}
          <Link href="/records" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View records <MaterialIcon name="arrow_forward" className="text-sm" /></Link>
        </article>
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

          {/* Upcoming visits are drawn from this account's saved appointments. */}
          <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs">
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-surface-container pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Upcoming appointments</h2>
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Appointments linked to your account appear here.</p>
              </div>
              <Link href="/care-directory" className="inline-flex items-center gap-1.5 self-start rounded-lg bg-surface-container-low px-3.5 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container sm:self-auto">
                <MaterialIcon name="search" className="text-[16px]" />
                <span>Find care</span>
              </Link>
            </div>
            {profile?.appointments.length ? (
              <div className="space-y-3">
                {profile.appointments.map((appointment) => (
                  <article key={appointment.id} className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">{appointment.doctor.name}</h3>
                      <time className="text-sm font-semibold text-primary">
                        {new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(appointment.scheduledAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">{appointment.doctor.specialty} · {appointment.modality === 'TELEHEALTH' ? 'Telehealth' : 'In person'}</p>
                    <p className="mt-2 text-sm text-on-surface">{appointment.reason}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">You have no upcoming appointments yet. Use Find care to browse available providers.</p>
            )}
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
                  {profile?.bloodType || 'Not provided'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Primary Care
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface mt-1 truncate">
                  {profile?.primaryCarePhysician || 'Not added'}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <section className="rounded-xl bg-surface-container-low p-3.5">
                <h3 className="mb-2 flex items-center gap-1.5 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <MaterialIcon name="warning" className="text-[15px]" />
                  Allergies
                </h3>
                {profile?.allergies.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.allergies.map((allergy) => (
                      <span key={allergy.id} className="rounded-md bg-error-container px-2.5 py-1 text-sm text-on-error-container">
                        {allergy.substance} — {allergy.severity} ({allergy.reaction})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">No allergies have been added to your profile.</p>
                )}
              </section>

              <section className="rounded-xl bg-surface-container-low p-3.5">
                <h3 className="mb-2 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Health conditions</h3>
                {profile?.conditions.length ? (
                  <ul className="space-y-1.5">
                    {profile.conditions.map((condition) => (
                      <li key={condition.id} className="rounded-md bg-white px-2.5 py-1.5 text-sm text-on-surface">
                        {condition.name} <span className="text-on-surface-variant">· {condition.status.toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-on-surface-variant">No health conditions have been added to your profile.</p>
                )}
              </section>

              <section className="rounded-xl bg-surface-container-low p-3.5">
                <h3 className="mb-1 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Emergency contact</h3>
                {profile?.emergencyContactName || profile?.emergencyContactPhone ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-on-surface">{profile.emergencyContactName || 'Contact name not added'}</p>
                      <p className="text-sm text-on-surface-variant">{profile.emergencyContactPhone || 'Phone number not added'}</p>
                    </div>
                    {profile.emergencyContactPhone && (
                      <a href={'tel:' + profile.emergencyContactPhone} aria-label="Call emergency contact" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary hover:bg-primary hover:text-on-primary">
                        <MaterialIcon name="call" className="text-[18px]" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">No emergency contact has been added to your profile.</p>
                )}
              </section>
            </div>
            <Link
              href="/records"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 transition-colors"
            >
              <MaterialIcon name="qr_code_2" className="text-[18px] text-primary" />
              <span>View Emergency Medical ID</span>
            </Link>
          </section>

          <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs">
            <h2 className="font-headline-md text-headline-md text-on-surface">Find care in your area</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Browse the care directory to see available providers. Appointments and profile details will appear here after they are added to your account.
            </p>
            <Link href="/care-directory" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-container">
              <MaterialIcon name="search" className="text-lg" />
              Browse care directory
            </Link>
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
