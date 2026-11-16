'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SeedFixtureBadge } from '@/components/ui/SeedFixtureBadge';

export type ProfileSubTab =
  | 'overview'
  | 'history'
  | 'prescriptions'
  | 'reports'
  | 'diagnoses'
  | 'documents';

interface ClinicalDocRecord {
  id: string;
  title: string;
  subtitle: string;
  typeTag: 'Lab Report' | 'Care Summary' | 'Triage Log' | 'Patient Upload' | 'Imaging' | 'Prescription';
  icon: string;
  iconColor: string;
  dateRecorded: string;
  sourceName: string;
  sourceRole: string;
  governanceStatus: 'CLINICIAN_VERIFIED' | 'AI_TRIAGE' | 'PATIENT_REPORTED';
  governanceBy?: string;
  biomarkers: Array<{
    name: string;
    value: string;
    unit: string;
    status: string;
    referenceRange: string;
  }>;
  specimenLines: Array<{ label: string; value: string }>;
}

const CLINICAL_DOCUMENTS: ClinicalDocRecord[] = [
  {
    id: 'doc-cmp-lipid',
    title: 'Comprehensive Metabolic Panel & Lipid Panel',
    subtitle: 'PDF • 1.4 MB • Order #LAB-99201',
    typeTag: 'Lab Report',
    icon: 'biotech',
    iconColor: 'bg-primary/10 text-primary',
    dateRecorded: 'Oct 24, 2024',
    sourceName: 'Quest Diagnostics',
    sourceRole: 'Ordered by Dr. A. Thorne',
    governanceStatus: 'CLINICIAN_VERIFIED',
    governanceBy: 'Dr. Ayesha Rahman, MBBS, FCPS',
    biomarkers: [
      {
        name: 'Fasting Glucose',
        value: '92',
        unit: 'mg/dL',
        status: 'Normal',
        referenceRange: 'Ref: 70–99 mg/dL',
      },
      {
        name: 'Total Cholesterol',
        value: '185',
        unit: 'mg/dL',
        status: 'Optimal',
        referenceRange: 'Ref: <200 mg/dL',
      },
      {
        name: 'HDL / LDL',
        value: '58 / 104',
        unit: 'mg/dL',
        status: 'Normal',
        referenceRange: 'Target LDL <100',
      },
      {
        name: 'eGFR (Renal)',
        value: '>90',
        unit: 'mL/min',
        status: 'Normal',
        referenceRange: 'Ref: >60 mL/min',
      },
    ],
    specimenLines: [
      { label: 'Sodium, Serum', value: '140 mmol/L (135-145)' },
      { label: 'Potassium, Serum', value: '4.2 mmol/L (3.5-5.1)' },
      { label: 'Creatinine', value: '0.82 mg/dL (0.55-1.02)' },
    ],
  },
  {
    id: 'doc-annual-wellness',
    title: 'Annual Wellness Exam & Preventive Care Plan',
    subtitle: 'PDF • 840 KB • Visit #ENC-4410',
    typeTag: 'Care Summary',
    icon: 'clinical_notes',
    iconColor: 'bg-secondary-container/40 text-secondary',
    dateRecorded: 'Oct 12, 2024',
    sourceName: 'Metro General Clinic',
    sourceRole: 'Internal Medicine',
    governanceStatus: 'CLINICIAN_VERIFIED',
    governanceBy: 'Dr. Ayesha Rahman, MBBS, FCPS',
    biomarkers: [
      {
        name: 'Blood Pressure',
        value: '124/78',
        unit: 'mmHg',
        status: 'Controlled',
        referenceRange: 'Target: <130/80',
      },
      {
        name: 'Resting Pulse',
        value: '72',
        unit: 'BPM',
        status: 'Normal',
        referenceRange: 'Ref: 60–100 BPM',
      },
      {
        name: 'BMI',
        value: '22.8',
        unit: 'kg/m²',
        status: 'Normal',
        referenceRange: 'Ref: 18.5–24.9',
      },
      {
        name: 'SpO2 Room Air',
        value: '99',
        unit: '%',
        status: 'Optimal',
        referenceRange: 'Ref: 95–100%',
      },
    ],
    specimenLines: [
      { label: 'Asthma Control Test (ACT)', value: '22 / 25 (Well Controlled)' },
      { label: 'Influenza / COVID Booster', value: 'Administered Oct 12, 2024' },
      { label: 'Follow-up Interval', value: '6 Months Routine' },
    ],
  },
  {
    id: 'doc-uri-triage',
    title: 'Upper Respiratory & Mild Dyspnea Assessment',
    subtitle: 'JSON/PDF • 320 KB • Ref #TRI-8804',
    typeTag: 'Triage Log',
    icon: 'psychology',
    iconColor: 'bg-tertiary-container/30 text-tertiary',
    dateRecorded: 'Sep 29, 2024',
    sourceName: 'CareNavigator AI Engine',
    sourceRole: 'Symptom Triage v4.2',
    governanceStatus: 'AI_TRIAGE',
    governanceBy: 'Reviewed by RN C. Miller',
    biomarkers: [
      {
        name: 'Oral Temp',
        value: '99.4',
        unit: '°F',
        status: 'Low-Grade',
        referenceRange: 'Ref: 97.8–99.1°F',
      },
      {
        name: 'Peak Expiratory Flow',
        value: '410',
        unit: 'L/min',
        status: '86% Personal Best',
        referenceRange: 'Green Zone >80%',
      },
      {
        name: 'Respiratory Rate',
        value: '19',
        unit: 'br/min',
        status: 'Mild Elev.',
        referenceRange: 'Ref: 12–18 br/min',
      },
      {
        name: 'Red Flags',
        value: '0 / 6',
        unit: 'Triggered',
        status: 'Excluded',
        referenceRange: 'Tier 2 Protocol',
      },
    ],
    specimenLines: [
      { label: 'Primary Guideline', value: 'GINA 2024 / NICE NG191' },
      { label: 'Recommended Acuity', value: 'Outpatient Evaluation 24-48h' },
      { label: 'RN Sign-off', value: 'Confirmed by C. Miller, RN' },
    ],
  },
  {
    id: 'doc-home-bp',
    title: 'Home Blood Pressure & Pulse Oximetry 14-Day Log',
    subtitle: 'CSV/PDF • 510 KB • Patient Upload',
    typeTag: 'Patient Upload',
    icon: 'upload_file',
    iconColor: 'bg-surface-container-high text-on-surface-variant',
    dateRecorded: 'Sep 15, 2024',
    sourceName: 'Nusrat Jahan',
    sourceRole: 'Apple Health / Omron Sync',
    governanceStatus: 'PATIENT_REPORTED',
    biomarkers: [
      {
        name: '14-Day Avg Systolic',
        value: '126',
        unit: 'mmHg',
        status: 'Self-Logged',
        referenceRange: 'Goal <130 mmHg',
      },
      {
        name: '14-Day Avg Diastolic',
        value: '79',
        unit: 'mmHg',
        status: 'Self-Logged',
        referenceRange: 'Goal <80 mmHg',
      },
      {
        name: 'Mean Resting HR',
        value: '75',
        unit: 'BPM',
        status: 'Normal',
        referenceRange: '60–100 BPM',
      },
      {
        name: 'Mean SpO2',
        value: '98',
        unit: '%',
        status: 'Normal',
        referenceRange: '95–100%',
      },
    ],
    specimenLines: [
      { label: 'Device Hardware', value: 'Omron Platinum Cuff + Apple Watch' },
      { label: 'Total Readings', value: '28 Morning & Evening Captures' },
      { label: 'Clinician Status', value: 'Pending Physician Sign-Off' },
    ],
  },
  {
    id: 'doc-cxr',
    title: 'Chest X-Ray (PA & Lateral) 2-View Report',
    subtitle: 'DICOM/PDF • 4.8 MB • Study #IMG-2041',
    typeTag: 'Imaging',
    icon: 'radiology',
    iconColor: 'bg-primary/10 text-primary',
    dateRecorded: 'Aug 04, 2024',
    sourceName: 'Valley Diagnostic Imaging',
    sourceRole: 'Radiology Dept',
    governanceStatus: 'CLINICIAN_VERIFIED',
    governanceBy: 'Dr. L. Patel, MD',
    biomarkers: [
      {
        name: 'Cardiothoracic Ratio',
        value: '0.44',
        unit: 'Ratio',
        status: 'Normal',
        referenceRange: 'Ref: <0.50',
      },
      {
        name: 'Lung Fields',
        value: 'Clear',
        unit: 'Bilaterally',
        status: 'Normal',
        referenceRange: 'No consolidation',
      },
      {
        name: 'Costophrenic Angles',
        value: 'Sharp',
        unit: 'L & R',
        status: 'No Effusion',
        referenceRange: 'Normal pleura',
      },
      {
        name: 'Mediastinum',
        value: 'Unremarkable',
        unit: 'Contour',
        status: 'Normal',
        referenceRange: 'Midline trachea',
      },
    ],
    specimenLines: [
      { label: 'Impression', value: 'No acute cardiopulmonary disease' },
      { label: 'Comparison', value: 'Baseline CXR Nov 2022' },
      { label: 'Signed By', value: 'Dr. L. Patel, MD (Board Certified)' },
    ],
  },
  {
    id: 'doc-rx-augmentin',
    title: 'Amoxicillin-Clavulanate 875mg — E-Prescription',
    subtitle: 'PDF • 210 KB • Rx #RX-77120',
    typeTag: 'Prescription',
    icon: 'prescriptions',
    iconColor: 'bg-secondary-container/40 text-secondary',
    dateRecorded: 'Jul 19, 2024',
    sourceName: 'Metro General Pharmacy',
    sourceRole: 'Outpatient Dispensary',
    governanceStatus: 'CLINICIAN_VERIFIED',
    governanceBy: 'Dr. M. Vance, MD (Archived Hold)',
    biomarkers: [
      {
        name: 'Allergy Cross-Check',
        value: 'HOLD',
        unit: 'Penicillin Flag',
        status: 'Switched to Doxycycline',
        referenceRange: 'CDSS Alert #RX-09',
      },
      {
        name: 'Replacement Rx',
        value: '100',
        unit: 'mg BID',
        status: 'Completed',
        referenceRange: '7-Day Course',
      },
    ],
    specimenLines: [
      { label: 'Safety Intercept', value: 'Penicillin allergy flagged prior to dispense' },
      { label: 'Substituted Agent', value: 'Doxycycline Monohydrate 100mg' },
      { label: 'Pharmacist Sign-off', value: 'R. Gomez, PharmD' },
    ],
  },
];

