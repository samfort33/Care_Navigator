import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      OR: [{ id }, { npiNumber: id }],
    },
    include: {
      availabilitySlots: {
        where: { isBooked: false },
        orderBy: { startsAt: 'asc' },
      },
    },
  });

  if (!doctor) {
    notFound();
  }

  const monogram = doctor.name
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const acceptedInsurances: string[] = (() => {
    try {
      return JSON.parse(doctor.acceptedInsurancesJson);
    } catch {
      return [];
    }
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/care-directory"
          className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:underline"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          <span>Back to Care Directory</span>
        </Link>
        <div className="flex items-center gap-2">
          <SeedFixtureBadge isSeedFixture={doctor.isSeedFixture} />
          <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-mono">
            {doctor.isSeedFixture ? 'Demo ID' : 'NPI'}: {doctor.npiNumber}
          </span>
        </div>
      </div>

      {/* Synthetic Fixture Notice */}
      {doctor.isSeedFixture && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-amber-950 flex items-start gap-3">
          <MaterialIcon name="info" className="text-amber-600 text-[20px] shrink-0 mt-0.5" />
          <div className="text-body-sm">
            <span className="font-semibold text-amber-900">Synthetic Development Provider Profile:</span>{' '}
            This clinician profile and availability schedule are simulated fixtures for development and testing. Do not use for live emergency navigation.
          </div>
        </div>
      )}

      {/* Doctor Profile Hero Card */}
      <section className="rounded-2xl bg-surface-container-lowest p-6 sm:p-8 shadow-ambient space-y-6 border border-outline-variant/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-surface-container">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary-gradient text-on-primary flex items-center justify-center font-headline-xl font-bold shrink-0 shadow-sm">
              {monogram}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                  {doctor.specialty}
                </span>
                {doctor.availableToday && (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                    Available Today
                  </span>
                )}
                {doctor.telehealthAvailable && (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                    Telehealth Available
                  </span>
                )}
                <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
                  <MaterialIcon name="star" filled className="text-[14px]" />
                  {doctor.rating.toFixed(1)} ({doctor.reviewCount} sample reviews)
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">
                {doctor.name}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {doctor.subspecialty || doctor.specialty} • {doctor.credentials}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              href={`/care-directory?specialty=${encodeURIComponent(doctor.specialty)}&doctorId=${doctor.id}`}
              className="px-5 py-3 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 text-center"
            >
              Select for Consultation
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                Clinical Biography &amp; Practice Focus
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {doctor.bio}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-outline uppercase">
                  Primary Affiliation &amp; Region
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface mt-1">
                  {doctor.hospitalAffiliation}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {doctor.locationAddress}, {doctor.city}, {doctor.state} {doctor.zipCode}
                </p>
                <p className="font-label-sm text-label-sm text-primary font-medium mt-1">
                  Division: {doctor.region}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-outline uppercase">
                  Consultation Pricing &amp; Network
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface mt-1">
                  {doctor.isSeedFixture ? `৳${doctor.consultationFee.toLocaleString('en-BD')} sample fee` : `$${doctor.consultationFee} standard consultation`}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {doctor.isSeedFixture ? 'Illustrative demo amount · BDT' : (doctor.inNetworkHospital ? 'In-Network Tier 1 Hospital Facility' : 'Out-of-Network Facility Rates May Apply')}
                </p>
                <p className="font-label-sm text-label-sm text-secondary font-medium mt-1">
                  Triage Match Alignment: {doctor.triageMatchPercent}%
                </p>
              </div>
            </div>

            {!doctor.isSeedFixture && acceptedInsurances.length > 0 && (
              <div className="pt-2">
                <h3 className="font-label-md text-label-md text-on-surface font-semibold mb-2">
                  Verified Accepted Insurance Networks
                </h3>
                <div className="flex flex-wrap gap-2">
                  {acceptedInsurances.map((ins) => (
                    <span
                      key={ins}
                      className="px-3 py-1 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm"
                    >
                      {ins}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Real Available Slots */}
          <div className="space-y-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Upcoming Availability
            </h2>
            {doctor.availabilitySlots.length > 0 ? (
              <div className="space-y-2">
                {doctor.availabilitySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium text-on-surface font-label-md text-label-md">
                        {slot.label}
                      </div>
                      <span className="font-body-xs text-body-xs text-on-surface-variant flex items-center gap-1">
                        <MaterialIcon
                          name={slot.modality === 'TELEHEALTH' ? 'videocam' : 'location_on'}
                          className="text-[14px] text-primary"
                        />
                        {slot.modality === 'TELEHEALTH' ? 'Secure Telehealth' : 'In-Person Consultation'}
                      </span>
                    </div>
                    <Link
                      href={`/care-directory?doctorId=${doctor.id}&slotId=${slot.id}`}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm hover:opacity-90 shrink-0"
                    >
                      Book Slot
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-container-low text-center space-y-2">
                <MaterialIcon name="event_busy" className="text-outline text-[28px] mx-auto" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  No appointment slots currently open for online booking.
                </p>
                <div className="font-mono text-label-sm text-outline">
                  Facility Line: (415) 555-0199
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
