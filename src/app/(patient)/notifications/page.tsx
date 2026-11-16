'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

type NotifCategory = 'all' | 'clinical' | 'appointment' | 'reminder' | 'record';

interface NotificationRecord {
  id: string;
  group: 'today' | 'yesterday' | 'earlier';
  category: Exclude<NotifCategory, 'all'>;
  categoryBadge: string;
  categoryBadgeStyle: string;
  icon: string;
  iconBgStyle: string;
  timestampLabel: string;
  title: string;
  body: string;
  isRead: boolean;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionIcon?: string;
  primaryActionStyle?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
}

const INITIAL_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: 'n1',
    group: 'today',
    category: 'clinical',
    categoryBadge: 'Clinical Review',
    categoryBadgeStyle: 'bg-surface-container text-primary',
    icon: 'vital_signs',
    iconBgStyle: 'bg-surface-container text-primary',
    timestampLabel: '12 mins ago',
    title: 'Assessment Ref #CN-8492 Status Updated',
    body: 'Assessment Ref #CN-8492 status updated. New guidance is ready for your secure review within the authenticated patient portal.',
    isRead: false,
    primaryActionLabel: 'Open Assessment',
    primaryActionHref: '/assessments/CN-2026-8841/results',
    primaryActionIcon: 'visibility',
    primaryActionStyle: 'bg-primary-container hover:bg-primary text-on-primary-container',
  },
  {
    id: 'n2',
    group: 'today',
    category: 'appointment',
    categoryBadge: 'Appointment',
    categoryBadgeStyle: 'bg-secondary-fixed text-on-secondary-fixed',
    icon: 'video_camera_front',
    iconBgStyle: 'bg-surface-container-high text-secondary',
    timestampLabel: 'Today at 10:15 AM',
    title: 'Telehealth Consultation Confirmed',
    body: 'Upcoming Telehealth Consultation confirmed for tomorrow, Oct 26 at 2:00 PM with your assigned care provider.',
    isRead: false,
    primaryActionLabel: 'Manage Appointment',
    primaryActionHref: '/care-directory',
    primaryActionIcon: 'calendar_month',
    primaryActionStyle: 'bg-secondary hover:bg-secondary/90 text-on-secondary',
    secondaryActionLabel: 'Test Video Link',
    secondaryActionHref: '/care-directory',
  },
  {
    id: 'n3',
    group: 'today',
    category: 'reminder',
    categoryBadge: 'Follow-up Reminder',
    categoryBadgeStyle: 'bg-surface-container-high text-tertiary',
    icon: 'pending_actions',
    iconBgStyle: 'bg-surface-container-high text-tertiary',
    timestampLabel: 'Today at 08:00 AM',
    title: 'Daily Check-in Questionnaire Ready',
    body: 'Follow-up check-in due for active assessment session. Please complete your check-in questionnaire before end-of-day.',
    isRead: true,
    primaryActionLabel: 'Complete Check-in',
    primaryActionHref: '/assessments/new',
    primaryActionIcon: 'edit_note',
    primaryActionStyle: 'bg-surface-container-high hover:bg-surface-container-highest text-tertiary',
  },
  {
    id: 'n4',
    group: 'yesterday',
    category: 'clinical',
    categoryBadge: 'Clinician Assignment',
    categoryBadgeStyle: 'bg-surface-container text-primary',
    icon: 'assignment_ind',
    iconBgStyle: 'bg-surface-container text-primary',
    timestampLabel: 'Yesterday at 4:45 PM',
    title: 'Clinician Review Assigned',
    body: 'Clinician review requested on Oct 24 has been assigned to a licensed care specialist. Tap to view tracker and expected turnaround.',
    isRead: false,
    primaryActionLabel: 'View Review Tracker',
    primaryActionHref: '/assessments/history',
    primaryActionIcon: 'timeline',
    primaryActionStyle: 'bg-surface-container hover:bg-surface-container-high text-primary',
  },
  {
    id: 'n5',
    group: 'yesterday',
    category: 'record',
    categoryBadge: 'New Record',
    categoryBadgeStyle: 'bg-surface-container-high text-secondary',
    icon: 'folder_shared',
    iconBgStyle: 'bg-surface-container-high text-secondary',
    timestampLabel: 'Yesterday at 11:10 AM',
    title: 'Clinical Summary Document Uploaded',
    body: 'A new verified clinical summary document has been uploaded by St. Jude Regional Medical Center to your vault.',
    isRead: false,
    primaryActionLabel: 'View Document in Vault',
    primaryActionHref: '/records',
    primaryActionIcon: 'lock_open',
    primaryActionStyle: 'bg-surface-container-high hover:bg-surface-container-highest text-secondary',
  },
  {
    id: 'n6',
    group: 'earlier',
    category: 'record',
    categoryBadge: 'Record Archived',
    categoryBadgeStyle: 'bg-surface-container-low text-on-surface-variant',
    icon: 'description',
    iconBgStyle: 'bg-surface-container-low text-on-surface-variant',
    timestampLabel: 'Oct 22 at 2:15 PM',
    title: 'Annual Lab Archive Updated',
    body: 'Historical laboratory results from Q3 have completed validation and are securely mirrored to your personal medical vault.',
    isRead: true,
    primaryActionLabel: 'Access Lab Archive',
    primaryActionHref: '/records',
    primaryActionIcon: 'file_open',
    primaryActionStyle: 'bg-surface-container hover:bg-surface-container-high text-on-surface',
  },
  {
    id: 'n7',
    group: 'earlier',
    category: 'reminder',
    categoryBadge: 'Account Notice',
    categoryBadgeStyle: 'bg-surface-container-low text-on-surface-variant',
    icon: 'notifications_paused',
    iconBgStyle: 'bg-surface-container-low text-on-surface-variant',
    timestampLabel: 'Oct 21 at 09:00 AM',
    title: 'Care Protocol Acknowledgement Complete',
    body: 'Thank you for reviewing the updated telehealth decision-support terms and privacy policy amendments.',
    isRead: true,
  },
];

