import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
} from '@/server/auth/password';
import {
  signSessionToken,
  verifySessionToken,
  DEMO_PERSONAS,
  type SessionUser,
} from '@/server/auth/session';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route';
import { GET as getRecordsHandler, POST as postRecordsHandler } from '@/app/api/records/route';
import {
  GET as getRecordByIdHandler,
  DELETE as deleteRecordByIdHandler,
} from '@/app/api/records/[id]/route';
import {
  GET as getAssessmentsHandler,
  POST as postAssessmentsHandler,
} from '@/app/api/assessments/route';
import { GET as getAssessmentByIdHandler } from '@/app/api/assessments/[id]/route';
import { POST as signOffReviewHandler } from '@/app/api/reviews/[id]/sign-off/route';
import { GET as getConsentHandler, PUT as putConsentHandler } from '@/app/api/consent/route';

describe('CareNavigator Authentication & Persistence Layer (AGENTS.md Rules 3.1 - 3.3)', () => {
  const testPatientEmail = `test.patient.${Date.now()}@carenavigator.test`;
  const otherPatientEmail = `other.patient.${Date.now()}@carenavigator.test`;
  const testPassword = 'SecurePassword2026!';

  let testPatientUser: SessionUser;
  let testPatientToken: string;
  let otherPatientUser: SessionUser;
  let otherPatientToken: string;
  let clinicianToken: string;

  beforeAll(async () => {
    clinicianToken = await signSessionToken(DEMO_PERSONAS.CLINICIAN);
  });

  describe('1. Cryptographic Password Hashing & Token Service (NIST-Compliant)', () => {
    it('hashes passwords using scrypt with unique salts and formats as salt:hash', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);

      expect(hash1).toContain(':');
      expect(hash2).toContain(':');
      // Unique salts guarantee distinct hash outputs
      expect(hash1).not.toBe(hash2);

      const isValid1 = await verifyPassword(testPassword, hash1);
      const isValid2 = await verifyPassword(testPassword, hash2);
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });

    it('rejects incorrect passwords via constant-time comparison', async () => {
      const hash = await hashPassword(testPassword);
      const isInvalid = await verifyPassword('WrongPassword123!', hash);
      expect(isInvalid).toBe(false);
    });

    it('generates secure entropy tokens and computes deterministic SHA-256 hashes', () => {
      const token = generateSecureToken(32);
      expect(token).toHaveLength(64);

      const hashA = hashToken(token);
      const hashB = hashToken(token);
      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });
  });

  describe('2. User Registration & Persistence (POST /api/auth/register)', () => {
    it('rejects registration with invalid email or weak password', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'short',
          name: 'Jane Doe',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Validation failed');
    });

    it('creates new User, PatientProfile, ConsentPreference, and returns session token', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testPatientEmail,
          password: testPassword,
          name: 'Samantha Vance',
          dateOfBirth: '1992-06-15',
          sex: 'Female',
          bloodType: 'A+',
          primaryCarePhysician: 'Dr. Aris Thorne',
          insuranceProvider: 'BlueCross Health',
          insuranceMemberId: 'BC-998811',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.user.email).toBe(testPatientEmail.toLowerCase());
      expect(json.user.role).toBe('PATIENT');
      expect(json.user.mrn).toMatch(/^#CN-\d{5}$/);
      expect(json.token).toBeDefined();

      testPatientUser = json.user;
      testPatientToken = json.token;

      // Verify persistent record in DB
      const userInDb = await prisma.user.findUnique({
        where: { email: testPatientEmail.toLowerCase() },
        include: { patientProfile: true, consentPreferences: true },
      });

      expect(userInDb).not.toBeNull();
      expect(userInDb?.passwordHash).not.toBe(testPassword); // Never plaintext
      expect(userInDb?.patientProfile?.bloodType).toBe('A+');
      expect(userInDb?.consentPreferences?.includeEhrContext).toBe(true);
    });

    it('rejects duplicate email registration with HTTP 409 Conflict', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testPatientEmail,
          password: testPassword,
          name: 'Samantha Vance Duplicate',
          dateOfBirth: '1992-06-15',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/already exists/i);
    });

    it('creates second patient user for cross-patient ownership testing', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otherPatientEmail,
          password: testPassword,
          name: 'Marcus Brody',
          dateOfBirth: '1988-11-20',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      otherPatientUser = json.user;
      otherPatientToken = json.token;
      expect(otherPatientUser.id).toBeDefined();
      expect(otherPatientUser.role).toBe('PATIENT');
    });
  });

  describe('3. User Authentication, Session JWT & Login (POST /api/auth/login)', () => {
    it('authenticates valid credentials and issues signed session cookie and token', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testPatientEmail,
          password: testPassword,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.user.id).toBe(testPatientUser.id);
      expect(json.token).toBeDefined();

      const verified = await verifySessionToken(json.token);
      expect(verified?.id).toBe(testPatientUser.id);
      expect(verified?.role).toBe('PATIENT');
    });

    it('rejects invalid password with HTTP 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testPatientEmail,
          password: 'WrongPassword!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid email.*password/i);
    });

    it('rejects unregistered email with HTTP 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent.user@carenavigator.test',
          password: testPassword,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });
  });

  describe('4. Password Recovery & Reset Flow (POST /api/auth/forgot-password & reset-password)', () => {
    let recoveryToken: string;

    it('issues a secure hashed reset token for existing registered user', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testPatientEmail }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.recoveryToken).toBeDefined();
      recoveryToken = json.recoveryToken;

      // Verify token exists in database with hashed form
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { userId: testPatientUser.id, usedAt: null },
      });
      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord?.tokenHash).toBe(hashToken(recoveryToken));
    });

    it('resets user password with valid token and invalidates token', async () => {
      const newPassword = 'NewSecretPassword2026!';
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: recoveryToken,
          password: newPassword,
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify token is now marked used
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: hashToken(recoveryToken) },
      });
      expect(tokenRecord?.usedAt).not.toBeNull();

      // Verify login works with new password
      const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testPatientEmail,
          password: newPassword,
        }),
      });
      const loginRes = await loginHandler(loginReq);
      expect(loginRes.status).toBe(200);
    });

    it('rejects already used recovery token with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: recoveryToken,
          password: 'AnotherPassword123!',
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/already been used|expired|invalid/i);
    });
  });

  describe('5. Medical Records Persistence & Pagination (POST & GET /api/records)', () => {
    let createdDocId: string;

    it('persists a medical document with extracted biomarkers for the authenticated patient', async () => {
      const req = new NextRequest('http://localhost:3000/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          title: 'Comprehensive Metabolic Panel (CMP)',
          category: 'LAB_RESULTS',
          fileName: 'cmp_report_2026.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1024 * 350,
          storageKey: 'vault/cmp_report_2026.pdf',
          facilityName: 'Metro Health Diagnostics',
          orderingClinician: 'Dr. Aris Thorne',
          aiPlainSummary: 'Liver and renal function within normal limits, fasting glucose slightly elevated.',
          biomarkers: [
            {
              name: 'Glucose (Fasting)',
              value: '108',
              unit: 'mg/dL',
              referenceRange: '70-99',
              flag: 'SLIGHTLY_ELEVATED',
              interpretation: 'Pre-diabetic fasting glucose range requiring lifestyle monitoring.',
            },
            {
              name: 'eGFR',
              value: '95',
              unit: 'mL/min/1.73m2',
              referenceRange: '>60',
              flag: 'NORMAL',
              interpretation: 'Optimal kidney filtration capacity.',
            },
          ],
        }),
      });

      const res = await postRecordsHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.document.title).toBe('Comprehensive Metabolic Panel (CMP)');
      expect(json.document.biomarkers).toHaveLength(2);
      createdDocId = json.document.id;
    });

    it('retrieves paginated documents belonging strictly to the authenticated patient', async () => {
      const req = new NextRequest('http://localhost:3000/api/records?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${testPatientToken}`,
        },
      });

      const res = await getRecordsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.length).toBeGreaterThanOrEqual(1);
      const found = json.data.find((d: { id: string }) => d.id === createdDocId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Comprehensive Metabolic Panel (CMP)');
    });

    it('retrieves paginated assessments via GET /api/assessments', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${testPatientToken}`,
        },
      });

      const res = await getAssessmentsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.pagination).toBeDefined();
    });
  });

  describe('6. Record Ownership Enforcement & URL ID-Tampering Denial (HTTP 403 Forbidden)', () => {
    let patientADocId: string;
    let patientASessionId: string;

    beforeAll(async () => {
      // Create document for Patient A
      const docReq = new NextRequest('http://localhost:3000/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          title: 'Private Patient A Cardiac Echo Report',
          category: 'IMAGING',
          fileName: 'echo_patient_a.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 500000,
          storageKey: 'vault/echo_patient_a.pdf',
        }),
      });
      const docRes = await postRecordsHandler(docReq);
      const docJson = await docRes.json();
      patientADocId = docJson.document.id;

      // Create assessment for Patient A
      const assessReq = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Mild intermittent dry cough after morning runs.',
          includeEhrContext: true,
          acuityLevel: 'SELF_CARE',
          answers: [
            {
              stepNumber: 1,
              questionKey: 'cough_duration',
              questionPrompt: 'How long has the cough persisted?',
              answerValue: '3 days',
            },
          ],
        }),
      });
      const assessRes = await postAssessmentsHandler(assessReq);
      const assessJson = await assessRes.json();
      patientASessionId = assessJson.session.id;
    });

    it('allows Patient A to access their own document', async () => {
      const req = new NextRequest(`http://localhost:3000/api/records/${patientADocId}`, {
        headers: { Authorization: `Bearer ${testPatientToken}` },
      });
      const res = await getRecordByIdHandler(req, { params: Promise.resolve({ id: patientADocId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.document.id).toBe(patientADocId);
    });

    it('DENIES Patient B (HTTP 403 Forbidden) from viewing Patient A document via ID-tampering', async () => {
      const req = new NextRequest(`http://localhost:3000/api/records/${patientADocId}`, {
        headers: { Authorization: `Bearer ${otherPatientToken}` },
      });
      const res = await getRecordByIdHandler(req, { params: Promise.resolve({ id: patientADocId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('DENIES Patient B (HTTP 403 Forbidden) from deleting Patient A document', async () => {
      const req = new NextRequest(`http://localhost:3000/api/records/${patientADocId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${otherPatientToken}` },
      });
      const res = await deleteRecordByIdHandler(req, { params: Promise.resolve({ id: patientADocId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('FORBIDDEN_OWNERSHIP');

      // Verify document still exists in DB
      const stillInDb = await prisma.medicalDocument.findUnique({ where: { id: patientADocId } });
      expect(stillInDb).not.toBeNull();
    });

    it('DENIES Patient B (HTTP 403 Forbidden) from viewing Patient A assessment results', async () => {
      const req = new NextRequest(`http://localhost:3000/api/assessments/${patientASessionId}`, {
        headers: { Authorization: `Bearer ${otherPatientToken}` },
      });
      const res = await getAssessmentByIdHandler(req, { params: Promise.resolve({ id: patientASessionId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('allows Clinician to view Patient A document under authorized clinical review', async () => {
      const req = new NextRequest(`http://localhost:3000/api/records/${patientADocId}`, {
        headers: { Authorization: `Bearer ${clinicianToken}` },
      });
      const res = await getRecordByIdHandler(req, { params: Promise.resolve({ id: patientADocId }) });
      expect(res.status).toBe(200);
    });
  });

  describe('7. Deterministic Red-Flag Escalation on Assessment Intake', () => {
    it('automatically escalates acute chest pain symptoms to EMERGENCY acuity', async () => {
      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Sudden crushing chest pain radiating to left jaw with severe shortness of breath.',
          includeEhrContext: true,
          acuityLevel: 'ROUTINE', // Attempting to pass low acuity
        }),
      });

      const res = await postAssessmentsHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Deterministic rule engine overrides to EMERGENCY
      expect(json.session.acuityLevel).toBe('EMERGENCY');
      expect(json.session.redFlagTriggered).toBe(true);
      expect(json.session.recommendedCareSetting).toMatch(/Emergency/i);

      // Verify status history recorded
      const statusHistory = await prisma.assessmentStatusHistory.findMany({
        where: { sessionId: json.session.id },
      });
      expect(statusHistory.length).toBeGreaterThanOrEqual(1);
      expect(statusHistory.some((s) => s.toStatus === 'ACTION_REQUIRED')).toBe(true);

      // Verify audit log recorded HIGH_RISK_ESCALATION
      const escalationAudit = await prisma.auditLog.findFirst({
        where: {
          targetEntityId: json.session.id,
          actionType: 'HIGH_RISK_ESCALATION',
        },
      });
      expect(escalationAudit).not.toBeNull();
      expect(escalationAudit?.finalAcuity).toBe('EMERGENCY');
    });
  });

  describe('8. Clinician Review Sign-Off & RBAC Authorization (POST /api/reviews/[id]/sign-off)', () => {
    let reviewId: string;

    beforeAll(async () => {
      // Create dedicated test session & review for sign-off testing without mutating seeded fixtures
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: testPatientUser.id },
      });
      const clinician = await prisma.user.findFirst({
        where: { role: 'CLINICIAN' },
      });

      if (patientProfile && clinician) {
        const testSession = await prisma.triageSession.create({
          data: {
            sessionCode: `CN-TEST-${Date.now()}`,
            patientProfileId: patientProfile.id,
            chiefComplaint: 'Subacute wheezing evaluation for sign-off attestation.',
            plainLanguageSummary: 'Subacute wheezing evaluation summary awaiting attestation.',
            status: 'PENDING_REVIEW',
            acuityLevel: 'ROUTINE',
            confidenceScore: 90,
            recommendedCareSetting: 'Outpatient Pulmonology',
            includeEhrContext: true,
            isSeedFixture: false,
          },
        });

        const review = await prisma.clinicianReview.create({
          data: {
            sessionId: testSession.id,
            clinicianId: clinician.id,
            stage: 'REVIEWING',
            concordanceStatus: 'PENDING',
            isSeedFixture: false,
          },
        });
        reviewId = review.id;
      }
    });

    it('DENIES patient (HTTP 403 Forbidden) from attempting to sign off on a review', async () => {
      if (!reviewId) return;

      const req = new NextRequest(`http://localhost:3000/api/reviews/${reviewId}/sign-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          decisionType: 'CARE_PLAN_SIGNED',
          clinicianNote: 'Unauthorized patient attempt to sign care plan.',
        }),
      });

      const res = await signOffReviewHandler(req, { params: Promise.resolve({ id: reviewId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows Clinician to attest care plan, records ReviewDecision, and transitions status to VERIFIED', async () => {
      if (!reviewId) return;

      const req = new NextRequest(`http://localhost:3000/api/reviews/${reviewId}/sign-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianToken}`,
        },
        body: JSON.stringify({
          decisionType: 'CARE_PLAN_SIGNED',
          concordanceStatus: 'AGREED',
          clinicianNote: 'Reviewed spirometry biomarkers and clinical narrative. Prescribed inhaled corticosteroid.',
          rationale: 'Concur with AI differential and recommended follow-up in 14 days.',
        }),
      });

      const res = await signOffReviewHandler(req, { params: Promise.resolve({ id: reviewId }) });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.review.stage).toBe('SIGNED');
      expect(json.decision.decisionType).toBe('CARE_PLAN_SIGNED');

      // Verify TriageSession updated to VERIFIED
      const updatedReview = await prisma.clinicianReview.findUnique({
        where: { id: reviewId },
        include: { session: true },
      });
      expect(updatedReview?.session.status).toBe('VERIFIED');
    });
  });

  describe('9. Privacy Consent Management & Audit Trail (GET & PUT /api/consent)', () => {
    it('retrieves patient consent preferences', async () => {
      const req = new NextRequest('http://localhost:3000/api/consent', {
        headers: { Authorization: `Bearer ${testPatientToken}` },
      });

      const res = await getConsentHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.consent.includeEhrContext).toBe(true);
    });

    it('updates consent preferences and creates audit log', async () => {
      const req = new NextRequest('http://localhost:3000/api/consent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testPatientToken}`,
        },
        body: JSON.stringify({
          includeEhrContext: false,
          storeVoiceTranscripts: false,
          deidentifiedModelImprovement: true,
        }),
      });

      const res = await putConsentHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.consent.includeEhrContext).toBe(false);
      expect(json.consent.storeVoiceTranscripts).toBe(false);
      expect(json.consent.deidentifiedModelImprovement).toBe(true);

      // Verify persistence in DB
      const consentInDb = await prisma.consentPreference.findUnique({
        where: { userId: testPatientUser.id },
      });
      expect(consentInDb?.includeEhrContext).toBe(false);

      // Verify audit trail logged
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actorUserId: testPatientUser.id,
          actionType: 'CONSENT_UPDATED',
        },
      });
      expect(auditLog).not.toBeNull();
    });
  });
});
