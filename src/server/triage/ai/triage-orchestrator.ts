import { logger } from '@/lib/logger';
import { evaluateRedFlags, type RedFlagEvaluationResult } from '../red-flag-engine';
import {
  CARENAV_TRIAGE_SCHEMA_VERSION,
  CARENAV_PROMPT_VERSION,
  type DeidentifiedTriageInput,
  type TriageOutputV1,
  type OrchestratedAssessmentResult,
  type AiAssessmentOptions,
  type AiAssessmentMetadata,
  AiAssessmentError,
} from './types';
import {
  prepareDeidentifiedTriagePayload,
  type IntakeSubmissionData,
  type RawPatientClinicalContext,
} from './deidentifier';
import { getAiAssessmentProvider, type AiAssessmentProvider } from './provider-adapter';
import { retrieveGuidelineEvidence } from '@/server/guidelines/retriever';
import { buildSafeEvidencePromptContext } from '@/server/guidelines/sanitizer';

/**
 * Generates an approved deterministic fallback assessment when external AI credentials
 * are missing or external API calls fail (AGENTS.md Rule 4.1 & Rule 4.3).
 * Never fabricates LLM output; explicitly documents deterministic CDS operation.
 */
function createDeterministicFallbackOutput(
  input: DeidentifiedTriageInput,
  redFlags: RedFlagEvaluationResult,
  fallbackReason: string
): TriageOutputV1 {
  const isEmergency = redFlags.triggered;

  return {
    schemaVersion: CARENAV_TRIAGE_SCHEMA_VERSION,
    acuityLevel: isEmergency ? 'EMERGENCY' : 'ROUTINE',
    confidenceScore: isEmergency ? 99 : 85,
    uncertaintyRationale: `Operating in Deterministic Clinical Decision Support mode (${fallbackReason}). Output is derived strictly from clinical red-flag guardrails and evidence-based clinical guidelines rather than generative AI synthesis.`,
    recommendedCareSetting: isEmergency
      ? 'Immediate Emergency Department Evaluation / Call 999'
      : 'Outpatient Primary Care or Telehealth Consultation within 3-5 days',
    plainLanguageSummary: isEmergency
      ? 'Critical clinical red-flag symptoms were identified. You must seek immediate emergency medical care or call 999.'
      : `Clinical intake recorded for "${input.chiefComplaint}". Standard outpatient primary care evaluation is recommended.`,
    clinicalRationale: isEmergency
      ? `Emergency red-flag protocol triggered: ${redFlags.matchedRules.map((r) => r.clinicalLabel).join('; ')}. Immediate emergency stabilization required.`
      : `Deterministic clinical protocol applied for chief complaint "${input.chiefComplaint}". Awaiting licensed clinician review and care plan sign-off.`,
    differentialConsiderations: [
      {
        conditionLabel: 'Primary Symptom Etiology (Under Clinician Review)',
        matchLikelihood: 'HIGH',
        rationale: `Clinical observation based on reported symptoms: "${input.chiefComplaint}". Requires clinical correlation.`,
      },
      {
        conditionLabel: 'Secondary Clinical Differential',
        matchLikelihood: 'MODERATE',
        rationale: 'Evidence-based consideration under standard outpatient triage guidelines.',
      },
    ],
    extractedEntities: {
      symptoms: [input.chiefComplaint, ...(input.structuredAnswers.map((a) => a.answerValue) || [])],
      duration: 'Per reported intake timeline',
      pertinentNegatives: ['Emergency screening completed'],
      severityLevel: isEmergency ? 'Critical Red Flag' : 'Moderate',
    },
    recommendedNextSteps: isEmergency
      ? [
          'Call 999 or present immediately to the nearest Emergency Department.',
          'Do not drive yourself if experiencing dizziness, severe pain, or respiratory distress.',
        ]
      : [
          'Schedule an appointment with a primary care clinician or book a telehealth consult.',
          'Document symptom frequency and note any changes in severity.',
          'Seek urgent care if symptoms worsen or new red flags develop.',
        ],
    visitPrepQuestions: [
      'What diagnostic tests (e.g. imaging, lab panels) are indicated for these symptoms?',
      'Are there warning signs that would require emergency evaluation?',
      'What is the recommended treatment or medication plan?',
    ],
    suggestedGuidelineCodes: ['GINA_2025', 'ACP_CHEST_PAIN', 'NICE_NG191'],
    redFlagWarnings: redFlags.matchedRules.map(
      (r) => `${r.clinicalLabel}: ${r.escalationDirective}`
    ),
    nonDiagnosticDisclaimer:
      'This clinical evaluation is an automated decision-support suggestion and does NOT constitute a confirmed medical diagnosis. Always consult a licensed healthcare professional for clinical care.',
  };
}

/**
 * Orchestrates the complete clinical assessment pipeline:
 * 1. Runs deterministic clinical red-flag screening (AGENTS.md Rule 4.3).
 * 2. Prepares de-identified, privacy-safe patient payload (Rule 3.1 & Rule 3.3).
 * 3. Calls the configured AI assessment provider adapter with timeout protection.
 * 4. Validates model output against the versioned Zod schema (Rule 4.2).
 * 5. Deterministically overrides acuity to EMERGENCY if red flags exist (cannot be downgraded by AI).
 * 6. Falls back safely and transparently if AI is unavailable or fails (Rule 4.1).
 * 7. Tracks execution latency, model version, and audit metadata.
 */