export default function NotificationCenterPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<NotifCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const visibleNotifications = notifications.filter((item) => {
    const matchesCat = activeFilter === 'all' || item.category === activeFilter;
    const matchesUnread = !unreadOnly || !item.isRead;
    return matchesCat && matchesUnread;
  });

  const unreadCount = visibleNotifications.filter((n) => !n.isRead).length;

  function markSingleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const todayItems = visibleNotifications.filter((n) => n.group === 'today');
  const yesterdayItems = visibleNotifications.filter((n) => n.group === 'yesterday');
  const earlierItems = visibleNotifications.filter((n) => n.group === 'earlier');

  return (
    <div className="space-y-6">
      {/* Privacy Shield Banner */}
      <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
          <MaterialIcon name="verified_user" className="text-[20px]" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 flex-1">
          <p className="font-body-sm text-body-sm text-on-surface">
            <strong className="font-headline-sm text-headline-sm text-primary">
              Privacy-Safe Previews:
            </strong>{' '}
            In compliance with HIPAA and healthcare privacy regulations, previews never disclose
            diagnoses, symptoms, medications, or sensitive diagnostic outcomes in unauthenticated
            push surfaces. Sign in to your verified session to unlock complete clinical records.
          </p>
          <span className="font-label-sm text-label-sm uppercase px-2.5 py-1 rounded-full bg-surface-container-highest text-secondary shrink-0 self-start md:self-auto font-medium tracking-wide">
            HIPAA Title II Enforced
          </span>
        </div>
      </div>

      {/* Header & Filter Bar */}
      <header className="space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                Care Communications
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
              <span className="font-label-sm text-label-sm text-outline font-mono">
                Ref ID #NOTIF-8201
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
                Notification Center
              </h1>
              <span
                id="unread-counter"
                className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${
                  unreadCount > 0
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container text-outline'
                }`}
              >
                {unreadCount} unread
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Stay updated on your ongoing care journey, clinician responses, and health vault
              document availability without exposing sensitive health data.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="mark-all-read-btn"
              type="button"
              onClick={markAllAsRead}
              className="h-10 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary font-label-lg text-label-lg transition-colors flex items-center gap-2"
            >
              <MaterialIcon name="done_all" className="text-[18px]" />
              <span>Mark all as read</span>
            </button>
            <Link
              href="/settings/privacy"
              className="h-10 px-4 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <MaterialIcon name="tune" className="text-[18px] text-outline" />
              <span>Notification Settings</span>
            </Link>
          </div>
        </div>

        {/* Filter Pills / Categories Tabs */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 shrink-0" id="filter-container">
            {(
              [
                { id: 'all', label: 'All', count: notifications.length },
                {
                  id: 'clinical',
                  label: 'Clinical Reviews',
                  dotColor: 'bg-primary',
                  count: notifications.filter((n) => n.category === 'clinical').length,
                },
                {
                  id: 'appointment',
                  label: 'Appointments',
                  dotColor: 'bg-secondary',
                  count: notifications.filter((n) => n.category === 'appointment').length,
                },
                {
                  id: 'reminder',
                  label: 'Reminders',
                  dotColor: 'bg-tertiary',
                  count: notifications.filter((n) => n.category === 'reminder').length,
                },
                {
                  id: 'record',
                  label: 'Records & Vault',
                  dotColor: 'bg-secondary-container',
                  count: notifications.filter((n) => n.category === 'record').length,
                },
              ] as const
            ).map((chip) => {
              const active = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id)}
                  className={`filter-chip h-10 px-4 rounded-full font-label-md text-label-md flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high shadow-xs'
                  }`}
                >
                  {'dotColor' in chip && chip.dotColor && (
                    <span className={`w-2 h-2 rounded-full ${chip.dotColor}`} />
                  )}
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/20' : 'text-outline'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="unread-toggle"
              className="flex items-center gap-2 cursor-pointer select-none text-on-surface-variant font-label-md text-label-md"
            >
              <span>Show unread only</span>
              <div className="relative">
                <input
                  id="unread-toggle"
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
              </div>
            </label>
          </div>
        </div>
      </header>

      {/* Main Feed & Right Contextual Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Notifications Column (8 cols) */}
        <section aria-label="Notification list" className="xl:col-span-8 flex flex-col gap-6">
          {visibleNotifications.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-surface-container-low text-primary flex items-center justify-center mx-auto">
                <MaterialIcon name="notifications_off" className="text-[24px]" />
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                No notifications match your current filter
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mx-auto">
                All clinical review updates and care reminders for this view have been read or
                dismissed.
              </p>
              <button
                type="button"
                onClick={() => {
                  setNotifications(INITIAL_NOTIFICATIONS);
                  setActiveFilter('all');
                  setUnreadOnly(false);
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md"
              >
                Restore Sample Notifications
              </button>
            </div>
          ) : (
            <>
              {[
                { key: 'today', title: 'Today', dateSub: 'October 25, 2025', items: todayItems },
                {
                  key: 'yesterday',
                  title: 'Yesterday',
                  dateSub: 'October 24, 2025',
                  items: yesterdayItems,
                },
                {
                  key: 'earlier',
                  title: 'Earlier this week',
                  dateSub: 'Oct 21 - Oct 23',
                  items: earlierItems,
                },
              ]
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          {group.title}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                        <span className="font-label-sm text-label-sm text-outline font-medium">
                          {group.dateSub}
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline">
                        {group.items.length} items
                      </span>
                    </div>

                    {group.items.map((item) => (
                      <article
                        key={item.id}
                        className={`notification-card relative rounded-xl p-4 shadow-sm transition-all hover:shadow-md ${
                          item.isRead
                            ? 'bg-surface-container-lowest/80 opacity-90'
                            : 'bg-surface-container-lowest'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBgStyle}`}
                          >
                            <MaterialIcon name={item.icon} className="text-[22px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${item.categoryBadgeStyle}`}
                                >
                                  {item.categoryBadge}
                                </span>
                                <span className="font-body-sm text-body-sm text-outline">
                                  {item.timestampLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!item.isRead && (
                                  <span
                                    className="unread-dot w-2 h-2 rounded-full bg-primary animate-pulse"
                                    title="Unread"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => dismissNotification(item.id)}
                                  title="Dismiss notification"
                                  className="dismiss-btn p-1 text-outline hover:text-on-surface rounded-lg hover:bg-surface-container-low transition-colors"
                                >
                                  <MaterialIcon name="close" className="text-[18px]" />
                                </button>
                              </div>
                            </div>

                            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1 truncate">
                              {item.title}
                            </h2>
                            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                              {item.body}
                            </p>

                            <div className="flex items-center gap-2 flex-wrap">
                              {item.primaryActionLabel && item.primaryActionHref && (
                                <Link
                                  href={item.primaryActionHref}
                                  className={`h-9 px-4 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1.5 shadow-xs ${item.primaryActionStyle}`}
                                >
                                  {item.primaryActionIcon && (
                                    <MaterialIcon
                                      name={item.primaryActionIcon}
                                      className="text-[16px]"
                                    />
                                  )}
                                  <span>{item.primaryActionLabel}</span>
                                </Link>
                              )}

                              {item.secondaryActionLabel && item.secondaryActionHref && (
                                <Link
                                  href={item.secondaryActionHref}
                                  className="h-9 px-3 rounded-lg text-secondary hover:bg-surface-container-low font-label-md text-label-md transition-colors flex items-center gap-1"
                                >
                                  <MaterialIcon name="devices" className="text-[16px]" />
                                  <span>{item.secondaryActionLabel}</span>
                                </Link>
                              )}

                              {!item.isRead && (
                                <button
                                  type="button"
                                  onClick={() => markSingleRead(item.id)}
                                  className="mark-single-read-btn h-9 px-3 rounded-lg text-secondary hover:bg-surface-container-low font-label-md text-label-md transition-colors"
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
            </>
          )}

          <div className="p-3 rounded-lg bg-surface-container-low text-center">
            <span className="font-label-sm text-label-sm text-outline">
              Fictional Sample Data - For Evaluation Only • CareNavigator HIPAA Compliant Gateway
            </span>
          </div>
        </section>

        {/* Right Contextual Drawer (4 cols) */}
        <aside className="xl:col-span-4 flex flex-col gap-6">
          {/* Urgent Assistance Emergency Card */}
          <div className="rounded-xl bg-error-container/60 p-4 shadow-sm">
            <div className="flex items-start gap-2.5 mb-2">
              <MaterialIcon name="emergency_home" className="text-error text-[24px]" />
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-error-container">
                  Need urgent medical care?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Notifications and messaging are not monitored continuously for medical
                  emergencies.
                </p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <a
                href="tel:999"
                className="w-full h-10 px-4 rounded-lg bg-error text-on-error font-headline-sm text-headline-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-xs"
              >
                <MaterialIcon name="call" className="text-[20px]" />
                <span>Call 999 / Emergency</span>
              </a>
              <a
                href="tel:18005550199"
                className="w-full h-10 px-4 rounded-lg bg-surface-container-lowest text-secondary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container transition-colors shadow-xs"
              >
                <MaterialIcon name="support_agent" className="text-[18px]" />
                <span>24/7 Nurse Triage Line</span>
              </a>
            </div>
          </div>

          {/* Notification Channels Status */}
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <MaterialIcon name="cell_tower" className="text-primary text-[20px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Delivery Channels
                </h2>
              </div>
              <Link
                href="/settings/privacy"
                className="font-label-sm text-label-sm text-secondary hover:underline"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
                    <MaterialIcon name="browser_updated" className="text-[16px]" />
                  </div>
                  <div>
                    <div className="font-label-md text-label-md text-on-surface font-semibold">
                      In-App Notification
                    </div>
                    <div className="font-body-sm text-body-sm text-outline">Real-time alerts</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
                    <MaterialIcon name="notifications_active" className="text-[16px]" />
                  </div>
                  <div>
                    <div className="font-label-md text-label-md text-on-surface font-semibold">
                      Mobile Push
                    </div>
                    <div className="font-body-sm text-body-sm text-outline">
                      Device: iOS (iPhone 15)
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
                    <MaterialIcon name="mail" className="text-[16px]" />
                  </div>
                  <div>
                    <div className="font-label-md text-label-md text-on-surface font-semibold">
                      Email Digest
                    </div>
                    <div className="font-body-sm text-body-sm text-outline">
                      s.jenkins@example.org
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-surface-container-low flex items-center justify-center text-outline">
                    <MaterialIcon name="sms" className="text-[16px]" />
                  </div>
                  <div>
                    <div className="font-label-md text-label-md text-on-surface font-semibold">
                      SMS / Text
                    </div>
                    <div className="font-body-sm text-body-sm text-outline">
                      Critical Security Only
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-outline font-label-sm text-label-sm">
                  Restricted
                </span>
              </div>
            </div>
          </div>

          {/* Privacy & Security Notice Widget */}
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-secondary">
              <MaterialIcon name="security" className="text-[20px]" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Data &amp; Privacy Controls
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
              CareNavigator sanitizes outward communications to safeguard medical records against
              lock-screen shoulder-surfing and unauthorized device exposure.
            </p>
            <div className="space-y-2">
              <Link
                href="/settings/privacy"
                className="w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-label-md text-label-md flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MaterialIcon name="key" className="text-[16px]" />
                  <span>Audit Notification Logs</span>
                </span>
                <MaterialIcon name="chevron_right" className="text-[16px]" />
              </Link>
              <Link
                href="/settings/privacy#section-communication"
                className="w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-label-md text-label-md flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MaterialIcon name="rule" className="text-[16px]" />
                  <span>Configure Message Masking</span>
                </span>
                <MaterialIcon name="chevron_right" className="text-[16px]" />
              </Link>
            </div>
          </div>

          {/* Decision Support Persistent Footer Notice */}
          <div className="p-4 rounded-xl bg-surface-container text-on-surface-variant">
            <div className="flex items-center gap-1.5 text-primary mb-1">
              <MaterialIcon name="info" className="text-[16px]" />
              <span className="font-label-sm text-label-sm uppercase font-semibold">
                Clinical Protocol
              </span>
            </div>
            <p className="font-body-sm text-body-sm">
              Decision-support output only. Validate all recommendations with licensed clinical
              protocols.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
