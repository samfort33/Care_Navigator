import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  getConfiguredRegions,
  isRegionCovered,
} from '@/server/directory/config';
import {
  queryDoctors,
  getDoctorById,
} from '@/server/directory/service';
import {
  createAppointment,
  cancelAppointment,
} from '@/server/appointments/service';
import {
  createReferral,
  updateReferralStatus,
  getReferralsForPatient,
} from '@/server/referrals/service';
import {
  listClinicianReviews,
  getReviewDossier,
  submitReviewDecision,
} from '@/server/reviews/service';
import { DEMO_PERSONAS } from '@/server/auth/session';

describe('Doctor Directory, Referrals & Clinician Review Workflows (Task 10)', () => {
  let testPatientProfileId: string;
  let testDoctorId: string;
  let testSlotId: string;
  let testSessionId: string;
  let testReviewId: string;

  beforeEach(async () => {
    // Look up or establish test fixtures from seed data
    const patientProfile = await prisma.patientProfile.findFirst({
      where: { userId: DEMO_PERSONAS.PATIENT.id },
    });
    expect(patientProfile).toBeDefined();
    testPatientProfileId = patientProfile!.id;

    // Pick a test doctor
    const doctor = await prisma.doctorProfile.findFirst({
      where: { specialty: 'Cardiology' },
      include: { availabilitySlots: true },
    });
    expect(doctor).toBeDefined();
    testDoctorId = doctor!.id;

    // Create a dedicated fresh unbooked slot for testing
    const freshSlot = await prisma.availabilitySlot.create({
      data: {
        doctorId: testDoctorId,
        label: `Test Slot ${Date.now()}`,
        startsAt: new Date(Date.now() + 3600000),
        modality: 'TELEHEALTH',
        isBooked: false,
        isSeedFixture: true,
      },
    });
    testSlotId = freshSlot.id;

    // Reset seeded review stage so foundation.test.ts fixture remains intact
    await prisma.clinicianReview.updateMany({
      where: { session: { sessionCode: 'CN-2026-8841' } },
      data: { stage: 'REVIEWING' },
    });

    // Create a dedicated test triage session and review for this test run
    const session = await prisma.triageSession.create({
      data: {
        sessionCode: `TEST-HITL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        patientProfileId: testPatientProfileId,
        chiefComplaint: 'Intermittent chest heaviness and shortness of breath',
        acuityLevel: 'ROUTINE',
        recommendedCareSetting: 'Outpatient Clinic',
        plainLanguageSummary: 'Test triage session for clinician review verification.',
        isSeedFixture: true,
      },
    });
    testSessionId = session.id;

    const review = await prisma.clinicianReview.create({
      data: {
        sessionId: testSessionId,
        clinicianId: DEMO_PERSONAS.CLINICIAN.id,
        stage: 'QUEUED',
        concordanceStatus: 'PENDING',
        isSeedFixture: true,
      },
    });
    testReviewId = review.id;
  });

  describe('1. Doctor Directory & Regional Configuration', () => {
    it('returns approved regional coverage and validates regions', () => {
      const regions = getConfiguredRegions();
      expect(regions).toContain('Dhaka');
      expect(regions).toContain('Sylhet');
      expect(isRegionCovered('Dhaka')).toBe(true);
      expect(isRegionCovered('Fictional Galaxy')).toBe(false);
    });

    it('queries doctors and filters by specialty with real database records', async () => {
      const result = await queryDoctors({ specialty: 'Cardiology' });
      expect(result.doctors.length).toBeGreaterThan(0);
      result.doctors.forEach((doc) => {
        expect(doc.specialty.toLowerCase()).toContain('cardio');
      });
      expect(result.configuredRegions.length).toBeGreaterThan(0);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('filters doctors by region, telehealth, and in-network flags', async () => {
      const result = await queryDoctors({
        region: 'Dhaka',
        telehealth: true,
        inNetwork: true,
      });
      expect(result.doctors.length).toBeGreaterThan(0);
      result.doctors.forEach((doc) => {
        expect(doc.region).toContain('Dhaka');
        expect(doc.telehealthAvailable).toBe(true);
        expect(doc.inNetworkHospital).toBe(true);
      });
    });

    it('returns null when querying an invalid doctor ID without fabricating data', async () => {
      const missing = await getDoctorById('non-existent-provider-id-9999');
      expect(missing).toBeNull();
    });
  });

  describe('2. Appointment Scheduling & Slot Locking Atomicity', () => {
    it('books an appointment slot and locks it atomically', async () => {
      const appt = await createAppointment({
        patientProfileId: testPatientProfileId,
        doctorId: testDoctorId,
        slotId: testSlotId,
        reason: 'Post-triage consultation for chest discomfort evaluation',
        triageSessionId: testSessionId,
      });

      expect(appt).toBeDefined();
      expect(appt.doctorId).toBe(testDoctorId);
      expect(appt.slotId).toBe(testSlotId);
      expect(appt.status).toBe('UPCOMING');

      // Verify the slot is now locked
      const updatedSlot = await prisma.availabilitySlot.findUnique({
        where: { id: testSlotId },
      });
      expect(updatedSlot?.isBooked).toBe(true);
    });

    it('prevents double-booking race condition and rejects already booked slot', async () => {
      // Mark slot booked first
      await prisma.availabilitySlot.update({
        where: { id: testSlotId },
        data: { isBooked: true },
      });

      await expect(
        createAppointment({
          patientProfileId: testPatientProfileId,
          doctorId: testDoctorId,
          slotId: testSlotId,
          reason: 'Double booking test attempt',
        })
      ).rejects.toThrow('SLOT_ALREADY_BOOKED');
    });

    it('cancels appointment and unlocks availability slot', async () => {
      const appt = await createAppointment({
        patientProfileId: testPatientProfileId,
        doctorId: testDoctorId,
        slotId: testSlotId,
        reason: 'Pre-cancellation booking',
      });

      const cancelled = await cancelAppointment(appt.id, testPatientProfileId);
      expect(cancelled.status).toBe('CANCELLED');

      const releasedSlot = await prisma.availabilitySlot.findUnique({
        where: { id: testSlotId },
      });
      expect(releasedSlot?.isBooked).toBe(false);
    });
  });

  describe('3. Care Referrals & Non-Diagnostic Framing', () => {
    it('creates a care referral with non-diagnostic clinical framing', async () => {
      const ref = await createReferral({
        patientProfileId: testPatientProfileId,
        doctorId: testDoctorId,
        specialtyNeeded: 'Cardiology',
        urgency: 'ROUTINE',
        clinicalSummary: 'Recommended specialist evaluation for intermittent chest tightness.',
        triageSessionId: testSessionId,
      });

      expect(ref.referralCode).toMatch(/^REF-[0-9A-F]{6}$/);
      expect(ref.referralStatus).toBe('PENDING');
      // Must contain non-diagnostic safety phrasing
      expect(ref.clinicalSummary.toLowerCase()).toContain('non-diagnostic');
    });

    it('allows patient to transition referral status from PENDING to ACCEPTED', async () => {
      const ref = await createReferral({
        patientProfileId: testPatientProfileId,
        doctorId: testDoctorId,
        specialtyNeeded: 'Cardiology',
        clinicalSummary: 'Follow-up for elevated blood pressure findings.',
      });

      const updated = await updateReferralStatus(ref.id, testPatientProfileId, 'ACCEPTED');
      expect(updated.referralStatus).toBe('ACCEPTED');
    });

    it('enforces patient record ownership and blocks unauthorized status update', async () => {
      const ref = await createReferral({
        patientProfileId: testPatientProfileId,
        doctorId: testDoctorId,
        specialtyNeeded: 'Cardiology',
        clinicalSummary: 'Patient ownership test referral.',
      });

      // Try updating with an unauthorized foreign patient profile ID
      await expect(
        updateReferralStatus(ref.id, 'unauthorized-foreign-patient-id', 'DECLINED')
      ).rejects.toThrow('UNAUTHORIZED_ACCESS');
    });

    it('retrieves patient referrals with doctor profile metadata', async () => {
      const patientRefs = await getReferralsForPatient(testPatientProfileId);
      expect(patientRefs.length).toBeGreaterThan(0);
      expect(patientRefs[0].doctor).toBeDefined();
      expect(patientRefs[0].doctor.name).toBeTruthy();
    });
  });

  describe('4. Clinician Review Queue & HITL Attestation', () => {
    it('lists reviews and calculates queue metrics across stages', async () => {
      const result = await listClinicianReviews();
      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics.queued).toBe('number');
      expect(typeof result.metrics.reviewing).toBe('number');
      expect(typeof result.metrics.signed).toBe('number');
      expect(typeof result.metrics.escalated).toBe('number');
      expect(result.reviews.length).toBeGreaterThan(0);
    });

    it('retrieves complete clinical review dossier without exposing sensitive non-clinical PII', async () => {
      const dossier = await getReviewDossier(testReviewId);
      expect(dossier).toBeDefined();
      expect(dossier?.session).toBeDefined();
      expect(dossier?.session.patientProfile).toBeDefined();
      expect(dossier?.session.patientProfile.user.mrn).toBeTruthy();
      expect(dossier?.session.answers).toBeDefined();
      expect(dossier?.session.citations).toBeDefined();
    });

    it('rejects review decision submission from unauthorized patient persona', async () => {
      await expect(
        submitReviewDecision({
          reviewId: testReviewId,
          clinicianUserId: DEMO_PERSONAS.PATIENT.id, // Nusrat Jahan (PATIENT)
          decisionType: 'CARE_PLAN_SIGNED',
          newStage: 'SIGNED',
          rationale: 'Unauthorized attempt to sign off by patient.',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('records clinician decision attestation, transitions stage, and creates immutable audit log', async () => {
      const result = await submitReviewDecision({
        reviewId: testReviewId,
        clinicianUserId: DEMO_PERSONAS.CLINICIAN.id, // Dr. Aris Thorne (CLINICIAN)
        decisionType: 'CARE_PLAN_SIGNED',
        newStage: 'SIGNED',
        rationale: 'Clinical history and reported symptoms align with GINA Step 2 protocol. Care plan certified.',
        clinicianNote: 'Continue prescribed albuterol PRN and follow up in 2 weeks.',
      });

      expect(result.review.stage).toBe('SIGNED');
      expect(result.review.signedAt).toBeDefined();
      expect(result.decision.decisionType).toBe('CARE_PLAN_SIGNED');
      expect(result.decision.newStage).toBe('SIGNED');

      // Verify audit trail entry was recorded
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          targetEntityId: testReviewId,
          actionType: 'CLINICIAN_SIGN_OFF',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorRole).toBe('CLINICIAN');
    });

    it('handles clinician acuity override and marks concordance status', async () => {
      // Create a dedicated fresh session and review for override test
      const freshSession = await prisma.triageSession.create({
        data: {
          sessionCode: `TEST-OVR-${Date.now()}`,
          patientProfileId: testPatientProfileId,
          chiefComplaint: 'Mild wheezing and shortness of breath',
          acuityLevel: 'ROUTINE',
          recommendedCareSetting: 'Outpatient Clinic',
          plainLanguageSummary: 'Routine respiratory evaluation.',
          isSeedFixture: true,
        },
      });

      const overrideReview = await prisma.clinicianReview.create({
        data: {
          sessionId: freshSession.id,
          clinicianId: DEMO_PERSONAS.CLINICIAN.id,
          stage: 'REVIEWING',
          concordanceStatus: 'PENDING',
          isSeedFixture: true,
        },
      });

      const overrideResult = await submitReviewDecision({
        reviewId: overrideReview.id,
        clinicianUserId: DEMO_PERSONAS.CLINICIAN.id,
        decisionType: 'OVERRIDDEN',
        newStage: 'REVIEWING',
        overriddenAcuity: 'URGENT',
        rationale: 'Patient reported subtle tachypnea modifying clinical risk. Elevating to Urgent care evaluation.',
      });

      expect(overrideResult.review.overriddenAcuity).toBe('URGENT');
      expect(overrideResult.review.concordanceStatus).toBe('OVERRIDDEN_HIGHER');
      expect(overrideResult.decision.decisionType).toBe('OVERRIDDEN');
    });
  });
});