export interface LivePatientProfile {
  id: string;
  userId: string;
  dateOfBirth?: string | Date | null;
  age?: number | null;
  sex?: string | null;
  bloodType?: string | null;
  primaryCarePhysician?: string | null;
  insuranceProvider?: string | null;
  insuranceMemberId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isSeedFixture?: boolean;
  user?: {
    id: string;
    name: string;
    mrn: string;
    email: string;
  } | null;
  vitals?: Array<{
    vitalType: string;
    value: string;
    unit: string;
    flag?: string | null;
    recordedAt: string | Date;
  }>;
  conditions?: Array<{
    name: string;
    status: string;
    diagnosedYear?: number | null;
    clinicalNotes?: string | null;
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    prescribedBy?: string | null;
    status: string;
  }>;
  allergies?: Array<{
    allergen: string;
    severity: string;
    reaction?: string | null;
  }>;
  prescriptions?: Array<{
    medicationName: string;
    dosage: string;
    refillsRemaining: number;
    status: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    category: string;
    fileName: string;
    uploadedAt: string | Date;
  }>;
}

export function HealthProfileRecordsWorkspace({
  initialSubTab = 'documents',
  profile,
}: {
  initialSubTab?: ProfileSubTab;
  profile?: LivePatientProfile | null;
}) {
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Document Types');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [clinicianVerifiedOnly, setClinicianVerifiedOnly] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>(CLINICAL_DOCUMENTS[0]!.id);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Profile demographics initialized from real database record or fallback
  const patientName = profile?.user?.name || 'Nusrat Jahan';
  const patientMrn = profile?.user?.mrn || '#CN-84920';
  const patientAge = profile?.age ?? 34;
  const patientSex = profile?.sex ?? 'Female';
  const patientDob = profile?.dateOfBirth
    ? new Date(profile.dateOfBirth).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Mar 14, 1990';

  const [primaryCarePhysician, setPrimaryCarePhysician] = useState(
    profile?.primaryCarePhysician || 'Dr. Ayesha Rahman, MBBS, FCPS'
  );
  const [insuranceProvider, setInsuranceProvider] = useState(
    profile?.insuranceProvider || 'Blue Cross Blue Shield'
  );
  const [insuranceMemberId, setInsuranceMemberId] = useState(
    profile?.insuranceMemberId || 'BCBS-889102-01'
  );
  const [emergencyContactName, setEmergencyContactName] = useState(
    profile?.emergencyContactName || 'David Jenkins (Spouse)'
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    profile?.emergencyContactPhone || '(555) 234-8910'
  );
  const [bloodType, setBloodType] = useState(profile?.bloodType || 'O+');

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    primaryCarePhysician,
    insuranceProvider,
    insuranceMemberId,
    emergencyContactName,
    emergencyContactPhone,
    bloodType,
  });

  useEffect(() => {
    if (!isEditModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen]);

  function openEditModal() {
    setEditForm({
      primaryCarePhysician,
      insuranceProvider,
      insuranceMemberId,
      emergencyContactName,
      emergencyContactPhone,
      bloodType,
    });
    setProfileSaveError(null);
    setIsEditModalOpen(true);
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaveError(null);

    try {
      const res = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update profile (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error('Server indicated update failure.');
      }

      // Update local state
      setPrimaryCarePhysician(editForm.primaryCarePhysician);
      setInsuranceProvider(editForm.insuranceProvider);
      setInsuranceMemberId(editForm.insuranceMemberId);
      setEmergencyContactName(editForm.emergencyContactName);
      setEmergencyContactPhone(editForm.emergencyContactPhone);
      setBloodType(editForm.bloodType);

      setIsEditModalOpen(false);
      setActionBanner(
        'Patient profile details updated and persisted to your longitudinal health record.'
      );
    } catch (err: unknown) {
      setProfileSaveError(err instanceof Error ? err.message : 'Failed to save profile changes.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  const filteredDocs = CLINICAL_DOCUMENTS.filter((doc) => {
    const matchesSearch =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.typeTag.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === 'All Document Types' ||
      (typeFilter === 'Lab Reports (5)' && doc.typeTag === 'Lab Report') ||
      (typeFilter === 'Care Summaries (3)' &&
        (doc.typeTag === 'Care Summary' || doc.typeTag === 'Triage Log')) ||
      (typeFilter === 'Imaging & DICOM (2)' && doc.typeTag === 'Imaging') ||
      (typeFilter === 'Prescriptions (2)' && doc.typeTag === 'Prescription') ||
      (typeFilter === 'Patient Uploads (2)' && doc.typeTag === 'Patient Upload');

    const matchesSource =
      sourceFilter === 'All Sources' ||
      (sourceFilter === 'Clinician-Verified Only' &&
        doc.governanceStatus === 'CLINICIAN_VERIFIED') ||
      (sourceFilter === 'Patient-Reported Only' &&
        doc.governanceStatus === 'PATIENT_REPORTED') ||
      (sourceFilter === 'Quest Diagnostics' && doc.sourceName.includes('Quest')) ||
      (sourceFilter === 'Metro General Clinic' && doc.sourceName.includes('Metro'));

    const matchesVerifiedChip =
      !clinicianVerifiedOnly || doc.governanceStatus === 'CLINICIAN_VERIFIED';

    return matchesSearch && matchesType && matchesSource && matchesVerifiedChip;
  });

  const activeDoc =
    filteredDocs.find((d) => d.id === selectedDocId) ??
    CLINICAL_DOCUMENTS.find((d) => d.id === selectedDocId) ??
    CLINICAL_DOCUMENTS[0]!;

  function resetAllFilters() {
    setSearchQuery('');
    setTypeFilter('All Document Types');
    setSourceFilter('All Sources');
    setClinicianVerifiedOnly(false);
  }

  return (
    <div className="space-y-6">
      {/* 1. Persistent Clinical Safety & Non-Diagnostic Disclaimer Banner */}
      <div
        role="region"
        aria-label="Clinical Safety Notice"
        className="rounded-xl bg-surface-container-low p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-primary"
      >
        <div className="flex items-start sm:items-center gap-3">
          <MaterialIcon name="info" className="text-primary text-[20px] shrink-0 mt-0.5 sm:mt-0" />
          <p className="font-body-sm text-body-sm text-on-surface">
            <strong className="font-semibold">Clinical Decision-Support Notice:</strong>{' '}
            CareNavigator is a decision-support and record-organization tool, not a replacement for a
            licensed physician. Records marked{' '}
            <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm">
              Patient-Reported
            </span>{' '}
            have not yet been clinically verified.
          </p>
        </div>
        <Link
          href="/assessments/history"
          className="font-label-md text-label-md text-primary hover:underline shrink-0 flex items-center gap-1"
        >
          <span>Verification Protocol</span>
          <MaterialIcon name="open_in_new" className="text-[14px]" />
        </Link>
      </div>

      {actionBanner && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-3 font-body-sm text-body-sm"
        >
          <div className="flex items-center gap-2 text-on-surface">
            <MaterialIcon name="check_circle" className="text-primary text-[18px]" />
            <span>{actionBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}

      {/* 2. Patient Profile Header Card */}
      <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Patient Identity & Core Demographics */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary font-headline-lg text-headline-lg shrink-0 shadow-sm uppercase font-bold">
              {patientName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  {patientName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md font-mono">
                  {patientMrn}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                  <MaterialIcon name="verified" filled className="text-[14px]" />
                  Identity Verified
                </span>
                <SeedFixtureBadge isSeedFixture={Boolean(profile?.isSeedFixture ?? true)} />
              </div>

              {/* Demographic & Emergency Metadata Pills */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <MaterialIcon name="cake" className="text-[16px] text-outline" />
                  {patientAge} yrs (DOB: {patientDob}) • {patientSex}
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="bloodtype" className="text-[16px] text-error" />
                  Blood Type: <strong className="text-on-surface">{bloodType}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="stethoscope" className="text-[16px] text-primary" />
                  PCP: <strong className="text-on-surface">{primaryCarePhysician}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="contact_emergency" className="text-[16px] text-secondary" />
                  Emergency: {emergencyContactName} • {emergencyContactPhone}
                </span>
              </div>

              {/* Critical Allergy & Alert Strip */}
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Allergies:
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-error-container text-on-error-container font-label-sm text-label-sm">
                  <MaterialIcon name="warning" className="text-[14px]" />
                  Penicillin (Severe • Anaphylaxis)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                  Latex (Mild • Contact Dermatitis)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                  <MaterialIcon name="check_circle" className="text-[13px] text-primary" />
                  Clinician-Verified Oct 12, 2024
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/assessments/media-voice"
              className="px-4 py-2.5 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-xs hover:opacity-95 transition-all flex items-center gap-2"
            >
              <MaterialIcon name="upload_file" className="text-[18px]" />
              <span>Upload Document</span>
            </Link>
            <Link
              href="/settings/privacy#section-data-rights"
              className="px-3.5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center gap-1.5"
            >
              <MaterialIcon name="ios_share" className="text-[18px] text-secondary" />
              <span>Export FHIR / PDF</span>
            </Link>
            <button
              type="button"
              onClick={openEditModal}
              className="px-3.5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MaterialIcon name="edit" className="text-[18px] text-on-surface-variant" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Edit Profile Details Modal */}
        {isEditModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          >
            <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-surface-container">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                    <MaterialIcon name="edit" className="text-[20px]" />
                  </div>
                  <div>
                    <h2 id="edit-profile-title" className="font-headline-sm text-headline-sm text-on-surface">
                      Edit Profile Details &amp; Contacts
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Update your primary physician, insurance, and emergency contact details.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-outline hover:text-on-surface p-1"
                  aria-label="Close"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="p-5 space-y-4">
                {profileSaveError && (
                  <div className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2">
                    <MaterialIcon name="error" className="text-[18px]" />
                    <span>{profileSaveError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="pcp-input">
                    Primary Care Physician
                  </label>
                  <input
                    id="pcp-input"
                    type="text"
                    required
                    value={editForm.primaryCarePhysician}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, primaryCarePhysician: e.target.value }))
                    }
                    className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="ins-prov-input">
                      Insurance Provider
                    </label>
                    <input
                      id="ins-prov-input"
                      type="text"
                      required
                      value={editForm.insuranceProvider}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, insuranceProvider: e.target.value }))
                      }
                      className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="ins-id-input">
                      Insurance Member ID
                    </label>
                    <input
                      id="ins-id-input"
                      type="text"
                      required
                      value={editForm.insuranceMemberId}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, insuranceMemberId: e.target.value }))
                      }
                      className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="em-name-input">
                      Emergency Contact Name
                    </label>
                    <input
                      id="em-name-input"
                      type="text"
                      required
                      value={editForm.emergencyContactName}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))
                      }
                      className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="em-phone-input">
                      Emergency Contact Phone
                    </label>
                    <input
                      id="em-phone-input"
                      type="text"
                      required
                      value={editForm.emergencyContactPhone}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))
                      }
                      className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="blood-type-input">
                    Blood Type
                  </label>
                  <select
                    id="blood-type-input"
                    value={editForm.bloodType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                    className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 font-body-md text-body-md text-on-surface border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingProfile && <MaterialIcon name="sync" className="text-[16px] animate-spin" />}
                    <span>{isSavingProfile ? 'Saving Changes...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Horizontal Profile Sub-Navigation Bar (Consistent Tab Dimensions per AGENTS.md 1.3) */}
        <div className="mt-6 pt-4 border-t border-surface-container flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview', icon: 'person' },
              { id: 'history', label: 'Medical History', icon: 'medical_information' },
              { id: 'prescriptions', label: 'Prescriptions', icon: 'medication', badge: '4' },
              { id: 'reports', label: 'Test Reports', icon: 'science' },
              { id: 'diagnoses', label: 'Diagnoses', icon: 'monitor_heart' },
              { id: 'documents', label: 'Documents', icon: 'folder_open', badge: '14' },
            ] as const
          ).map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`h-10 px-4 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-primary-container text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <MaterialIcon name={tab.icon} filled={active} className="text-[18px]" />
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                      active
                        ? 'bg-on-primary/20 text-on-primary'
                        : 'bg-surface-container text-secondary'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          <Link
            href="/assessments/history"
            className="h-10 px-4 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <MaterialIcon name="history" className="text-[18px]" />
            <span>Assessment History</span>
          </Link>

          <Link
            href="/settings/privacy"
            className="h-10 px-4 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <MaterialIcon name="shield_lock" className="text-[18px]" />
            <span>Privacy &amp; Consent</span>
          </Link>
        </div>
      </section>

      {/* Sub-Tab Views for Overview, Medical History, Prescriptions, Test Reports, Diagnoses */}
      {activeSubTab !== 'documents' && (
        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                Longitudinal Health Record • View Mode
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface capitalize">
                {activeSubTab === 'history'
                  ? 'Longitudinal Medical & Surgical History'
                  : activeSubTab === 'prescriptions'
                  ? 'Active Medications & Prescriptions (4)'
                  : activeSubTab === 'reports'
                  ? 'Laboratory & Diagnostic Test Reports'
                  : activeSubTab === 'diagnoses'
                  ? 'Active Clinical Diagnoses & ICD-10 Problem List'
                  : 'Patient Health Summary Overview'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('documents')}
              className="px-3.5 py-2 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md hover:bg-surface-container"
            >
              Return to Full Documents Table (14)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-container-low space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase text-primary">
                  ICD-10: J45.30
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                  Clinician-Verified
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Mild Persistent Asthma
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Diagnosed 2018 • Controlled on PRN Albuterol HFA 90mcg &amp; Fluticasone. Last spirometry
                FEV1 88% predicted.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase text-secondary">
                  ICD-10: I10
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                  Clinician-Verified
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Essential Hypertension
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Diagnosed 2022 • Maintained on Lisinopril 10mg PO Daily. 14-day home BP mean 126/79
                mmHg.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase text-tertiary">
                  Active Rx • 4 Medications
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-sm text-label-sm">
                  Pharmacy Synced
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Current Regimen Summary
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                1. Lisinopril 10mg Daily • 2. Albuterol HFA 90mcg PRN • 3. Cetirizine 10mg Daily •
                4. Vitamin D3 2000 IU Daily.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Documents Workspace: Left Filter + Table (8 Cols) & Right Preview Panel (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 8 COLUMNS: Filter Bar + Documents Table + Provenance Legend */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter & Search Toolbar */}
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <MaterialIcon
                  name="search"
                  className="text-[18px] text-outline absolute left-3.5 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents by title, biomarker, clinician, or ICD-10..."
                  aria-label="Filter documents by keyword"
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface-container-low text-on-surface placeholder-outline font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Filter Select Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by Document Type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option>All Document Types</option>
                  <option>Lab Reports (5)</option>
                  <option>Care Summaries (3)</option>
                  <option>Imaging &amp; DICOM (2)</option>
                  <option>Prescriptions (2)</option>
                  <option>Patient Uploads (2)</option>
                </select>

                <select
                  aria-label="Filter by Provider or Source"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option>All Sources</option>
                  <option>Clinician-Verified Only</option>
                  <option>Patient-Reported Only</option>
                  <option>Quest Diagnostics</option>
                  <option>Metro General Clinic</option>
                </select>
              </div>
            </div>

            {/* Active Filter Pills & Record Count */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Quick Filters:
                </span>
                <button
                  type="button"
                  onClick={() => setClinicianVerifiedOnly((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-colors ${
                    clinicianVerifiedOnly
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <MaterialIcon name="verified" className="text-[13px]" />
                  <span>Clinician-Verified Only</span>
                </button>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="font-label-sm text-label-sm text-secondary hover:underline ml-1"
                >
                  Reset filters
                </button>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Showing <strong className="text-on-surface">{filteredDocs.length}</strong> of{' '}
                <strong className="text-on-surface">14</strong> documents
              </span>
            </div>
          </div>

          {/* Documents Data Table */}
          <div className="rounded-xl bg-surface-container-lowest shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <th className="py-3.5 px-4">Document Title &amp; Format</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3">Date Recorded</th>
                    <th className="py-3.5 px-3">Source / Provider</th>
                    <th className="py-3.5 px-3">Governance Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                  {filteredDocs.map((doc) => {
                    const isSelected = doc.id === activeDoc.id;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-surface-container/70 border-l-4 border-primary'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${doc.iconColor}`}
                            >
                              <MaterialIcon name={doc.icon} className="text-[20px]" />
                            </div>
                            <div>
                              <p
                                className={`font-label-lg text-label-lg text-on-surface ${
                                  isSelected ? 'font-semibold' : ''
                                }`}
                              >
                                {doc.title}
                              </p>
                              <p className="font-label-sm text-label-sm text-outline">
                                {doc.subtitle}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-sm text-label-sm">
                            {doc.typeTag}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-on-surface-variant whitespace-nowrap">
                          {doc.dateRecorded}
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-on-surface font-medium">{doc.sourceName}</p>
                          <p className="font-label-sm text-label-sm text-outline">
                            {doc.sourceRole}
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          {doc.governanceStatus === 'CLINICIAN_VERIFIED' && (
                            <>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                                <MaterialIcon name="verified" filled className="text-[13px]" />
                                Clinician-Verified
                              </span>
                              <p className="font-label-sm text-label-sm text-outline mt-0.5">
                                {doc.governanceBy}
                              </p>
                            </>
                          )}
                          {doc.governanceStatus === 'AI_TRIAGE' && (
                            <>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container/50 text-on-secondary-container font-label-sm text-label-sm">
                                <MaterialIcon name="smart_toy" className="text-[13px]" />
                                AI Triage Output
                              </span>
                              <p className="font-label-sm text-label-sm text-outline mt-0.5">
                                {doc.governanceBy}
                              </p>
                            </>
                          )}
                          {doc.governanceStatus === 'PATIENT_REPORTED' && (
                            <>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-sm text-label-sm">
                                <MaterialIcon name="person_edit" className="text-[13px]" />
                                Patient-Reported
                              </span>
                              <p className="font-label-sm text-label-sm text-outline mt-0.5">
                                Pending Physician Sign-Off
                              </p>
                            </>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocId(doc.id);
                              }}
                              title="Preview Document"
                              className={`p-1.5 rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-primary text-on-primary'
                                  : 'hover:bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              <MaterialIcon name="visibility" className="text-[16px]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionBanner(
                                  `Downloaded encrypted copy of "${doc.title}" (TLS 1.3 Audit Logged).`
                                );
                              }}
                              title="Download PDF"
                              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                            >
                              <MaterialIcon name="download" className="text-[16px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="p-4 bg-surface-container-low/50 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-container">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Showing <strong className="text-on-surface">1 to {filteredDocs.length}</strong> of{' '}
                <strong className="text-on-surface">14</strong> clinical documents
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-outline font-label-md text-label-md cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg bg-primary text-on-primary font-label-md text-label-md"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActionBanner('Viewing archived records page 2 (Sample Longitudinal Vault).')
                  }
                  className="w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActionBanner('Viewing archived records page 3 (Sample Longitudinal Vault).')
                  }
                  className="w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActionBanner('Viewing archived records page 2 (Sample Longitudinal Vault).')
                  }
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Data Provenance & Verification Legend Card */}
          <div className="rounded-xl bg-surface-container-low p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2.5">
              <MaterialIcon name="verified" filled className="text-primary text-[18px] mt-0.5" />
              <div>
                <h3 className="font-label-md text-label-md text-on-surface">
                  Clinician-Verified Record
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Directly ingested via HL7/FHIR from an accredited laboratory, hospital EHR, or
                  co-signed by a CareNavigator physician.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MaterialIcon name="smart_toy" className="text-secondary text-[18px] mt-0.5" />
              <div>
                <h3 className="font-label-md text-label-md text-on-surface">
                  AI Triage Decision Support
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Automated clinical guidance generated from symptom intake. Always reviewed by a
                  human clinician for high-acuity flags.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MaterialIcon
                name="person_edit"
                className="text-on-surface-variant text-[18px] mt-0.5"
              />
              <div>
                <h3 className="font-label-md text-label-md text-on-surface">
                  Patient-Reported Data
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Self-uploaded logs, home vitals, or external PDFs awaiting formal verification
                  during your next clinical encounter.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 4 COLUMNS: Interactive Document Preview & Biomarker Extraction Panel */}
        <aside className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-5 shadow-xs space-y-5 lg:sticky lg:top-20">
          {/* Preview Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-surface-container">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm uppercase">
                  Active Selection
                </span>
                <span className="font-label-sm text-label-sm text-outline font-mono">
                  {activeDoc.typeTag}
                </span>
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {activeDoc.title}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Recorded {activeDoc.dateRecorded} • {activeDoc.sourceName}
              </p>
            </div>
          </div>

          {/* Provenance & Verification Stamp */}
          <div className="rounded-xl bg-surface-container-low p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary">
                <MaterialIcon name="verified_user" filled className="text-[16px]" />
                {activeDoc.governanceStatus === 'CLINICIAN_VERIFIED'
                  ? 'Clinician-Verified Lab Record'
                  : activeDoc.governanceStatus === 'AI_TRIAGE'
                  ? 'AI Decision-Support Log'
                  : 'Patient-Reported Upload'}
              </span>
              <span className="font-label-sm text-label-sm text-outline">FHIR R4 Synced</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Reviewed and attested by{' '}
              <strong className="text-on-surface">
                {activeDoc.governanceBy ?? 'Pending Clinician Review'}
              </strong>
              .
            </p>
          </div>

          {/* Extracted Key Biomarkers (Structured Preview) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-label-md text-label-md uppercase tracking-wider text-outline">
                Extracted Key Biomarkers
              </h3>
              <span className="font-label-sm text-label-sm text-primary">
                {activeDoc.biomarkers.length} Parsed Values
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {activeDoc.biomarkers.map((bio) => (
                <div key={bio.name} className="p-3 rounded-lg bg-surface-container-low">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {bio.name}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-mono">
                      {bio.value}{' '}
                      <small className="font-body-sm text-outline">{bio.unit}</small>
                    </span>
                    <span className="font-label-sm text-label-sm text-primary">{bio.status}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-outline">
                    {bio.referenceRange}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulated Document Page Preview Canvas */}
          <div className="rounded-xl bg-surface-container p-4 space-y-3">
            <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span className="flex items-center gap-1">
                <MaterialIcon name="description" className="text-[14px]" />
                Document Specimen Preview
              </span>
              <span>Page 1 of 2</span>
            </div>

            <div className="rounded-lg bg-surface-container-lowest p-4 shadow-2xs space-y-2.5 font-body-sm text-body-sm">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <div>
                  <p className="font-label-md text-label-md text-primary uppercase">
                    {activeDoc.sourceName.toUpperCase()} • E-CLINICAL RECORD
                  </p>
                  <p className="font-label-sm text-label-sm text-outline">
                    Patient: JENKINS, SARAH (DOB: 1990-03-14)
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container-low font-label-sm text-label-sm text-on-surface">
                  FINAL REPORT
                </span>
              </div>
              <div className="space-y-1.5 text-on-surface-variant font-label-sm text-label-sm">
                {activeDoc.specimenLines.map((line) => (
                  <div key={line.label} className="flex justify-between">
                    <span>{line.label}</span>
                    <span className="text-on-surface font-medium font-mono">{line.value}</span>
                  </div>
                ))}
              </div>
              <p className="pt-1 font-label-sm text-label-sm text-outline italic">
                Clinical Note: Decision-support summary. Please correlate with longitudinal clinical
                findings.
              </p>
            </div>
          </div>

          {/* Document Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() =>
                setActionBanner(`Opened full high-resolution viewer for "${activeDoc.title}".`)
              }
              className="col-span-2 py-2.5 px-4 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <MaterialIcon name="open_in_full" className="text-[18px]" />
              <span>View Full Document (2 Pages)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActionBanner(`Downloading signed PDF for "${activeDoc.title}"...`)
              }
              className="py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5"
            >
              <MaterialIcon name="download" className="text-[16px] text-primary" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActionBanner(`Shared "${activeDoc.title}" with your authorized Care Team.`)
              }
              className="py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5"
            >
              <MaterialIcon name="share" className="text-[16px] text-secondary" />
              <span>Share to Team</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
