'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface LiveDbTelemetry {
  sessionsCount: number;
  completedReviewsCount: number;
  guidelinesCount: number;
  auditLogsCount: number;
}

export function AdminImpactDashboardView({ telemetry }: { telemetry: LiveDbTelemetry }) {
  const [dateRange, setDateRange] = useState('Last 30 Days: Oct 1 - Oct 31, 2024');
  const [facilityFilter, setFacilityFilter] = useState('All Clinical Networks (14)');
  const [regionFilter, setRegionFilter] = useState('North America & EU Regions');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Governance / Operational Disclaimer Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0 mt-0.5">
              <MaterialIcon name="verified_user" className="text-[24px]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Service activity metrics, not proof of health outcomes.
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container-high text-on-surface-variant uppercase tracking-wider font-semibold">
                  Governance Notice
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                These metrics evaluate triage throughput and workflow latency across automated
                channels. Clinical outcome efficacy is measured via independent longitudinal audits
                and peer reviews.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-label-sm font-label-sm text-secondary font-medium shadow-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Live Sync Active (Refreshes every 5m)
            </span>
          </div>
        </div>
      </div>

      {exportMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-3 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2 text-on-surface">
            <MaterialIcon name="check_circle" className="text-primary text-[18px]" />
            <span>{exportMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportMessage(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}

      {/* Page Header & Global Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span>Clinical Operations</span>
            <span>/</span>
            <span className="text-primary font-semibold">Performance Analytics</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Service Activity &amp; Operational Impact
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Operational throughput, workflow performance, and triage routing indicators across all
            deployment regions.
          </p>
        </div>

        {/* Filters & Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select Date Range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest shadow-xs text-on-surface text-label-lg font-label-lg cursor-pointer hover:bg-surface-container-low transition-colors"
          >
            <option>Last 30 Days: Oct 1 - Oct 31, 2024</option>
            <option>Q3 2024: Jul 1 - Sep 30, 2024</option>
            <option>Year to Date (2024)</option>
          </select>

          <select
            aria-label="Select Clinical Network"
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest shadow-xs text-on-surface text-label-lg font-label-lg cursor-pointer hover:bg-surface-container-low transition-colors"
          >
            <option>All Clinical Networks (14)</option>
            <option>Bay Memorial Health Alliance</option>
            <option>St. Jude Regional Partners</option>
          </select>

          <select
            aria-label="Select Deployment Region"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest shadow-xs text-on-surface text-label-lg font-label-lg cursor-pointer hover:bg-surface-container-low transition-colors"
          >
            <option>North America &amp; EU Regions</option>
            <option>North America - East (NA-E)</option>
            <option>North America - West (NA-W)</option>
            <option>Europe - Central (EU-C)</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setExportMessage(
                `Exported Executive Operational Impact Report (${dateRange}) to signed PDF & CSV.`
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors shadow-xs"
          >
            <MaterialIcon name="ios_share" className="text-[18px]" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Key Metric Cards Grid (5 core + 1 dedicated empty state card) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Card 1: Assessment Completion Rate */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Triage Throughput
                </span>
                <span
                  title="Definition: The percentage of started triage intake sessions that resulted in a finalized clinical recommendation or routing decision."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <MaterialIcon name="assignment_turned_in" className="text-[20px]" />
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Assessment Completion Rate
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                94.2%
              </span>
              <span className="inline-flex items-center gap-0.5 text-label-sm font-label-sm text-[#21865B] bg-[#DEF7EC] px-2 py-0.5 rounded-full font-semibold">
                <MaterialIcon name="trending_up" className="text-[14px]" />
                +1.8% vs last month
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              38,410 completed of 40,775 initiated (Sample Aggregate + {telemetry.sessionsCount}{' '}
              local DB sessions)
            </p>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl">
            <div className="flex items-center justify-between text-label-sm font-label-sm text-outline mb-1.5">
              <span>Daily Completion Stability</span>
              <span className="font-semibold text-on-surface">Target: &gt;90%</span>
            </div>
            <div className="flex items-end gap-1.5 h-7">
              <div
                className="flex-1 bg-primary/20 hover:bg-primary rounded-t-sm h-[75%] transition-all"
                title="Day 1-5: 91.2%"
              />
              <div
                className="flex-1 bg-primary/20 hover:bg-primary rounded-t-sm h-[82%] transition-all"
                title="Day 6-10: 92.4%"
              />
              <div
                className="flex-1 bg-primary/20 hover:bg-primary rounded-t-sm h-[88%] transition-all"
                title="Day 11-15: 93.6%"
              />
              <div
                className="flex-1 bg-primary/20 hover:bg-primary rounded-t-sm h-[86%] transition-all"
                title="Day 16-20: 93.1%"
              />
              <div
                className="flex-1 bg-primary/40 hover:bg-primary rounded-t-sm h-[94%] transition-all"
                title="Day 21-25: 94.0%"
              />
              <div
                className="flex-1 bg-primary rounded-t-sm h-[96%] transition-all"
                title="Day 26-30: 94.2%"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Time to Recommendation */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Algorithmic Velocity
                </span>
                <span
                  title="Definition: The elapsed time from the patient's submission of the final intake question to the generation of the preliminary algorithmic recommendation."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <MaterialIcon name="bolt" className="text-[20px]" />
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Time to Recommendation
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                2m 18s
              </span>
              <span className="inline-flex items-center gap-0.5 text-label-sm font-label-sm text-[#21865B] bg-[#DEF7EC] px-2 py-0.5 rounded-full font-semibold">
                <MaterialIcon name="arrow_downward" className="text-[14px]" />
                -14s vs benchmark
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Median automated triage generation time
            </p>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl">
            <div className="flex items-center justify-between text-label-sm font-label-sm text-outline mb-1.5">
              <span>Latency SLA: 3m 00s</span>
              <span className="font-semibold text-secondary">Optimal Band</span>
            </div>
            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
              <div className="bg-secondary h-full rounded-full" style={{ width: '76%' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Time to Clinician Review */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Clinical Oversight
                </span>
                <span
                  title="Definition: The duration between an assessment being flagged for human verification and a licensed clinician completing review."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <MaterialIcon name="medical_services" className="text-[20px]" />
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Time to Clinician Review
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                18m 45s
              </span>
              <span className="inline-flex items-center gap-0.5 text-label-sm font-label-sm text-[#21865B] bg-[#DEF7EC] px-2 py-0.5 rounded-full font-semibold">
                Within SLA (&lt; 30m)
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              For high-acuity &amp; protocol-triggered escalations
            </p>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl flex items-center justify-between">
            <span className="text-label-sm font-label-sm text-outline">Escalation Compliance</span>
            <span className="inline-flex items-center gap-1 text-label-sm font-label-sm text-primary font-semibold">
              <MaterialIcon name="check_circle" className="text-[16px]" />
              98.4% SLA Adherence
            </span>
          </div>
        </div>

        {/* Card 4: Referral Completion */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Care Continuity
                </span>
                <span
                  title="Definition: The proportion of patient encounters with recommended facility or specialist appointments that resulted in a verified booking."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <MaterialIcon name="sync_alt" className="text-[20px]" />
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Referral Completion
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                76.8%
              </span>
              <span className="inline-flex items-center gap-0.5 text-label-sm font-label-sm text-[#21865B] bg-[#DEF7EC] px-2 py-0.5 rounded-full font-semibold">
                <MaterialIcon name="trending_up" className="text-[14px]" />
                +3.2% MoM
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              8,920 confirmed bookings / care handoffs
            </p>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl">
            <div className="flex items-center justify-between text-label-sm font-label-sm text-outline mb-1.5">
              <span>Referred: 11,614</span>
              <span className="font-semibold text-on-surface">Booked: 8,920</span>
            </div>
            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
              <div className="bg-primary-container h-full rounded-full" style={{ width: '76.8%' }} />
            </div>
          </div>
        </div>

        {/* Card 5: Human Review Percentage */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Governance Safety
                </span>
                <span
                  title="Definition: The percentage of all patient intake assessments that undergo mandatory or requested manual physician validation."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <MaterialIcon name="safety_check" className="text-[20px]" />
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Human Review Percentage
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                22.6%
              </span>
              <span className="inline-flex items-center gap-0.5 text-label-sm font-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-semibold">
                Stable
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              9,215 of 40,775 cases routed to physician ({telemetry.completedReviewsCount} verified
              in local DB)
            </p>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl flex items-center justify-between">
            <span className="text-label-sm font-label-sm text-outline">Clinical Policy Band</span>
            <span className="text-label-sm font-label-sm text-on-surface font-semibold">
              Mandated: 20.0% – 25.0%
            </span>
          </div>
        </div>

        {/* Card 6: Dedicated Empty / "No Data Yet" State Card: Pediatric Specialized Triage Pathway */}
        <div className="relative group rounded-xl bg-surface-container-lowest p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline font-semibold">
                  Specialized Stream
                </span>
                <span
                  title="Definition: Triage velocity and escalation metrics specifically configured for under-18 protocol workflows."
                  className="cursor-help text-outline hover:text-primary"
                >
                  <MaterialIcon name="info" className="text-[16px]" />
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container text-on-surface-variant font-semibold">
                No data yet
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
              Pediatric Specialized Triage Pathway
            </h3>
            <div className="flex flex-col items-center justify-center text-center py-4 my-2">
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-outline mb-2">
                <MaterialIcon name="child_care" className="text-[24px]" />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">
                Specialized pediatric pathway triage protocol has not been enabled in this
                operational period. Metrics will populate automatically once live patient routing
                begins.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-6 -mb-6 px-6 pb-4 rounded-b-xl flex items-center justify-between">
            <Link
              href="/assessments/history"
              className="inline-flex items-center gap-1 text-label-sm font-label-sm text-primary hover:text-primary-container font-semibold transition-colors"
            >
              <span>Configure Protocol Thresholds</span>
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </Link>
            <span className="text-label-sm font-label-sm text-outline">Q1 Target</span>
          </div>
        </div>
      </div>

      {/* Regional Distribution & Throughput Section */}
      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Regional Distribution &amp; Throughput
              </h2>
              <MaterialIcon name="info" className="text-outline text-[18px]" />
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Comparative volume, completion efficiency, and escalation review latencies segmented
              by clinical telemetry cluster.
            </p>
          </div>

          <div className="flex items-center gap-3 text-label-sm font-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> 3 Active Clusters
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" /> 1 Pilot Awaiting
              Intake
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-outline text-label-sm font-label-sm uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-lg">Region Cluster</th>
                <th className="py-3 px-4">Total Volume</th>
                <th className="py-3 px-4">Completion Rate</th>
                <th className="py-3 px-4">Median Review</th>
                <th className="py-3 px-4">Volume Share</th>
                <th className="py-3 px-4 rounded-r-lg text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-body-sm font-body-sm">
              {/* Row 1: NA East */}
              <tr className="hover:bg-surface-container-low/60 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-semibold text-label-sm">
                      NA-E
                    </span>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        North America - East
                      </span>
                      <span className="text-label-sm font-label-sm text-outline">
                        Hub: Boston / Virginia Data Tier
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  16,840{' '}
                  <span className="text-label-sm font-label-sm text-outline font-normal">
                    assessments
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-on-surface">95.1%</span>
                    <div className="w-16 bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '95.1%' }} />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  16m <span className="text-label-sm font-label-sm text-[#21865B]">(Optimal)</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-label-sm font-label-sm text-on-surface-variant font-medium">
                    41.3% of total
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-[#DEF7EC] text-[#21865B] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#21865B]" />
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 2: NA West */}
              <tr className="hover:bg-surface-container-low/60 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-semibold text-label-sm">
                      NA-W
                    </span>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        North America - West
                      </span>
                      <span className="text-label-sm font-label-sm text-outline">
                        Hub: California / Oregon Tier
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  12,210{' '}
                  <span className="text-label-sm font-label-sm text-outline font-normal">
                    assessments
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-on-surface">93.8%</span>
                    <div className="w-16 bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '93.8%' }} />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  19m <span className="text-label-sm font-label-sm text-[#21865B]">(Optimal)</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-label-sm font-label-sm text-on-surface-variant font-medium">
                    29.9% of total
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-[#DEF7EC] text-[#21865B] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#21865B]" />
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 3: Europe Central */}
              <tr className="hover:bg-surface-container-low/60 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-semibold text-label-sm">
                      EU-C
                    </span>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Europe - Central
                      </span>
                      <span className="text-label-sm font-label-sm text-outline">
                        Hub: Frankfurt / Zurich GDPR Vault
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  7,420{' '}
                  <span className="text-label-sm font-label-sm text-outline font-normal">
                    assessments
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-on-surface">94.6%</span>
                    <div className="w-16 bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '94.6%' }} />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-on-surface">
                  21m{' '}
                  <span className="text-label-sm font-label-sm text-[#B7791F]">(Monitored)</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-label-sm font-label-sm text-on-surface-variant font-medium">
                    18.2% of total
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-[#DEF7EC] text-[#21865B] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#21865B]" />
                    Operational
                  </span>
                </td>
              </tr>

              {/* Row 4: Explicit "No Data Yet" State for Asia Pacific Pilot */}
              <tr className="bg-surface-container-low/40">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline font-semibold text-label-sm">
                      APAC
                    </span>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Asia Pacific (Sub-hub 3 - Pilot)
                      </span>
                      <span className="text-label-sm font-label-sm text-outline">
                        Hub: Singapore / Tokyo Relay
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4" colSpan={4}>
                  <div className="flex items-center gap-2 text-on-surface-variant bg-surface-container-lowest px-4 py-2 rounded-lg">
                    <MaterialIcon name="cloud_sync" className="text-outline text-[18px]" />
                    <span className="text-label-sm font-label-sm text-outline font-medium">
                      Telemetry awaiting cohort activation scheduled for Q1. No patient encounters
                      or clinician reviews recorded.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container text-outline font-semibold">
                    No data yet
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinical Quality Context & Administrative Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-surface-container-low text-on-surface-variant text-label-sm font-label-sm">
        <div className="flex items-center gap-2">
          <MaterialIcon name="lock" className="text-outline text-[16px]" />
          <span>
            Confidential - Operational &amp; Quality Assurance Committee Access Only. (Local DB:{' '}
            {telemetry.guidelinesCount} Guidelines • {telemetry.auditLogsCount} Audit Events)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>All timestamps UTC</span>
          <span className="w-1 h-1 rounded-full bg-outline" />
          <span className="font-mono text-outline">Audit Log ID: #AUD-8829-PX</span>
        </div>
      </div>
    </div>
  );
}
