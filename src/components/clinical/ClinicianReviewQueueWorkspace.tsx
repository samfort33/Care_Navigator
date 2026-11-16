'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export interface ReviewItem {
  id: string;
  sessionId: string;
  stage: 'QUEUED' | 'REVIEWING' | 'SIGNED' | 'ESCALATED';
  concordanceStatus: 'PENDING' | 'AGREED' | 'OVERRIDDEN_HIGHER' | 'OVERRIDDEN_LOWER';
  overriddenAcuity: string | null;
  clinicianNote: string | null;
  signedAt: string | null;
  updatedAt: string;
  isSeedFixture: boolean;
  clinician: {
    id: string;
    name: string;
    title: string | null;
  };
  session: {
    sessionCode: string;
    chiefComplaint: string;
    acuityLevel: string;
    status: string;
    createdAt: string;
    patientProfile: {
      id: string;
      age: number;
      sex: string;
      user: {
        name: string;
        mrn?: string | null;
      };
    };
    _count: {
      citations: number;
      uploadedMedia: number;
    };
  };
}

export function ClinicianReviewQueueWorkspace() {
  const [activeStage, setActiveStage] = useState<string>('ALL');
  const [acuityFilter, setAcuityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [metrics, setMetrics] = useState({
    queued: 0,
    reviewing: 0,
    signed: 0,
    escalated: 0,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeStage !== 'ALL') params.set('stage', activeStage);
      if (acuityFilter !== 'ALL') params.set('acuity', acuityFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied. Only clinicians or admins may access the review queue.');
        }
        throw new Error(`Failed to load queue (HTTP ${res.status})`);
      }
      const data = await res.json();
      setReviews(data.reviews || []);
      if (data.metrics) setMetrics(data.metrics);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching reviews');
    } finally {
      setLoading(false);
    }
  }, [activeStage, acuityFilter, searchQuery]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const stages = [
    { key: 'ALL', label: 'All Reviews', count: metrics.total },
    { key: 'QUEUED', label: 'Queued (Pending)', count: metrics.queued },
    { key: 'REVIEWING', label: 'In Review', count: metrics.reviewing },
    { key: 'SIGNED', label: 'Signed & Verified', count: metrics.signed },
    { key: 'ESCALATED', label: 'Escalated', count: metrics.escalated },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider mb-2">
            <MaterialIcon name="assignment_ind" className="text-[16px]" />
            <span>Human-in-the-Loop Clinical Verification</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            Clinician Review &amp; Attestation Queue
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Role-protected queue for evaluating AI triage assessments, inspecting source-backed clinical guidelines, and certifying care decisions.
          </p>
        </div>

        {/* Quick Protocol Badge */}
        <div className="px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3 shadow-xs">
          <MaterialIcon name="verified_user" className="text-primary text-[24px]" />
          <div>
            <div className="font-label-sm text-label-sm uppercase text-outline">Clinical Protocol</div>
            <div className="font-mono text-body-sm font-semibold text-on-surface">CDS-HITL-STAGE-4</div>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-outline uppercase">Queued</span>
            <MaterialIcon name="hourglass_top" className="text-amber-500 text-[18px]" />
          </div>
          <div className="font-headline-lg font-bold text-on-surface mt-1">{metrics.queued}</div>
          <div className="text-[12px] text-on-surface-variant">Awaiting clinician intake</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-outline uppercase">Reviewing</span>
            <MaterialIcon name="rate_review" className="text-secondary text-[18px]" />
          </div>
          <div className="font-headline-lg font-bold text-on-surface mt-1">{metrics.reviewing}</div>
          <div className="text-[12px] text-on-surface-variant">Currently under clinician analysis</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-outline uppercase">Signed Off</span>
            <MaterialIcon name="check_circle" className="text-primary text-[18px]" />
          </div>
          <div className="font-headline-lg font-bold text-on-surface mt-1">{metrics.signed}</div>
          <div className="text-[12px] text-on-surface-variant">Care plans verified</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-outline uppercase">Escalated</span>
            <MaterialIcon name="warning" className="text-error text-[18px]" />
          </div>
          <div className="font-headline-lg font-bold text-error mt-1">{metrics.escalated}</div>
          <div className="text-[12px] text-on-surface-variant">Urgent action required</div>
        </div>
      </section>

      {/* Stage Tab Bar & Filter Controls */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-surface-container">
          {stages.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setActiveStage(st.key)}
              className={`px-4 py-2 rounded-xl font-label-md text-label-md font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeStage === st.key
                  ? 'bg-secondary-container text-on-secondary-container shadow-xs'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                  activeStage === st.key ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'
                }`}
              >
                {st.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-7 relative">
            <MaterialIcon name="search" className="text-outline absolute left-3.5 top-3 text-[18px]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Patient MRN, Name, or Chief Complaint..."
              className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={acuityFilter}
              onChange={(e) => setAcuityFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ALL">All Acuity Levels</option>
              <option value="EMERGENCY">Emergency (Acuity 1)</option>
              <option value="URGENT">Urgent (Acuity 2)</option>
              <option value="ROUTINE">Routine (Acuity 3)</option>
              <option value="SELF_CARE">Self-Care (Acuity 4)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={fetchReviews}
              className="w-full h-10 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <MaterialIcon name="refresh" className="text-[18px]" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* Queue Content */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <MaterialIcon name="sync" className="animate-spin text-primary text-3xl mx-auto mb-2" />
            <p className="text-body-md">Loading clinical attestation queue...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-error bg-error-container/20">
            <MaterialIcon name="error" className="text-3xl mx-auto mb-2" />
            <p className="font-semibold text-body-md">{error}</p>
            <button
              type="button"
              onClick={fetchReviews}
              className="mt-3 px-4 py-2 rounded-xl bg-primary text-on-primary text-body-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-2">
            <MaterialIcon name="inbox" className="text-4xl text-outline mx-auto" />
            <h3 className="font-headline-sm text-on-surface">No assessments in this queue</h3>
            <p className="text-body-sm">
              All clinical triage assessments for this stage have been verified or no records match your filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-4">Dossier / Session</th>
                  <th className="py-3 px-4">Patient Profile</th>
                  <th className="py-3 px-4">Chief Complaint</th>
                  <th className="py-3 px-4">Acuity &amp; Concordance</th>
                  <th className="py-3 px-4">Clinical Evidence</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {reviews.map((rev) => {
                  const acuity = rev.overriddenAcuity || rev.session.acuityLevel;
                  return (
                    <tr key={rev.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/reviews/${rev.id}`} className="hover:underline">
                            #{rev.session.sessionCode}
                          </Link>
                          <SeedFixtureBadge isSeedFixture={rev.isSeedFixture} />
                        </div>
                        <div className="text-[11px] font-normal text-on-surface-variant font-sans">
                          {new Date(rev.session.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-on-surface">
                          {rev.session.patientProfile.user.name}
                        </div>
                        <div className="text-[12px] text-on-surface-variant font-mono">
                          {rev.session.patientProfile.user.mrn || 'N/A'} • {rev.session.patientProfile.age}y/{rev.session.patientProfile.sex?.[0] || 'U'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-on-surface truncate">
                          {rev.session.chiefComplaint}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                              acuity === 'EMERGENCY'
                                ? 'bg-red-100 text-red-800'
                                : acuity === 'URGENT'
                                ? 'bg-amber-100 text-amber-900'
                                : acuity === 'ROUTINE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {acuity}
                          </span>
                          {rev.concordanceStatus !== 'PENDING' && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                rev.concordanceStatus === 'AGREED'
                                  ? 'bg-primary-fixed text-on-primary-fixed'
                                  : 'bg-purple-100 text-purple-900'
                              }`}
                            >
                              {rev.concordanceStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-on-surface-variant text-[12px]">
                          <span className="inline-flex items-center gap-0.5">
                            <MaterialIcon name="menu_book" className="text-[15px] text-secondary" />
                            {rev.session._count.citations} Guidelines
                          </span>
                          {rev.session._count.uploadedMedia > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MaterialIcon name="attach_file" className="text-[15px] text-outline" />
                              {rev.session._count.uploadedMedia}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                            rev.stage === 'SIGNED'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : rev.stage === 'ESCALATED'
                              ? 'bg-red-100 text-red-900 font-bold'
                              : rev.stage === 'REVIEWING'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {rev.stage}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/reviews/${rev.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold hover:bg-primary-container transition-colors shadow-xs"
                        >
                          <span>Review Dossier</span>
                          <MaterialIcon name="arrow_forward" className="text-[14px]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
