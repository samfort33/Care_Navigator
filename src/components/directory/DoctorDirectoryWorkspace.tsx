'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';
import { useLanguage } from '@/lib/language';

export interface DoctorSlot {
  id: string;
  label: string;
  startsAt: string;
  modality: string;
  isBooked: boolean;
}

export interface ApiDoctor {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  subspecialty: string | null;
  npiNumber: string;
  hospitalAffiliation: string;
  locationAddress: string;
  city: string;
  state: string;
  zipCode: string;
  region: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  triageMatchPercent: number;
  acceptedInsurancesJson: string;
  telehealthAvailable: boolean;
  availableToday: boolean;
  inNetworkHospital: boolean;
  consultationFee: number;
  bio: string;
  isSeedFixture: boolean;
  availabilitySlots: DoctorSlot[];
}

interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  updatedAt: number;
}

function distanceKm(from: CurrentLocation, to: ApiDoctor) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(to.latitude - from.latitude);
  const lonDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DoctorDirectoryWorkspace({
  initialSpecialty = '',
}: {
  initialSpecialty?: string;
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState(initialSpecialty);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(initialSpecialty);
  const [selectedRegion, setSelectedRegion] = useState<string>('All Regions');
  const [configuredRegions, setConfiguredRegions] = useState<string[]>([]);
  const [telehealthOnly, setTelehealthOnly] = useState<boolean>(false);
  const [inNetworkOnly, setInNetworkOnly] = useState<boolean>(false);
  const [availableTodayOnly, setAvailableTodayOnly] = useState<boolean>(false);

  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [viewMode, setViewMode] = useState<'split' | 'list'>('split');
  const [bookingDoctor, setBookingDoctor] = useState<ApiDoctor | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [consultReason, setConsultReason] = useState<string>('Routine Triage Follow-up & Evaluation');
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const displayedDoctors = useMemo(() => {
    if (!currentLocation) return doctors;
    return [...doctors].sort(
      (a, b) => distanceKm(currentLocation, a) - distanceKm(currentLocation, b)
    );
  }, [currentLocation, doctors]);

  const requestCurrentLocation = useCallback(() => {
    if (!window.isSecureContext) {
      setLocationMessage('Your browser requires HTTPS to share GPS location. Choose a division or open this site over HTTPS.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported by this browser. Choose a division instead.');
      return;
    }
    setLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          updatedAt: Date.now(),
        });
        setLocating(false);
        setLocationMessage(null);
      },
      (geoError) => {
        setLocating(false);
        setLocationMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it in your browser or choose a division.'
            : geoError.code === geoError.TIMEOUT
              ? 'Could not get a location fix in time. Try again or choose a division.'
              : 'Current location is unavailable. Choose a division or try again.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('q', searchTerm.trim());
      if (selectedSpecialty && selectedSpecialty !== 'All') params.set('specialty', selectedSpecialty);
      if (selectedRegion && selectedRegion !== 'All Regions') params.set('region', selectedRegion);
      if (telehealthOnly) params.set('telehealth', 'true');
      if (inNetworkOnly) params.set('inNetwork', 'true');
      if (availableTodayOnly) params.set('availableToday', 'true');

      const res = await fetch(`/api/doctors?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setDoctors(data.doctors || []);
      if (data.configuredRegions && Array.isArray(data.configuredRegions)) {
        setConfiguredRegions(data.configuredRegions);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedSpecialty, selectedRegion, telehealthOnly, inNetworkOnly, availableTodayOnly]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    if (!bookingDoctor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBookingDoctor(null);
        setBookingError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingDoctor]);

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingDoctor) return;
    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const payload: {
        doctorId: string;
        slotId?: string;
        reason: string;
        modality?: 'TELEHEALTH' | 'IN_PERSON';
      } = {
        doctorId: bookingDoctor.id,
        reason: consultReason,
      };

      if (selectedSlotId) {
        payload.slotId = selectedSlotId;
        const chosenSlot = bookingDoctor.availabilitySlots.find((s) => s.id === selectedSlotId);
        if (chosenSlot) {
          payload.modality = chosenSlot.modality as 'TELEHEALTH' | 'IN_PERSON';
        }
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('This appointment slot was just booked by another patient. Please select another slot.');
        }
        throw new Error(resData.message || resData.error || 'Failed to book appointment.');
      }

      setBookingSuccess(
        `Appointment successfully confirmed with ${bookingDoctor.name}. An automated confirmation has been dispatched.`
      );
      setBookingDoctor(null);
      setSelectedSlotId('');
      // Reload directory to update slot availability
      loadDoctors();
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setBookingSubmitting(false);
    }
  }

  function getMonogram(name: string): string {
    return name
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  const specialties = [
    'All',
    'Cardiology',
    'Pulmonology',
    'Neurology',
    'Internal Medicine',
    'Dermatology',
    'Endocrinology',
    'Urgent Care',
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Directory Intro & Clinical Context Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm uppercase tracking-wider mb-3">
            <MaterialIcon name="medical_information" className="text-[16px]" />
            <span>{t('Bangladesh care directory · illustrative demo data')}</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            {t('Find Care by Specialty & Division')}
          </h1>
          <p className="mt-2 font-body-lg text-body-lg text-on-surface-variant">
            Browse sample provider profiles across Bangladesh. These demo records do not represent verified clinicians or real facilities.{' '}
            <span className="text-on-surface font-medium">
              Use your current location to sort sample providers by distance.
            </span>
          </p>
        </div>

        {/* Emergency Escalation Guardrail Callout */}
        <div className="bg-error-container/70 text-on-error-container p-4 rounded-xl max-w-md flex items-start gap-3 shadow-xs">
          <MaterialIcon name="emergency_home" className="text-error text-[22px] shrink-0 mt-0.5" />
          <div className="font-body-sm text-body-sm leading-snug">
            <strong className="font-semibold block text-on-error-container">
              Experiencing a Medical Emergency?
            </strong>
            Directory scheduling is for routine and urgent outpatient follow-up only. If you have
            chest pain, severe shortness of breath, or stroke symptoms, call Bangladesh emergency
            services at <strong>999</strong>{' '}
            immediately.
          </div>
        </div>
      </section>

      {/* Success Notification */}
      {bookingSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-sm flex items-center justify-between gap-4 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2.5 text-on-surface">
            <MaterialIcon name="check_circle" className="text-primary text-[20px]" />
            <span>{bookingSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setBookingSuccess(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
      )}

      {/* Primary Search & Multi-Dimension Filter Bar */}
      <section aria-label="Directory Search and Filters" className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Keyword Search */}
          <div className="md:col-span-5 relative">
            <label
              htmlFor="search-input"
              className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1.5"
            >
              {t('Specialty, Condition, or Clinician Name')}
            </label>
            <div className="relative flex items-center">
              <MaterialIcon
                name="search"
                className="text-outline absolute left-3.5 text-[20px]"
              />
              <input
                id="search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. Cardiology, Dr. Thorne, asthma..."
                className="w-full h-11 pl-11 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Region Filter */}
          <div className="md:col-span-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="region-select" className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('Division in Bangladesh')}</label>
              <button
                type="button"
                onClick={requestCurrentLocation}
                disabled={locating}
                className="shrink-0 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {locating ? t('Locating…') : currentLocation ? t('Refresh location') : t('Use my location')}
              </button>
            </div>
            <select
              id="region-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="All Regions">{t('All Bangladesh divisions')}</option>
              {configuredRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
            {locationMessage && <p role="status" className="mt-1 text-xs text-error">{locationMessage}</p>}
          </div>

          {/* Search Trigger Button */}
          <div className="md:col-span-3 flex items-end">
            <button
              type="button"
              onClick={loadDoctors}
              className="w-full h-11 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg font-semibold shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
            >
              <MaterialIcon name="manage_search" className="text-[20px]" />
              <span>{t('Search Directory')}</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Strip */}
        <div className="mt-4 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-1">
              Specialties:
            </span>
            {specialties.map((spec) => {
              const isSelected =
                (spec === 'All' && (!selectedSpecialty || selectedSpecialty === 'All')) ||
                selectedSpecialty.toLowerCase() === spec.toLowerCase();
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSelectedSpecialty(spec === 'All' ? 'All' : spec)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
                    isSelected
                      ? 'bg-secondary-container text-on-secondary-container font-semibold'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <span>{spec}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Attribute Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer text-body-sm font-medium text-on-surface">
              <input
                type="checkbox"
                checked={telehealthOnly}
                onChange={(e) => setTelehealthOnly(e.target.checked)}
                className="rounded accent-primary w-4 h-4"
              />
              <span>Telehealth</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-body-sm font-medium text-on-surface">
              <input
                type="checkbox"
                checked={inNetworkOnly}
                onChange={(e) => setInNetworkOnly(e.target.checked)}
                className="rounded accent-primary w-4 h-4"
              />
              <span>In-Network</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-body-sm font-medium text-on-surface">
              <input
                type="checkbox"
                checked={availableTodayOnly}
                onChange={(e) => setAvailableTodayOnly(e.target.checked)}
                className="rounded accent-primary w-4 h-4"
              />
              <span>Available Today</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedSpecialty('All');
                setSelectedRegion('All Regions');
                setTelehealthOnly(false);
                setInNetworkOnly(false);
                setAvailableTodayOnly(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-primary hover:bg-surface-container-low font-label-md text-label-md transition-colors"
            >
              <MaterialIcon name="restart_alt" className="text-[16px]" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Directory Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Doctor Cards List */}
        <div className={`${viewMode === 'split' ? 'xl:col-span-8' : 'xl:col-span-12'} flex flex-col gap-4`}>
          <div className="flex items-center justify-between px-1">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('Showing ')}
              <strong className="text-on-surface font-semibold">{displayedDoctors.length}</strong>{' '}
              {t(' sample clinicians in')}{' '}
              <strong className="text-on-surface font-semibold">{selectedRegion}</strong>
            </p>
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg font-label-sm text-label-sm flex items-center gap-1 transition-all ${
                  viewMode === 'list'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <MaterialIcon name="view_list" className="text-[16px]" />
                <span>List View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg font-label-sm text-label-sm flex items-center gap-1 transition-all ${
                  viewMode === 'split'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <MaterialIcon name="map" className="text-[16px]" />
                <span>Split Map</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/20">
              <MaterialIcon name="sync" className="animate-spin text-primary text-3xl mx-auto mb-2" />
              <p className="font-body-md">Loading care directory...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error rounded-2xl bg-error-container/20 border border-error/30">
              <MaterialIcon name="error" className="text-3xl mx-auto mb-2" />
              <p className="font-body-md font-semibold">{error}</p>
              <button
                type="button"
                onClick={loadDoctors}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-on-primary text-body-sm font-semibold"
              >
                Retry
              </button>
            </div>
          ) : doctors.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/20 space-y-2">
              <MaterialIcon name="person_search" className="text-4xl text-outline mx-auto" />
              <h3 className="font-headline-sm text-on-surface">No clinicians matched your criteria</h3>
              <p className="font-body-sm">
                Try widening your region or clearing specific filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSpecialty('All');
                  setSelectedRegion('All Regions');
                  setTelehealthOnly(false);
                  setInNetworkOnly(false);
                  setAvailableTodayOnly(false);
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedDoctors.map((doc) => (
                <article
                  key={doc.id}
                  className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4 border border-outline-variant/15"
                >
                  <div className="flex flex-col gap-4">
                    {/* Top Header: Monogram, Badges & Name */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary-gradient text-on-primary flex items-center justify-center font-headline-md font-bold shrink-0 shadow-xs">
                        {getMonogram(doc.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                            {doc.specialty}
                          </span>
                          <SeedFixtureBadge isSeedFixture={doc.isSeedFixture} />
                          {doc.availableToday && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              Available Today
                            </span>
                          )}
                        </div>
                        <h2 className="font-headline-sm text-headline-sm text-on-surface mt-1.5 truncate">
                          {doc.name}
                        </h2>
                        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                          {doc.subspecialty || doc.credentials}
                        </p>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-3.5 rounded-xl bg-surface-container-low font-body-sm text-body-sm">
                      <div className="flex min-w-0 items-start gap-2">
                        <MaterialIcon name="apartment" className="text-outline text-[18px] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-semibold text-on-surface break-words">{doc.hospitalAffiliation}</div>
                          <div className="text-on-surface-variant text-[12px] break-words">{doc.city}, {doc.state}</div>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2">
                        <MaterialIcon name="payments" className="text-outline text-[18px] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-semibold text-on-surface">৳{doc.consultationFee.toLocaleString('en-BD')}</div>
                          <div className="text-on-surface-variant text-[12px] break-words">{doc.isSeedFixture ? `Sample fee · BDT${currentLocation ? ` · ~${distanceKm(currentLocation, doc).toFixed(1)} km away` : ''}` : (doc.inNetworkHospital ? 'In network' : 'Out of network')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="star" filled className="text-amber-500 text-[18px]" />
                        <span className="font-semibold text-on-surface">
                          {doc.rating.toFixed(1)}{' '}
                          <span className="font-normal text-on-surface-variant text-[12px]">
                            ({doc.reviewCount})
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="videocam" className="text-primary text-[18px]" />
                        <span className="text-on-surface truncate">
                          {doc.telehealthAvailable ? 'Telehealth & In-Person' : 'In-Person Only'}
                        </span>
                      </div>
                    </div>

                    {/* Next Available Slots */}
                    <div>
                      <span className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5 uppercase tracking-wider">
                        Next Available Appointments:
                      </span>
                      {doc.availabilitySlots.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.availabilitySlots.slice(0, 3).map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => {
                                setBookingDoctor(doc);
                                setSelectedSlotId(slot.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary-fixed/50 hover:text-on-primary-fixed text-on-surface font-label-sm text-label-sm transition-colors text-left"
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-body-sm text-on-surface-variant italic">
                          No open slots today. Call office or request waitlist.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-surface-container">
                    <Link
                      href={`/care-directory/${doc.id}`}
                      className="flex-1 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MaterialIcon name="badge" className="text-[18px]" />
                      <span>Full Profile</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingDoctor(doc);
                        setSelectedSlotId(doc.availabilitySlots[0]?.id || '');
                      }}
                      className="flex-1 h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <MaterialIcon name="calendar_month" className="text-[18px]" />
                      <span>Book Slot</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Split Map & Triage Context Panel */}
        {viewMode === 'split' && (
          <aside aria-label="Location and Clinical Guidance" className="xl:col-span-4 sticky top-20 space-y-4">
            {/* Location and nearby coverage */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4 border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-on-surface flex min-w-0 items-center gap-1.5">
                  <MaterialIcon name="near_me" className="text-primary text-[18px]" />
                  <span className="truncate">
                    Care access: {selectedRegion === 'All Regions' ? 'Bangladesh' : selectedRegion}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={requestCurrentLocation}
                  disabled={locating}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container disabled:opacity-60"
                  aria-label={currentLocation ? 'Refresh current location' : 'Use my current location'}
                >
                  {locating ? 'Locating…' : currentLocation ? 'Refresh GPS' : 'Use my location'}
                </button>
              </div>

              <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                    <MaterialIcon name="location_on" className="text-[22px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface">{currentLocation ? t('Nearby sample providers') : t('Explore Bangladesh coverage')}</p>
                    <p className="text-xs text-on-surface-variant">
                      {currentLocation
                        ? `Location updated ${new Date(currentLocation.updatedAt).toLocaleTimeString()} · accuracy ±${Math.round(currentLocation.accuracy)} m`
                        : `${displayedDoctors.length} sample profiles · choose a division or share location`}
                    </p>
                  </div>
                </div>
                {locationMessage && <p role="status" className="text-sm text-error">{locationMessage}</p>}
                <ul className="divide-y divide-outline-variant/30">
                  {displayedDoctors.slice(0, 3).map((doc) => (
                    <li key={doc.id} className="flex justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-on-surface">{doc.city}, {doc.state}</span>
                      {currentLocation && <span className="shrink-0 text-on-surface-variant">~{distanceKm(currentLocation, doc).toFixed(1)} km</span>}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-on-surface-variant">Demo directory only. GPS is used on this device to sort sample locations; no coordinates are sent to the server.</p>
              </div>
            </div>

            {/* Assessment Link Card */}
            <div className="bg-secondary-container/50 border border-secondary/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-secondary">
                <MaterialIcon name="assignment" className="text-[20px]" />
                <span className="font-label-md text-label-md font-semibold">Triage Referral Matching</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Need guidance on which specialist to see? Complete a structured clinical assessment to receive personalized, guideline-backed provider matches.
              </p>
              <Link
                href="/assessments/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-xs"
              >
                <span>Start Triage Assessment</span>
                <MaterialIcon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* Appointment Request Modal */}
      {bookingDoctor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-xs"
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-ambient-lg space-y-5 border border-outline-variant/20">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-surface-container">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                  Outpatient Care Coordination
                </span>
                <h2
                  id="booking-modal-title"
                  className="font-headline-md text-headline-md text-on-surface mt-0.5"
                >
                  Book with {bookingDoctor.name}
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {bookingDoctor.specialty} • {bookingDoctor.hospitalAffiliation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBookingDoctor(null);
                  setBookingError(null);
                }}
                className="p-1.5 rounded-lg text-outline hover:bg-surface-container"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {bookingError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm flex items-start gap-2">
                <MaterialIcon name="error" className="text-[18px] shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-2">
                  Select Available Appointment Slot:
                </label>
                {bookingDoctor.availabilitySlots.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {bookingDoctor.availabilitySlots.map((slot) => (
                      <label
                        key={slot.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedSlotId === slot.id
                            ? 'bg-primary-fixed/40 border-primary font-semibold'
                            : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MaterialIcon
                            name={slot.modality === 'TELEHEALTH' ? 'videocam' : 'local_hospital'}
                            className="text-primary text-[18px]"
                          />
                          <span className="font-body-sm text-body-sm text-on-surface">{slot.label}</span>
                        </div>
                        <input
                          type="radio"
                          name="slot"
                          value={slot.id}
                          checked={selectedSlotId === slot.id}
                          onChange={() => setSelectedSlotId(slot.id)}
                          className="accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant">
                    No open availability slots currently published for this clinician. An appointment coordinator will confirm availability.
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="consult-reason"
                  className="block font-label-md text-label-md text-on-surface mb-1.5"
                >
                  Consultation Reason &amp; Clinical Focus:
                </label>
                <input
                  id="consult-reason"
                  type="text"
                  required
                  value={consultReason}
                  onChange={(e) => setConsultReason(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <input
                  type="checkbox"
                  defaultChecked
                  id="share-triage-packet"
                  className="mt-1 accent-primary"
                />
                <label
                  htmlFor="share-triage-packet"
                  className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer"
                >
                  Attach my recent CareNavigator AI triage assessment summary and verified allergies for pre-visit review.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBookingDoctor(null);
                    setBookingError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {bookingSubmitting ? (
                    <>
                      <MaterialIcon name="sync" className="animate-spin text-[18px]" />
                      <span>Reserving Slot...</span>
                    </>
                  ) : (
                    <span>Confirm Booking</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
