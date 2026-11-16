import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionToken, type SessionUser } from '@/server/auth/session';
import {
  CARENAV_TRIAGE_SCHEMA_VERSION,
  CARENAV_PROMPT_VERSION,
  type TriageOutputV1,
} from '@/server/triage/ai/types';
import { validateTriageOutput } from '@/server/triage/ai/schema';
import {
  prepareDeidentifiedTriagePayload,
  formatTriagePrompt,
} from '@/server/triage/ai/deidentifier';
import {
  MockTriageProvider,
  GeminiTriageProvider,
  OllamaMedGemmaTriageProvider,
  setAiAssessmentProviderOverride,
  getAiAssessmentProvider,
} from '@/server/triage/ai/provider-adapter';
import { orchestrateAiAssessment } from '@/server/triage/ai/triage-orchestrator';
import { POST as postAssessmentsHandler } from '@/app/api/assessments/route';

describe('CareNavigator Server-Side AI Assessment Integration (AGENTS.md Rules 4.1 - 4.3)', () => {
  afterEach(() => {
    // Reset provider override after each test
    setAiAssessmentProviderOverride(null);
    vi.unstubAllGlobals();
  });

  describe('1. Data Minimization & Privacy De-identification (AGENTS.md Rule 3.1 & Rule 3.3)', () => {
    const mockRawContext = {
      age: 42,
      sex: 'Female',
      conditions: [{ name: 'Mild Intermittent Asthma', status: 'active' }],
      medications: [{ name: 'Albuterol HFA', dosage: '90mcg PRN', status: 'active' }],
      allergies: [{ allergen: 'Penicillin', severity: 'Anaphylaxis' }],
      vitals: [
        { vitalType: 'SpO2', value: '98', unit: '%', flag: null },
        { vitalType: 'Heart Rate', value: '74', unit: 'BPM', flag: null },
      ],
    };

    it('omits all patient PII (name, MRN, email, phone) from the de-identified payload', () => {
      const deidentified = prepareDeidentifiedTriagePayload(
        {
          chiefComplaint: 'Mild wheezing after outdoor jog',
          includeEhrContext: true,
          answers: [
            {
              stepNumber: 1,
              questionKey: 'symptom_timing',
              questionPrompt: 'When did symptoms start?',
              answerValue: 'Approximately 2 hours ago',
            },
          ],
        },
        mockRawContext
      );

      // Verify no PII fields exist on input
      const record = deidentified as unknown as Record<string, unknown>;
      expect(record.name).toBeUndefined();
      expect(record.mrn).toBeUndefined();
      expect(record.email).toBeUndefined();
      expect(record.phone).toBeUndefined();

      expect(deidentified.age).toBe(42);
      expect(deidentified.sex).toBe('Female');
      expect(deidentified.chiefComplaint).toBe('Mild wheezing after outdoor jog');
      expect(deidentified.vitalsTelemetry).toHaveLength(2);
    });

    it('strictly excludes conditions, medications, and allergies when EHR consent is false', () => {
      const deidentifiedNoConsent = prepareDeidentifiedTriagePayload(
        {
          chiefComplaint: 'Mild wheezing after outdoor jog',
          includeEhrContext: false, // Opted out
        },
        mockRawContext
      );

      expect(deidentifiedNoConsent.includeEhrContext).toBe(false);
      expect(deidentifiedNoConsent.relevantConditions).toBeUndefined();
      expect(deidentifiedNoConsent.activeMedications).toBeUndefined();
      expect(deidentifiedNoConsent.knownAllergies).toBeUndefined();

      const prompt = formatTriagePrompt(deidentifiedNoConsent);
      expect(prompt).toContain('Patient opted out of sharing longitudinal EHR context');
      expect(prompt).not.toContain('Penicillin');
      expect(prompt).not.toContain('Albuterol');
    });

    it('includes sanitized conditions, medications, and allergies when EHR consent is true', () => {
      const deidentifiedWithConsent = prepareDeidentifiedTriagePayload(
        {
          chiefComplaint: 'Mild wheezing after outdoor jog',
          includeEhrContext: true,
        },
        mockRawContext
      );

      expect(deidentifiedWithConsent.relevantConditions).toContain('Mild Intermittent Asthma');
      expect(deidentifiedWithConsent.activeMedications).toContain('Albuterol HFA (90mcg PRN)');
      expect(deidentifiedWithConsent.knownAllergies).toContain('Penicillin [Severity: Anaphylaxis]');

      const prompt = formatTriagePrompt(deidentifiedWithConsent);
      expect(prompt).toContain('Mild Intermittent Asthma');
      expect(prompt).toContain('Penicillin');
    });
  });

  describe('2. Versioned Output Schema Validation (CARENAV_TRIAGE_SCHEMA_VERSION 1.0.0)', () => {
    const validOutput: TriageOutputV1 = {
      schemaVersion: CARENAV_TRIAGE_SCHEMA_VERSION,
      acuityLevel: 'URGENT',
      confidenceScore: 91,
      uncertaintyRationale:
        'Confidence is 91% due to characteristic acute bronchospasm history, though absence of peak expiratory flow limits exact staging.',
      recommendedCareSetting: 'Urgent Care Center or Same-Day Primary Care within 24 hours',
      plainLanguageSummary:
        'Your symptoms suggest an acute asthma flare-up that needs same-day clinical attention.',
      clinicalRationale:
        'Exertional dyspnea in a patient with diagnosed asthma and wheezing indicates reversible airway obstruction.',
      differentialConsiderations: [
        {
          conditionLabel: 'Acute Asthma Exacerbation',
          matchLikelihood: 'HIGH',
          rationale: 'Wheezing and chest tightness following exercise in known asthmatic.',
        },
      ],
      extractedEntities: {
        symptoms: ['wheezing', 'chest tightness'],
        duration: '2 hours',
        pertinentNegatives: ['No stridor', 'No cyanosis'],
        severityLevel: 'Moderate',
      },
      recommendedNextSteps: [
        'Use rescue inhaler as prescribed.',
        'Seek urgent medical care within 24 hours.',
      ],
      visitPrepQuestions: ['Should my controller medication be adjusted?'],
      suggestedGuidelineCodes: ['GINA_2025'],
      redFlagWarnings: ['Severe shortness of breath at rest'],
      nonDiagnosticDisclaimer:
        'Automated decision support. Not a confirmed medical diagnosis.',
    };

    it('successfully validates a compliant TriageOutputV1 payload', () => {
      const validated = validateTriageOutput(validOutput);
      expect(validated.schemaVersion).toBe('1.0.0');
      expect(validated.acuityLevel).toBe('URGENT');
      expect(validated.confidenceScore).toBe(91);
      expect(validated.differentialConsiderations).toHaveLength(1);
    });

    it('rejects output missing required acuityLevel with schema validation error', () => {
      const invalid = { ...validOutput };
      delete (invalid as Partial<TriageOutputV1>).acuityLevel;

      expect(() => validateTriageOutput(invalid)).toThrowError(/acuityLevel/i);
    });

    it('rejects unsupported acuity levels outside the approved four-tier scale', () => {
      const invalid = { ...validOutput, acuityLevel: 'CRITICAL' };
      expect(() => validateTriageOutput(invalid)).toThrowError(/acuityLevel/i);
    });

    it('rejects confidence scores outside the 1 to 100 range', () => {
      const invalidLow = { ...validOutput, confidenceScore: 0 };
      const invalidHigh = { ...validOutput, confidenceScore: 105 };

      expect(() => validateTriageOutput(invalidLow)).toThrowError(/confidenceScore/i);
      expect(() => validateTriageOutput(invalidHigh)).toThrowError(/confidenceScore/i);
    });

    it('rejects outputs with empty differential considerations', () => {
      const invalid = { ...validOutput, differentialConsiderations: [] };
      expect(() => validateTriageOutput(invalid)).toThrowError(/differential/i);
    });
  });

  describe('3. Configurable Provider Adapter & Factory', () => {
    it('returns MockTriageProvider when AI_ASSESSMENT_PROVIDER is set to "mock"', () => {
      const prev = process.env.AI_ASSESSMENT_PROVIDER;
      try {
        process.env.AI_ASSESSMENT_PROVIDER = 'mock';
        const provider = getAiAssessmentProvider();
        expect(provider.providerName).toBe('mock-triage-adapter');
        expect(provider.isAvailable()).toBe(true);
      } finally {
        if (prev === undefined) {
          delete process.env.AI_ASSESSMENT_PROVIDER;
        } else {
          process.env.AI_ASSESSMENT_PROVIDER = prev;
        }
      }
    });

    it('returns GeminiTriageProvider by default', () => {
      const prev = process.env.AI_ASSESSMENT_PROVIDER;
      try {
        delete process.env.AI_ASSESSMENT_PROVIDER;
        const provider = getAiAssessmentProvider();
        expect(provider.providerName).toBe('google-gemini');
      } finally {
        if (prev === undefined) {
          delete process.env.AI_ASSESSMENT_PROVIDER;
        } else {
          process.env.AI_ASSESSMENT_PROVIDER = prev;
        }
      }
    });

    it('selects the local MedGemma adapter when Ollama is configured', () => {
      const prev = process.env.AI_ASSESSMENT_PROVIDER;
      try {
        process.env.AI_ASSESSMENT_PROVIDER = 'ollama';
        const provider = getAiAssessmentProvider();
        expect(provider).toBeInstanceOf(OllamaMedGemmaTriageProvider);
        expect(provider.providerName).toBe('ollama-medgemma');
      } finally {
        if (prev === undefined) delete process.env.AI_ASSESSMENT_PROVIDER;
        else process.env.AI_ASSESSMENT_PROVIDER = prev;
      }
    });

    it('calls Ollama JSON mode without tools and validates MedGemma triage output', async () => {
      const modelOutput: TriageOutputV1 = {
        schemaVersion: CARENAV_TRIAGE_SCHEMA_VERSION,
        acuityLevel: 'ROUTINE',
        confidenceScore: 70,
        uncertaintyRationale: 'Confidence is limited because this test has no measured vital signs.',
        recommendedCareSetting: 'Primary care review within several days',
        plainLanguageSummary: 'These sample symptoms need routine clinician review.',
        clinicalRationale: 'This output is a schema fixture used to exercise the local adapter.',
        differentialConsiderations: [
          { conditionLabel: 'Sample consideration', matchLikelihood: 'LOW', rationale: 'Test-only content.' },
        ],
        extractedEntities: { symptoms: ['sample symptom'], duration: 'Not specified', pertinentNegatives: [], severityLevel: 'Unknown' },
        recommendedNextSteps: ['Arrange a clinician review.'],
        visitPrepQuestions: ['When should I follow up?'],
        suggestedGuidelineCodes: [],
        redFlagWarnings: [],
        nonDiagnosticDisclaimer: 'Test output only. Not a diagnosis.',
      };
      let requestBody: Record<string, unknown> | undefined;
      vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ message: { content: JSON.stringify(modelOutput) } }), { status: 200 });
      }));

      const result = await new OllamaMedGemmaTriageProvider('medgemma:4b').assess({
        chiefComplaint: 'sample cough',
        structuredAnswers: [],
        includeEhrContext: false,
      });

      expect(result.acuityLevel).toBe('ROUTINE');
      expect(requestBody?.format).toBe('json');
      expect(requestBody).not.toHaveProperty('tools');
      expect(requestBody?.model).toBe('medgemma:4b');
    });

    it('allows explicit provider overrides for testing', () => {
      const mock = new MockTriageProvider('SUCCESS');
      setAiAssessmentProviderOverride(mock);
      const resolved = getAiAssessmentProvider();
      expect(resolved).toBe(mock);
    });

    it('transparently reports Gemini unavailable when API key is missing', () => {
      const unconfiguredGemini = new GeminiTriageProvider('gemini-2.5-flash', '');
      expect(unconfiguredGemini.isAvailable()).toBe(false);
    });
  });

  describe('4. Mock Provider Error Handling & Resilient Fallback (AGENTS.md Rule 4.1)', () => {
    it('catches provider timeout and safely falls back to deterministic CDS mode', async () => {
      const timeoutMock = new MockTriageProvider('TIMEOUT');
      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Subacute sinus pressure and nasal congestion for 4 days',
          includeEhrContext: false,
        },
        null,
        { providerOverride: timeoutMock }
      );

      expect(result.providerStatus).toBe('FALLBACK_DETERMINISTIC');
      expect(result.fallbackReason).toContain('PROVIDER_TIMEOUT');
      expect(result.triageOutput.acuityLevel).toBe('ROUTINE');
      expect(result.metadata.isAiGenerated).toBe(false);
    });

    it('catches provider rate limit (429) and safely falls back without crashing', async () => {
      const rateLimitMock = new MockTriageProvider('RATE_LIMIT');
      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Mild ankle sprain with slight swelling after running',
          includeEhrContext: false,
        },
        null,
        { providerOverride: rateLimitMock }
      );

      expect(result.providerStatus).toBe('FALLBACK_DETERMINISTIC');
      expect(result.fallbackReason).toContain('RATE_LIMIT_EXCEEDED');
      expect(result.triageOutput.acuityLevel).toBe('ROUTINE');
    });

    it('catches schema validation failures from corrupted model output and falls back', async () => {
      const schemaErrorMock = new MockTriageProvider('SCHEMA_ERROR');
      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Tension headache after prolonged computer screen use',
          includeEhrContext: false,
        },
        null,
        { providerOverride: schemaErrorMock }
      );

      expect(result.providerStatus).toBe('FALLBACK_DETERMINISTIC');
      expect(result.fallbackReason).toContain('SCHEMA_VALIDATION_FAILED');
    });

    it('catches network/socket connection errors and falls back', async () => {
      const networkMock = new MockTriageProvider('NETWORK_ERROR');
      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Minor finger paper cut with slight redness',
          includeEhrContext: false,
        },
        null,
        { providerOverride: networkMock }
      );

      expect(result.providerStatus).toBe('FALLBACK_DETERMINISTIC');
      expect(result.fallbackReason).toContain('PROVIDER_EXECUTION_ERROR');
    });
  });

  describe('5. Deterministic Emergency Safety Precedence (AGENTS.md Rule 4.3)', () => {
    it('overrides AI ROUTINE suggestion to EMERGENCY when acute red flags are present', async () => {
      // Mock AI intentionally attempts to return ROUTINE acuity for severe chest pain
      const laxAiMock = new MockTriageProvider('SUCCESS', {
        acuityLevel: 'ROUTINE',
        recommendedCareSetting: 'Outpatient Clinic',
      });

      const result = await orchestrateAiAssessment(
        {
          chiefComplaint:
            'Crushing substernal chest pressure radiating to left arm and jaw with cold sweat',
          includeEhrContext: true,
          answers: [
            {
              stepNumber: 1,
              questionKey: 'pain_severity',
              questionPrompt: 'Describe radiation',
              answerValue: 'Crushing chest pain radiating to jaw and diaphoresis',
            },
          ],
        },
        null,
        { providerOverride: laxAiMock }
      );

      // Deterministic red-flag guardrail engine MUST override AI
      expect(result.redFlagEvaluation.triggered).toBe(true);
      expect(result.triageOutput.acuityLevel).toBe('EMERGENCY');
      expect(result.triageOutput.confidenceScore).toBe(99);
      expect(result.triageOutput.recommendedCareSetting).toBe(
        'Immediate Emergency Department Evaluation / Call 999'
      );
      expect(result.metadata.deterministicOverrideApplied).toBe(true);
      expect(result.triageOutput.redFlagWarnings[0]).toContain('[CRITICAL RED FLAG]');
    });

    it('preserves non-emergency AI acuity when red-flag screening is clear', async () => {
      const validMock = new MockTriageProvider('SUCCESS', {
        acuityLevel: 'URGENT',
        confidenceScore: 88,
      });

      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Persistent productive cough with green phlegm and low fever',
          includeEhrContext: false,
        },
        null,
        { providerOverride: validMock }
      );

      expect(result.redFlagEvaluation.triggered).toBe(false);
      expect(result.triageOutput.acuityLevel).toBe('URGENT');
      expect(result.metadata.deterministicOverrideApplied).toBe(false);
    });
  });

  describe('6. Distinction Between AI Suggestions and Clinician Decisions (AGENTS.md Rule 4.2)', () => {
    it('marks AI output as unverified decision support requiring clinician sign-off', async () => {
      const mock = new MockTriageProvider('SUCCESS');
      const result = await orchestrateAiAssessment(
        {
          chiefComplaint: 'Mild recurrent epigastric burning after meals',
          includeEhrContext: true,
        },
        null,
        { providerOverride: mock }
      );

      expect(result.metadata.isAiGenerated).toBe(true);
      expect(result.metadata.clinicianVerified).toBe(false);
      expect(result.triageOutput.nonDiagnosticDisclaimer).toMatch(/not.*diagnosis/i);
      expect(result.metadata.promptVersion).toBe(CARENAV_PROMPT_VERSION);
      expect(result.metadata.schemaVersion).toBe(CARENAV_TRIAGE_SCHEMA_VERSION);
      expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('7. End-to-End API Integration with Mock Provider (POST /api/assessments)', () => {
    const testEmail = `ai.triage.test.${Date.now()}@carenavigator.test`;
    let user: SessionUser;
    let token: string;

    beforeEach(async () => {
      const createdUser = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: 'salt:hash',
          name: 'AI Test Patient',
          role: 'PATIENT',
          mrn: `MRN-AI-${Date.now().toString().slice(-6)}`,
          patientProfile: {
            create: {
              dateOfBirth: '1988-04-12',
              age: 38,
              sex: 'Male',
              bloodType: 'O+',
              primaryCarePhysician: 'Dr. Elena Rostova',
              insuranceProvider: 'Blue Shield',
              insuranceMemberId: 'BS-9912',
            },
          },
        },
      });

      user = {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: 'PATIENT',
        mrn: createdUser.mrn,
        isSeedFixture: false,
      };

      token = await signSessionToken(user);
    });

    it('persists AI-generated triage session with differential JSON, prep questions, and audit log', async () => {
      // Configure mock provider override for predictable live testing
      const mock = new MockTriageProvider('SUCCESS', {
        acuityLevel: 'ROUTINE',
        confidenceScore: 89,
        plainLanguageSummary: 'AI synthesis: Symptoms appear consistent with subacute bronchitis.',
      });
      setAiAssessmentProviderOverride(mock);

      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `carenavigator_session=${token}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Lingering cough and chest scratchiness for five days',
          includeEhrContext: true,
          answers: [
            {
              stepNumber: 1,
              questionKey: 'duration',
              questionPrompt: 'Duration of symptoms',
              answerValue: 'Five days duration',
            },
          ],
        }),
      });

      const res = await postAssessmentsHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.session.id).toBeDefined();
      expect(data.session.acuityLevel).toBe('ROUTINE');
      expect(data.session.confidenceScore).toBe(89);
      expect(data.session.differentialJson).toBeDefined();
      expect(data.session.extractedEntitiesJson).toBeDefined();
      expect(data.session.visitPrepQuestionsJson).toBeDefined();

      // Verify AI metadata in API response
      expect(data.aiMetadata.provider).toBe('mock-triage-adapter');
      expect(data.aiMetadata.promptVersion).toBe('carenav-triage-v1.0');
      expect(data.aiMetadata.schemaVersion).toBe('1.0.0');

      // Verify AuditLog entry recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          targetEntityId: data.session.id,
          actionType: 'TRIAGE_CREATED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.finalAcuity).toBe('ROUTINE');
      expect(auditLog?.metadataJson).toContain('mock-triage-adapter');
    });
  });
});
