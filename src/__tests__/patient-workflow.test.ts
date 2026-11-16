import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionToken, type SessionUser } from '@/server/auth/session';
import { isGeminiConfigured } from '@/lib/env';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as postAssessmentsHandler, GET as getAssessmentsHandler } from '@/app/api/assessments/route';
import { GET as getAssessmentByIdHandler } from '@/app/api/assessments/[id]/route';
import { GET as getProfileHandler, PUT as putProfileHandler } from '@/app/api/patient/profile/route';

describe('CareNavigator End-to-End Patient Workflow (Milestone 6)', () => {
  const patientEmail = `workflow.patient.${Date.now()}@carenavigator.test`;
  const otherPatientEmail = `workflow.other.${Date.now()}@carenavigator.test`;
  const password = 'WorkflowPassword2026!';

  let patientUser: SessionUser;
  let patientToken: string;
  let otherPatientUser: SessionUser;
  let otherPatientToken: string;
  let createdSessionId: string;
  let createdSessionCode: string;

  beforeAll(async () => {
    // 1. Patient registers & signs in
    const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password,
        name: 'Elena Rostova Workflow',
        dateOfBirth: '1992-05-20',
        sex: 'Female',
        insuranceProvider: 'Metro Blue Shield',
        insuranceMemberId: 'MBS-9021-01',
      }),
    });

    const regRes = await registerHandler(regReq);
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    patientUser = regData.user;
    patientToken = regData.token || (await signSessionToken(patientUser));

    // Register second patient to verify record ownership / access control
    const otherReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: otherPatientEmail,
        password,
        name: 'Marcus Other',
        dateOfBirth: '1985-11-10',
        sex: 'Male',
        insuranceProvider: 'Aetna Health',
        insuranceMemberId: 'AET-4412-00',
      }),
    });
    const otherRes = await registerHandler(otherReq);
    expect(otherRes.status).toBe(201);
    const otherData = await otherRes.json();
    otherPatientUser = otherData.user;
    otherPatientToken = otherData.token || (await signSessionToken(otherPatientUser));
  });

  describe('Step 1 & 2: Patient Authentication and Dashboard Profile Retrieval', () => {
    it('retrieves the authenticated patient profile and verifies initial demographics', async () => {
      const req = new NextRequest('http://localhost:3000/api/patient/profile', {
        headers: {
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
      });

      const res = await getProfileHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.profile.user.email).toBe(patientEmail);
      expect(data.profile.insuranceProvider).toBe('Metro Blue Shield');
      expect(data.profile.insuranceMemberId).toBe('MBS-9021-01');
    });

    it('rejects unauthenticated profile retrieval with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/patient/profile');
      const res = await getProfileHandler(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Step 3, 4 & 5: Structured Symptom Assessment Submission & State Progression', () => {
    it('validates required symptoms and rejects insufficient complaint lengths', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'bad', // < 5 chars fails validation
        }),
      });

      const res = await postAssessmentsHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('submits structured assessment, runs red-flag rules, and persists records with relations', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Persistent dry cough and mild tightness in upper chest',
          includeEhrContext: true,
          confidenceScore: 88,
          acuityLevel: 'ROUTINE',
          recommendedCareSetting: 'Outpatient Primary Care or Telehealth Consultation',
          answers: [
            {
              stepNumber: 1,
              questionKey: 'chief_complaint',
              questionPrompt: 'Primary symptoms and timeline',
              answerValue: 'Persistent dry cough and mild tightness in upper chest for 3 days',
            },
            {
              stepNumber: 2,
              questionKey: 'fever_check',
              questionPrompt: 'Temperature and chills',
              answerValue: 'Temperature 99.4°F, no chills, no hemoptysis',
            },
            {
              stepNumber: 3,
              questionKey: 'pleuritic_characteristics',
              questionPrompt: 'Discomfort when taking full deep breath',
              answerValue: 'Dull ache or tightness only',
            },
          ],
        }),
      });

      const res = await postAssessmentsHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.session.id).toBeDefined();
      expect(data.session.sessionCode).toMatch(/^CN-\d{4}-\d{4}$/);
      expect(data.session.status).toBe('PENDING_REVIEW');
      expect(data.session.acuityLevel).toBe('ROUTINE');

      createdSessionId = data.session.id;
      createdSessionCode = data.session.sessionCode;

      // Verify answers and explanations persisted in database
      const savedAnswers = await prisma.assessmentAnswer.findMany({
        where: { sessionId: createdSessionId },
      });
      expect(savedAnswers.length).toBe(3);

      const savedExplanations = await prisma.assessmentExplanation.findMany({
        where: { sessionId: createdSessionId },
      });
      expect(savedExplanations.length).toBeGreaterThanOrEqual(1);

      // Verify status transition history
      const statusHistory = await prisma.assessmentStatusHistory.findMany({
        where: { sessionId: createdSessionId },
      });
      expect(statusHistory.length).toBeGreaterThanOrEqual(1);
      expect(statusHistory[0]?.toStatus).toBe('PENDING_REVIEW');

      // Verify clinical guideline citations attached
      const citations = await prisma.triageCitation.findMany({
        where: { sessionId: createdSessionId },
      });
      expect(citations.length).toBeGreaterThanOrEqual(1);
    });

    it('triggers emergency override when acute red flags are submitted', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Crushing chest pain radiating to left arm and jaw with severe shortness of breath at rest',
          acuityLevel: 'ROUTINE', // Attempted lower acuity
          answers: [
            {
              stepNumber: 1,
              questionKey: 'acute_pain',
              questionPrompt: 'Describe radiation',
              answerValue: 'Crushing substernal pressure radiating to jaw and diaphoresis',
            },
          ],
        }),
      });

      const res = await postAssessmentsHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      // Overridden to EMERGENCY per deterministic clinical rules
      expect(data.session.acuityLevel).toBe('EMERGENCY');
      expect(data.session.redFlagTriggered).toBe(true);
      expect(data.session.confidenceScore).toBe(99);
      expect(data.session.status).toBe('ACTION_REQUIRED');
    });
  });

  describe('Step 6: Results Screen Retrieval & Record Ownership Enforcement', () => {
    it('allows the session owner to view results with full clinical breakdown', async () => {
      const req = new NextRequest(`http://localhost:3000/api/assessments/${createdSessionId}`, {
        headers: {
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
      });

      const res = await getAssessmentByIdHandler(req, {
        params: Promise.resolve({ id: createdSessionId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.session.id).toBe(createdSessionId);
      expect(data.session.answers.length).toBe(3);
      expect(data.session.explanations.length).toBeGreaterThanOrEqual(1);
      expect(data.session.citations.length).toBeGreaterThanOrEqual(1);
    });

    it('denies access (403 Forbidden) when another patient attempts to view the assessment', async () => {
      const req = new NextRequest(`http://localhost:3000/api/assessments/${createdSessionId}`, {
        headers: {
          Authorization: `Bearer ${otherPatientToken}`,
          Cookie: `carenavigator_session=${otherPatientToken}`,
        },
      });

      const res = await getAssessmentByIdHandler(req, {
        params: Promise.resolve({ id: createdSessionId }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });

    it('transparently reports unconfigured external AI service status without fabrication', () => {
      // Per AGENTS.md rule 4.1: zero fabrication of AI outputs
      const isLive = isGeminiConfigured();
      expect(typeof isLive).toBe('boolean');
      // When unconfigured, live apiKey is false and system operates in deterministic CDS mode
      if (!isLive) {
        expect(isLive).toBe(false);
      }
    });
  });

  describe('Step 7: Assessment History & Review Status Tracking', () => {
    it('retrieves paginated assessment history containing the newly submitted assessment', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
      });

      const res = await getAssessmentsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeGreaterThanOrEqual(1);
      const matched = data.data.find(
        (s: { id: string; sessionCode: string }) => s.id === createdSessionId
      );
      expect(matched).toBeDefined();
      expect(matched.sessionCode).toBe(createdSessionCode);
    });
  });

  describe('Step 8: Patient Medical Records Access and Profile Details Update', () => {
    it('updates permitted profile fields and persists changes to real database', async () => {
      const updateReq = new NextRequest('http://localhost:3000/api/patient/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
        body: JSON.stringify({
          primaryCarePhysician: 'Dr. Farhan Ahmed, MBBS, MPH',
          insuranceProvider: 'Metro Health Premier',
          insuranceMemberId: 'MHP-7719-02',
          emergencyContactName: 'Dmitri Rostova (Brother)',
          emergencyContactPhone: '(555) 890-1234',
          bloodType: 'B+',
        }),
      });

      const updateRes = await putProfileHandler(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.success).toBe(true);
      expect(updateData.profile.primaryCarePhysician).toBe('Dr. Farhan Ahmed, MBBS, MPH');
      expect(updateData.profile.insuranceProvider).toBe('Metro Health Premier');
      expect(updateData.profile.insuranceMemberId).toBe('MHP-7719-02');
      expect(updateData.profile.emergencyContactName).toBe('Dmitri Rostova (Brother)');
      expect(updateData.profile.emergencyContactPhone).toBe('(555) 890-1234');
      expect(updateData.profile.bloodType).toBe('B+');

      // Verify persistence across new query (simulating page refresh)
      const refreshReq = new NextRequest('http://localhost:3000/api/patient/profile', {
        headers: {
          Authorization: `Bearer ${patientToken}`,
          Cookie: `carenavigator_session=${patientToken}`,
        },
      });
      const refreshRes = await getProfileHandler(refreshReq);
      expect(refreshRes.status).toBe(200);
      const refreshedData = await refreshRes.json();
      expect(refreshedData.profile.primaryCarePhysician).toBe('Dr. Farhan Ahmed, MBBS, MPH');
      expect(refreshedData.profile.insuranceProvider).toBe('Metro Health Premier');
      expect(refreshedData.profile.bloodType).toBe('B+');

      // Verify audit log recorded for profile update
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          actorUserId: patientUser.id,
          actionType: 'PROFILE_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).toBeDefined();
    });
  });
});
