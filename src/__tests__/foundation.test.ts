import { describe, it, expect } from 'vitest';
import { validateServerEnv, isGeminiConfigured } from '@/lib/env';
import { redactSensitiveData } from '@/lib/logger';
import {
  CANONICAL_COLORS,
  PATIENT_NAV_SECTIONS,
  CLINICAL_ADMIN_NAV_SECTIONS,
} from '@/lib/design-tokens';
import {
  DEMO_PERSONAS,
  signSessionToken,
  verifySessionToken,
} from '@/server/auth/session';
import {
  AuthError,
  requireAuthenticated,
  requireRole,
  requireRecordOwnership,
  filterEhrContextByConsent,
} from '@/server/auth/guards';
import { evaluateRedFlags } from '@/server/triage/red-flag-engine';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/server/audit/audit-logger';

describe('CareNavigator Technical Foundation & Governance Suite', () => {
  describe('1. Environment Validation & Secret Protection (AGENTS.md 3.1)', () => {
    it('validates safe server environment variables and provides defaults', () => {
      const parsed = validateServerEnv({
        DATABASE_URL: 'file:./dev.db',
        AUTH_SECRET: 'super-secure-test-secret-minimum-16-chars',
        NEXTAUTH_URL: 'http://localhost:3000',
        LOCAL_VAULT_DIR: '.local-vault',
        NODE_ENV: 'test',
      });

      expect(parsed.DATABASE_URL).toBe('file:./dev.db');
      expect(parsed.LOCAL_VAULT_DIR).toBe('.local-vault');
    });

    it('rejects accidental NEXT_PUBLIC_ secret exposure', () => {
      expect(() =>
        validateServerEnv({
          DATABASE_URL: 'file:./dev.db',
          AUTH_SECRET: 'super-secure-test-secret-minimum-16-chars',
          NEXT_PUBLIC_GEMINI_API_KEY: 'AIzaSyLeakedKey123456',
        })
      ).toThrow(/Security Violation/);
    });

    it('rejects LOCAL_VAULT_DIR inside public/ web root', () => {
      expect(() =>
        validateServerEnv({
          DATABASE_URL: 'file:./dev.db',
          AUTH_SECRET: 'super-secure-test-secret-minimum-16-chars',
          LOCAL_VAULT_DIR: 'public/uploads',
        })
      ).toThrow(/LOCAL_VAULT_DIR must never reside inside the public/);
    });

    it('transparently reports Gemini API configuration status without fabricating success', () => {
      expect(isGeminiConfigured({ GEMINI_API_KEY: '' })).toBe(false);
      expect(isGeminiConfigured({ GEMINI_API_KEY: 'your-gemini-api-key' })).toBe(false);
      expect(isGeminiConfigured({ GEMINI_API_KEY: 'AIzaSyRealLookingValidKey9988776655' })).toBe(
        true
      );
    });
  });

  describe('2. PHI & Secret Redaction Logger (AGENTS.md 3.1)', () => {
    it('redacts sensitive medical narratives, biomarkers, DOB, and secrets from log objects', () => {
      const rawPayload = {
        sessionCode: 'CN-2026-8841',
        patientName: 'Nusrat Jahan',
        dateOfBirth: '1986-04-12',
        chiefComplaint: 'Severe crushing chest pain',
        biomarkerValue: 'HbA1c 6.4%',
        apiKey: 'secret-key-value',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
      };

      const redacted = redactSensitiveData(rawPayload) as Record<string, unknown>;
      expect(redacted.sessionCode).toBe('CN-2026-8841');
      expect(redacted.patientName).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.dateOfBirth).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.chiefComplaint).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.biomarkerValue).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.apiKey).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.authorization).toBe('[REDACTED_PHI_OR_SECRET]');
    });
  });

  describe('3. Authentication, RBAC, Ownership & EHR Consent Guards (AGENTS.md 3.3)', () => {
    it('signs and verifies HMAC-SHA256 JWT session tokens accurately', async () => {
      const token = await signSessionToken(DEMO_PERSONAS.CLINICIAN);
      const verified = await verifySessionToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(DEMO_PERSONAS.CLINICIAN.id);
      expect(verified?.role).toBe('CLINICIAN');
      expect(verified?.name).toBe('Dr. Ayesha Rahman, MBBS, FCPS');
    });

    it('rejects tampered JWT session tokens', async () => {
      const token = await signSessionToken(DEMO_PERSONAS.PATIENT);
      const tampered = `${token}tampered`;
      const verified = await verifySessionToken(tampered);
      expect(verified).toBeNull();
    });

    it('enforces authentication and role authorization (RBAC)', () => {
      expect(() => requireAuthenticated(null)).toThrowError(AuthError);
      expect(() => requireRole(DEMO_PERSONAS.PATIENT, ['CLINICIAN', 'ADMIN'])).toThrow(
        /not authorized/
      );

      const authorizedClinician = requireRole(DEMO_PERSONAS.CLINICIAN, ['CLINICIAN', 'ADMIN']);
      expect(authorizedClinician.role).toBe('CLINICIAN');
    });

    it('enforces strict patient record ownership while permitting authorized clinical review', () => {
      // Patient can access own record
      expect(
        requireRecordOwnership(DEMO_PERSONAS.PATIENT, DEMO_PERSONAS.PATIENT.id).id
      ).toBe(DEMO_PERSONAS.PATIENT.id);

      // Patient cannot access another patient's record
      expect(() =>
        requireRecordOwnership(DEMO_PERSONAS.PATIENT, 'other-patient-user-id')
      ).toThrow(/ownership permission/);

      // Clinician can access patient record when allowClinicalAccess is true
      expect(
        requireRecordOwnership(DEMO_PERSONAS.CLINICIAN, DEMO_PERSONAS.PATIENT.id, {
          allowClinicalAccess: true,
        }).role
      ).toBe('CLINICIAN');
    });

    it('enforces server-side Longitudinal EHR Consent Toggle before prompt injection', () => {
      const mockEhr = {
        age: 38,
        sex: 'Female',
        conditions: ['Asthma'],
        medications: ['Albuterol'],
        allergies: ['Penicillin'],
      };

      expect(filterEhrContextByConsent(false, true, mockEhr)).toBeNull();
      expect(filterEhrContextByConsent(true, false, mockEhr)).toBeNull();
      expect(filterEhrContextByConsent(true, true, mockEhr)).toEqual(mockEhr);
    });
  });

  describe('4. Deterministic Clinical Red-Flag Guardrail Engine (AGENTS.md 4.3)', () => {
    it('immediately escalates acute crushing chest pain or radiation triad to EMERGENCY', () => {
      const result = evaluateRedFlags(
        'Experiencing crushing chest pain radiating to my left arm and cold sweat for 20 minutes.'
      );
      expect(result.triggered).toBe(true);
      expect(result.forcedAcuity).toBe('EMERGENCY');
      expect(result.matchedRules.some((r) => r.protocolCategory === 'ACUTE_CORONARY_SYNDROME')).toBe(
        true
      );
    });

    it('escalates stroke FAST neurological symptoms to EMERGENCY', () => {
      const result = evaluateRedFlags('My husband has sudden facial droop and slurred speech.');
      expect(result.triggered).toBe(true);
      expect(result.forcedAcuity).toBe('EMERGENCY');
      expect(result.matchedRules.some((r) => r.protocolCategory === 'STROKE_FAST_NEUROLOGIC')).toBe(
        true
      );
    });

    it('escalates anaphylaxis and self-harm crisis indicators to EMERGENCY', () => {
      const anaph = evaluateRedFlags('Hives all over and throat swelling after eating peanuts.');
      expect(anaph.triggered).toBe(true);
      expect(anaph.forcedAcuity).toBe('EMERGENCY');

      const crisis = evaluateRedFlags('Having thoughts of self-harm tonight.');
      expect(crisis.triggered).toBe(true);
      expect(crisis.forcedAcuity).toBe('EMERGENCY');
    });

    it('does not false-trigger emergency escalation on routine non-red-flag symptoms', () => {
      const result = evaluateRedFlags(
        'Mild seasonal nasal congestion and itchy eyes for 3 days, no fever or shortness of breath.'
      );
      expect(result.triggered).toBe(false);
      expect(result.forcedAcuity).toBeNull();
    });
  });

  describe('5. Canonical Design Tokens & Relational Database Persistence', () => {
    it('maintains normalized M3 color tokens and semantic acuity tokens', () => {
      expect(CANONICAL_COLORS.primary.DEFAULT).toBe('#00646f');
      expect(CANONICAL_COLORS.secondary.DEFAULT).toBe('#2060a3');
      expect(CANONICAL_COLORS.tertiary.DEFAULT).toBe('#006970');
      expect(CANONICAL_COLORS.surface.DEFAULT).toBe('#f6f9ff');
      expect(CANONICAL_COLORS.acuity.EMERGENCY.accent).toBe('#ba1a1a');
      expect(PATIENT_NAV_SECTIONS.length).toBeGreaterThan(0);
      expect(CLINICAL_ADMIN_NAV_SECTIONS.length).toBeGreaterThan(0);
    });

    it('persists and queries seeded clinical fixtures and writes immutable audit logs', async () => {
      const patient = await prisma.user.findUnique({
        where: { email: 'nusrat.jahan@carenavigator.example' },
      });
      expect(patient).not.toBeNull();
      expect(patient?.isSeedFixture).toBe(true);

      const session = await prisma.triageSession.findUnique({
        where: { sessionCode: 'CN-2026-8841' },
        include: { citations: true, clinicianReview: true },
      });
      expect(session).not.toBeNull();
      expect(session?.citations.length).toBe(3);
      expect(session?.clinicianReview?.stage).toBe('REVIEWING');

      const auditEntry = await recordAuditLog({
        actorUserId: patient?.id,
        actorRole: 'PATIENT',
        actionType: 'CONSENT_UPDATED',
        targetEntityType: 'ConsentPreference',
        targetEntityId: 'test-consent-id',
        metadata: { includeEhrContext: true, patientName: 'ShouldBeRedacted' },
      });
      expect(auditEntry.id).toBeDefined();
      expect(auditEntry.isSeedFixture).toBe(false);
      expect(auditEntry.metadataJson).toContain('[REDACTED_PHI_OR_SECRET]');

      // Clean up test-created audit entry
      await prisma.auditLog.delete({ where: { id: auditEntry.id } });
    });
  });
});
