'use client';

import React, { useState, useEffect } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function PrivacySettingsPage() {
  const [lockScreenMasking, setLockScreenMasking] = useState(true);
  const [quietHours, setQuietHours] = useState(true);
  const [hieSync, setHieSync] = useState(true);
  const [researchConsent, setResearchConsent] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState('15');
  const [mobileSessionActive, setMobileSessionActive] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Deletion Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  useEffect(() => {
    if (!showDeleteModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteModal(false);
        setDeleteConfirmInput('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal]);

  function showToast(msg: string) {
    setToastMessage(msg);
  }

  function handleConfirmDeletion() {
    if (deleteConfirmInput !== 'DELETE') return;
    setShowDeleteModal(false);
    setDeleteConfirmInput('');
    showToast(
      'Account deletion & telemetry purge request logged. Statutory 7-year HIPAA retention freeze applied to signed encounter notes.'
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Compliance Callout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
              Settings &amp; Privacy Controls
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-md text-label-md">
              <MaterialIcon name="verified" filled className="text-[16px] text-primary" />
              <span>Data Protection: Active (HIPAA &amp; GDPR Enforced)</span>
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Manage your communication preferences, clinical consent, data sharing, and security
            settings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider hidden sm:inline">
            Audit log:
          </span>
          <button
            type="button"
            onClick={() => setShowAuditModal((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low text-secondary font-label-md text-label-md hover:bg-surface-container transition-colors shadow-xs"
          >
            <MaterialIcon name="receipt_long" className="text-[18px]" />
            <span>Access History</span>
          </button>
          <button
            type="button"
            onClick={() =>
              showToast(
                'Privacy, consent, and communication preferences saved and encrypted in your patient profile.'
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-lg text-label-lg hover:bg-primary transition-colors shadow-xs"
          >
            <MaterialIcon name="save" className="text-[18px]" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-inverse-surface text-inverse-on-surface shadow-md flex items-center justify-between gap-4 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2.5">
            <MaterialIcon name="check_circle" className="text-primary-fixed text-[20px]" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-inverse-on-surface/80 hover:text-inverse-on-surface"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
      )}

      {showAuditModal && (
        <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <MaterialIcon name="receipt_long" className="text-primary text-[20px]" />
              <span>Immutable HIPAA Access &amp; Consent Audit Log</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAuditModal(false)}
              className="text-outline hover:text-on-surface"
            >
              <MaterialIcon name="close" className="text-[18px]" />
            </button>
          </div>
          <div className="space-y-2 font-body-sm text-body-sm">
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <span>Oct 24, 2024 • Dr. Sarah Chen, MD viewed Triage Packet #AS-9941</span>
              <span className="font-mono text-xs text-primary">AUD-9041-V</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <span>Oct 12, 2024 • Nusrat Jahan signed AI Triage Protocol Consent v4.2</span>
              <span className="font-mono text-xs text-secondary">AUD-8812-C</span>
            </div>
          </div>
        </div>
      )}

      {/* Layout: Side Navigation / Section Anchor & Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Rail (Anchors) */}
        <nav
          aria-label="Privacy settings sections"
          className="lg:col-span-3 bg-surface-container-lowest p-3 rounded-xl shadow-sm space-y-1 lg:sticky lg:top-20"
        >
          <a
            href="#section-communication"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-headline-sm transition-colors"
          >
            <MaterialIcon name="mark_chat_unread" className="text-[20px]" />
            <span>Communication</span>
          </a>
          <a
            href="#section-clinical-consent"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body-md text-body-md transition-colors"
          >
            <MaterialIcon name="assignment_turned_in" className="text-[20px]" />
            <span>Clinical Consents</span>
          </a>
          <a
            href="#section-authorized-team"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body-md text-body-md transition-colors"
          >
            <MaterialIcon name="share_reviews" className="text-[20px]" />
            <span>Authorized Care Team</span>
          </a>
          <a
            href="#section-security"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body-md text-body-md transition-colors"
          >
            <MaterialIcon name="shield" className="text-[20px]" />
            <span>Security &amp; Auth</span>
          </a>
          <a
            href="#section-data-rights"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body-md text-body-md transition-colors"
          >
            <MaterialIcon name="download_for_offline" className="text-[20px]" />
            <span>Data Export &amp; Rights</span>
          </a>
          <a
            href="#section-danger-zone"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-error hover:bg-error-container hover:text-on-error-container font-body-md text-body-md transition-colors"
          >
            <MaterialIcon name="delete_forever" className="text-[20px]" />
            <span>Account &amp; Deletion</span>
          </a>

          <div className="pt-4 mt-4 bg-surface-container-low rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-tertiary">
              <MaterialIcon name="lock" className="text-[16px]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider">
                Protocol Security
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Changes to triage escalation alerts require Multi-Factor re-verification.
            </p>
          </div>
        </nav>

        {/* Main Content Sections */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* SECTION 1: Communication Preferences */}
          <section
            id="section-communication"
            className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
              <div>
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                  Section 01
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Communication Preferences
                </h2>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant px-2.5 py-1 rounded bg-surface-container-low self-start sm:self-auto">
                Channels Synchronized
              </span>
            </div>

            {/* Notification Masking Banner / Privacy-Safe Lock */}
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                  <MaterialIcon name="visibility_off" className="text-[22px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Privacy-Safe Lock Screen Masking
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm">
                      Recommended
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Replaces clinical diagnostic names, triage urgency grades, and medication names
                    with generic notifications (e.g., &ldquo;CareNavigator has an update for
                    you&rdquo;) across lock screen banners and SMS texts.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  id="lock-screen-privacy"
                  type="checkbox"
                  checked={lockScreenMasking}
                  onChange={(e) => setLockScreenMasking(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Alert Categories Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Alert Routing Matrix
                </h3>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Default: Mobile Push &amp; In-App Hub
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg bg-surface-container-lowest">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
                    <tr>
                      <th className="py-3 px-4">Event Category</th>
                      <th className="py-3 px-4 text-center w-20">In-App</th>
                      <th className="py-3 px-4 text-center w-20">Push</th>
                      <th className="py-3 px-4 text-center w-20">SMS</th>
                      <th className="py-3 px-4 text-center w-20">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                    <tr className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-error shrink-0" />
                          <div>
                            <p className="font-headline-sm text-headline-sm text-on-surface">
                              Critical Triage &amp; Escalations
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              Emergency red flags, severe symptom elevation alerts, and urgent ED
                              direction notices.
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          aria-label="Critical Triage In-App"
                          className="rounded w-4 h-4 accent-primary cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          aria-label="Critical Triage Push"
                          className="rounded w-4 h-4 accent-primary cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          aria-label="Critical Triage SMS"
                          className="rounded w-4 h-4 accent-primary cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          aria-label="Critical Triage Email"
                          className="rounded w-4 h-4 accent-primary cursor-not-allowed"
                        />
                      </td>
                    </tr>

                    <tr className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                          <div>
                            <p className="font-headline-sm text-headline-sm text-on-surface">
                              Clinician Review Updates
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              When Dr. Chen or care team doctors annotate or sign off on your AI
                              assessment log.
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Clinician Review In-App"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Clinician Review Push"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label="Clinician Review SMS"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Clinician Review Email"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    </tr>

                    <tr className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary-container shrink-0" />
                          <div>
                            <p className="font-headline-sm text-headline-sm text-on-surface">
                              Appointment &amp; Follow-up Reminders
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              Scheduled clinical visits (24 hours and 1 hour before encounter).
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Appointment In-App"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Appointment Push"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Appointment SMS"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label="Appointment Email"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    </tr>

                    <tr className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0" />
                          <div>
                            <p className="font-headline-sm text-headline-sm text-on-surface">
                              Educational Care Tips &amp; Insights
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              Evidence-based preventative wellness insights personalized to your
                              triage history.
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Care Tips In-App"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label="Care Tips Push"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label="Care Tips SMS"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          aria-label="Care Tips Email"
                          className="rounded w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                * Critical Triage &amp; Escalations channels cannot be disabled to satisfy medical
                risk liability protocols.
              </p>
            </div>

            {/* Quiet Hours Container */}
            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <MaterialIcon name="bedtime" className="text-[20px] text-primary" />
                  <div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface">
                      Clinical Quiet Hours (Do Not Disturb)
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Mute non-urgent notifications during resting periods.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quietHours}
                    onChange={(e) => setQuietHours(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-surface-container-lowest p-3 rounded-lg flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Quiet window starts:
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface px-2.5 py-1 bg-surface-container-low rounded">
                    10:00 PM
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-lg flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Quiet window ends:
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface px-2.5 py-1 bg-surface-container-low rounded">
                    07:00 AM
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Clinical Consent & Data Sharing */}
          <section
            id="section-clinical-consent"
            className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-5"
          >
            <div>
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Section 02
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Clinical Consent &amp; Data Governance
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Regulate permissions for artificial intelligence triage logic, regional health
                information exchanges (HIE), and academic validation.
              </p>
            </div>

            <div className="space-y-4">
              {/* Consent Card 1 */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MaterialIcon
                      name="psychology"
                      filled
                      className="text-[20px] text-primary"
                    />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      AI-Assisted Triage Protocol Consent
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">
                      Active • Signed
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Authorizes CareNavigator&apos;s natural language engine to parse symptoms,
                    cross-reference against clinical benchmarks, and recommend escalation tiers.
                  </p>
                  <div className="flex items-center gap-4 font-label-sm text-label-sm text-outline pt-1">
                    <span>Granted on: Oct 12, 2024</span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        showToast('Downloaded signed AI-Assisted Triage Consent PDF (#CNS-8841).')
                      }
                      className="text-secondary hover:underline flex items-center gap-1"
                    >
                      <MaterialIcon name="picture_as_pdf" className="text-[14px]" />
                      <span>Download Signed PDF</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showToast('AI-Assisted Triage Protocol Consent v4.2 re-attested.')
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-surface-container-highest text-secondary hover:bg-surface-variant font-label-md text-label-md transition-colors shrink-0"
                >
                  Review &amp; Re-sign
                </button>
              </div>

              {/* Consent Card 2 */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MaterialIcon name="hub" className="text-[20px] text-secondary" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Health Information Exchange (HIE) Sync
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm">
                      Inter-Hospital Network
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Allows bidirectional synchronization of vital signs, ER discharge notes, and
                    allergies across affiliated regional hospital networks (FHIR R4 protocol).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={hieSync}
                    onChange={(e) => setHieSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>

              {/* Consent Card 3 */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MaterialIcon name="biotech" className="text-[20px] text-tertiary" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Research &amp; Quality Improvement (De-Identified)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                      Optional
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Permit anonymized clinical triage metrics (zero names, zero identifiers) to be
                    pooled for clinical algorithm safety audits and peer-reviewed studies.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={researchConsent}
                    onChange={(e) => setResearchConsent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
            </div>
          </section>

          {/* SECTION 2B: Authorized Care Team Directory */}
          <section
            id="section-authorized-team"
            className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                  Access Roster
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Authorized Clinicians &amp; Care Team
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Practitioners granted read/write access to your triage sessions and medical
                  history.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  showToast('Opened Care Directory clinician authorization selector.')
                }
                className="px-3.5 py-2 rounded-lg bg-surface-container-low text-secondary font-label-md text-label-md hover:bg-surface-container transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <MaterialIcon name="person_add" className="text-[16px]" />
                <span>Grant Doctor Access</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-sm font-bold shrink-0">
                    EC
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Dr. Evelyn Chen, MD
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Primary Care • Internal Medicine
                    </p>
                    <span className="inline-block mt-1 font-label-sm text-label-sm text-tertiary">
                      Full Clinical Authority
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Access token review requested for Dr. Evelyn Chen, MD.')}
                  title="Revoke access"
                  className="text-on-surface-variant hover:text-error transition-colors p-1"
                >
                  <MaterialIcon name="link_off" className="text-[20px]" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-sm font-bold shrink-0">
                    MR
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Dr. Marcus Rivera, FACC
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Cardiovascular Assessment
                    </p>
                    <span className="inline-block mt-1 font-label-sm text-label-sm text-secondary">
                      Triage Assessment View Only
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showToast('Access token review requested for Dr. Marcus Rivera, FACC.')
                  }
                  title="Revoke access"
                  className="text-on-surface-variant hover:text-error transition-colors p-1"
                >
                  <MaterialIcon name="link_off" className="text-[20px]" />
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 3: Security & Access */}
          <section
            id="section-security"
            className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-5"
          >
            <div>
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Section 03
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Security &amp; Device Sessions
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Safeguard medical credentials with cryptographically backed multi-factor
                verification.
              </p>
            </div>

            {/* 2FA Box */}
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
                  <MaterialIcon name="phonelink_lock" className="text-[22px]" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Two-Factor Authentication (2FA)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">
                      Active • TOTP
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Primary authenticator: Google Authenticator / 1Password. Required for accessing
                    lab results and modifying triage notes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => showToast('Generated new encrypted 2FA recovery backup codes.')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container-highest text-secondary hover:bg-surface-variant font-label-md text-label-md transition-colors shrink-0"
              >
                Configure Backup Codes
              </button>
            </div>

            {/* Session Inactivity Timeout Selector */}
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label
                  htmlFor="timeout-select"
                  className="font-headline-sm text-headline-sm text-on-surface block"
                >
                  Automatic Clinical Inactivity Timeout
                </label>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Enforces local dashboard screen lockout if no keyboard or pointer movement is
                  registered.
                </p>
              </div>
              <select
                id="timeout-select"
                value={inactivityTimeout}
                onChange={(e) => setInactivityTimeout(e.target.value)}
                className="px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="5">5 Minutes</option>
                <option value="15">15 Minutes (HIPAA Recommended)</option>
                <option value="30">30 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            {/* Active Devices List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Authenticated Devices
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSessionActive(false);
                    showToast('Terminated all secondary device sessions.');
                  }}
                  className="text-error hover:underline font-label-md text-label-md"
                >
                  Log out all other devices
                </button>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MaterialIcon name="laptop_mac" className="text-[20px] text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          MacBook Pro • Chrome 129.0
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm">
                          This Machine
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        San Francisco, CA • Active Now • IP: 198.51.100.42
                      </span>
                    </div>
                  </div>
                  <span className="font-label-sm text-label-sm text-tertiary">
                    Verified TLS 1.3
                  </span>
                </div>

                {mobileSessionActive && (
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MaterialIcon name="smartphone" className="text-[20px] text-secondary" />
                      <div>
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          iPhone 15 Pro • CareNavigator iOS App
                        </span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          San Francisco, CA • 4 hours ago via FaceID
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSessionActive(false);
                        showToast('Terminated iPhone 15 Pro session.');
                      }}
                      className="text-error hover:underline font-label-md text-label-md"
                    >
                      Terminate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 4: Data Rights & Export */}
          <section
            id="section-data-rights"
            className="bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                  Section 04
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Data Portability &amp; Archival
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Exercise your statutory data portability rights under HIPAA and GDPR Article 20.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  showToast(
                    'Prepared encrypted FHIR R4 / C-CDA Health Archive (.ZIP) for download.'
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md hover:opacity-95 transition-opacity shadow-xs self-start sm:self-auto"
              >
                <MaterialIcon name="file_download" className="text-[18px]" />
                <span>Export Full Health Archive</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                <MaterialIcon name="terminal" className="text-[22px] text-primary" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  FHIR / JSON Format
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Standardized interoperable format for uploading to third-party hospital portals.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                <MaterialIcon name="description" className="text-[22px] text-secondary" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  C-CDA Clinical Summary
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Continuity of Care Document formatted for primary care physician onboarding.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-low space-y-1">
                <MaterialIcon name="folder_zip" className="text-[22px] text-tertiary" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Encrypted .ZIP Archive
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Complete raw triage transcripts, audio logs, and high-resolution chart snapshots.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 5: Danger Zone & Permanent Deletion */}
          <section
            id="section-danger-zone"
            className="bg-error-container/25 rounded-xl p-6 space-y-4 shadow-sm border border-error/20"
          >
            <div className="flex items-center gap-2 text-error">
              <MaterialIcon name="warning" className="text-[24px]" />
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Danger Zone: Account &amp; Record Deletion
              </h2>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl space-y-2">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                <MaterialIcon name="gavel" className="text-[18px] text-error" />
                <span>Important Medical Record Legal Notice</span>
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Under medical practice statutory regulations and the Health Insurance Portability
                and Accountability Act (HIPAA), authenticated physician encounter summaries,
                clinician signatures, and formal triage notes must be archived securely for{' '}
                <strong>7 years</strong> (or longer for pediatric cases) according to prevailing
                state laws.
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Requesting deletion will permanently purge your active login credentials, raw
                conversation telemetry, device identifiers, and patient demographic profiles, and
                revoke all third-party provider access tokens immediately.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div>
                <p className="font-headline-sm text-headline-sm text-on-surface">
                  Irreversible Account Termination
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Purge telemetry data and initiate retention freeze on medical transcripts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2.5 rounded-lg bg-error text-on-error font-label-lg text-label-lg hover:opacity-95 transition-opacity shadow-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <MaterialIcon name="delete_forever" className="text-[18px]" />
                <span>Request Account Deletion &amp; Purge Data</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {showDeleteModal && (
        <div
          id="deletion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-xs"
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-error">
                <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center shrink-0">
                  <MaterialIcon name="warning" className="text-[24px] text-error" />
                </div>
                <div>
                  <h3
                    id="delete-modal-title"
                    className="font-headline-lg text-headline-lg text-on-surface leading-tight"
                  >
                    Delete Account &amp; Purge Data?
                  </h3>
                  <span className="font-label-sm text-label-sm text-error uppercase tracking-wider">
                    Irreversible Action
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="bg-surface-container-low p-4 rounded-lg space-y-2">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                This action cannot be undone. Under clinical retention regulations, verified
                physician encounter notes may be archived for <strong>7 years</strong> according to
                state law, but your patient profile, credentials, and AI chat transcripts will be
                immediately purged.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="delete-confirmation-input"
                className="font-label-md text-label-md text-on-surface block"
              >
                To confirm, type <strong className="text-error font-headline-sm">DELETE</strong> in
                the box below:
              </label>
              <input
                id="delete-confirmation-input"
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-error"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                disabled={deleteConfirmInput !== 'DELETE'}
                onClick={handleConfirmDeletion}
                className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md disabled:opacity-40"
              >
                Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