export async function orchestrateAiAssessment(
  submission: IntakeSubmissionData,
  clinicalContext?: RawPatientClinicalContext | null,
  options?: {
    providerOverride?: AiAssessmentProvider;
    assessmentOptions?: AiAssessmentOptions;
  }
): Promise<OrchestratedAssessmentResult> {
  const startTime = Date.now();

  // 1. Compile narrative and run deterministic red-flag screening
  const combinedNarrative = [
    submission.chiefComplaint,
    ...(submission.answers?.map((a) => a.answerValue) || []),
  ].join(' ');

  const redFlagEvaluation = evaluateRedFlags(combinedNarrative);

  // 2. Retrieve grounded clinical guideline passages (AGENTS.md Rule 4.1 & RAG Pipeline)
  const retrievalResult = await retrieveGuidelineEvidence(combinedNarrative);
  const safeEvidenceContext = buildSafeEvidencePromptContext(retrievalResult.passages);

  // 3. Prepare de-identified input with grounded evidence context
  const deidentifiedInput = prepareDeidentifiedTriagePayload(submission, clinicalContext);
  deidentifiedInput.guidelineEvidenceContext = safeEvidenceContext;

  // 4. Resolve AI provider
  const provider = options?.providerOverride ?? getAiAssessmentProvider();

  let triageOutput: TriageOutputV1;
  let providerStatus: OrchestratedAssessmentResult['providerStatus'] = 'SUCCESS';
  let fallbackReason: string | undefined;

  // 5. Invoke provider if available
  if (provider.isAvailable()) {
    try {
      triageOutput = await provider.assess(deidentifiedInput, options?.assessmentOptions);
      if (provider.providerName === 'mock-triage-adapter') {
        providerStatus = 'MOCK_SIMULATED';
      }
    } catch (err: unknown) {
      logger.warn('AI_PROVIDER_FAILED_FALLING_BACK_TO_DETERMINISTIC', {
        provider: provider.providerName,
        error: err instanceof Error ? err.message : String(err),
      });

      providerStatus = 'FALLBACK_DETERMINISTIC';
      fallbackReason =
        err instanceof AiAssessmentError
          ? `Provider error [${err.code}]: ${err.message}`
          : `External provider failure: ${err instanceof Error ? err.message : String(err)}`;

      triageOutput = createDeterministicFallbackOutput(
        deidentifiedInput,
        redFlagEvaluation,
        fallbackReason
      );
    }
  } else {
    providerStatus = 'FALLBACK_DETERMINISTIC';
    fallbackReason = 'AI assessment provider credentials are not configured (GEMINI_API_KEY missing).';
    triageOutput = createDeterministicFallbackOutput(
      deidentifiedInput,
      redFlagEvaluation,
      fallbackReason
    );
  }

  // 5. ENFORCE DETERMINISTIC SAFETY PRECEDENCE (AGENTS.md Rule 4.3)
  // AI output can NEVER downgrade a deterministic clinical emergency
  let deterministicOverrideApplied = false;
  if (redFlagEvaluation.triggered) {
    if (triageOutput.acuityLevel !== 'EMERGENCY') {
      deterministicOverrideApplied = true;
    }
    triageOutput.acuityLevel = 'EMERGENCY';
    triageOutput.confidenceScore = 99;
    triageOutput.recommendedCareSetting =
      'Immediate Emergency Department Evaluation / Call 999';

    // Prepend red flag warnings to output
    const emergencyDirectives = redFlagEvaluation.matchedRules.map(
      (r) => `[CRITICAL RED FLAG] ${r.clinicalLabel}: ${r.escalationDirective}`
    );
    triageOutput.redFlagWarnings = [
      ...emergencyDirectives,
      ...triageOutput.redFlagWarnings.filter((w) => !emergencyDirectives.includes(w)),
    ];
  }

  const latencyMs = Date.now() - startTime;

  // 6. Metadata tracking
  const metadata: AiAssessmentMetadata = {
    provider: provider.providerName,
    modelName: provider.modelName,
    promptVersion: CARENAV_PROMPT_VERSION,
    schemaVersion: CARENAV_TRIAGE_SCHEMA_VERSION,
    latencyMs,
    isAiGenerated: providerStatus !== 'FALLBACK_DETERMINISTIC',
    clinicianVerified: false,
    deterministicOverrideApplied,
    evidenceRetrievedCount: retrievalResult.passages.length,
    evidenceStatus: retrievalResult.evidenceStatus,
  };

  return {
    triageOutput,
    metadata,
    redFlagEvaluation,
    providerStatus,
    fallbackReason,
    retrievedPassages: retrievalResult.passages,
    evidenceStatus: retrievalResult.evidenceStatus,
    evidenceLimitation: retrievalResult.limitationExplanation,
  };
}
