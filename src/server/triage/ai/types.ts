import type { AcuityLevel } from '@/lib/design-tokens';
import type { RedFlagEvaluationResult } from '../red-flag-engine';

export type TriageMatchLikelihood = 'HIGH' | 'MODERATE' | 'LOW';

/**
 * Versioned schema identifier for audit trail and backward compatibility.
 */
export const CARENAV_TRIAGE_SCHEMA_VERSION = '1.0.0' as const;
export const CARENAV_PROMPT_VERSION = 'carenav-triage-v1.0' as const;

/**
 * De-identified, privacy-safe clinical input sent to AI assessment provider.
 * Follows AGENTS.md Rule 3.1 & HIPAA minimum necessary rule:
 * NO patient names, MRNs, emails, phone numbers, addresses, or identifiers.
 */
export interface DeidentifiedTriageInput {
  age?: number | null;
  sex?: string | null;
  chiefComplaint: string;
  structuredAnswers: Array<{
    stepNumber: number;
    questionKey: string;
    questionPrompt: string;
    answerValue: string;
  }>;
  vitalsTelemetry?: Array<{
    vitalType: string;
    value: string;
    unit: string;
    flag?: string | null;
  }>;
  relevantConditions?: string[];
  activeMedications?: string[];
  knownAllergies?: string[];
  includeEhrContext: boolean;
  guidelineEvidenceContext?: string;
}

/**
 * Structured, validated clinical output schema (Version 1.0.0).
 * Framed strictly as clinical decision support (non-diagnostic).
 */
export interface TriageOutputV1 {
  schemaVersion: typeof CARENAV_TRIAGE_SCHEMA_VERSION;
  acuityLevel: AcuityLevel;
  confidenceScore: number;
  uncertaintyRationale: string;
  recommendedCareSetting: string;
  plainLanguageSummary: string;
  clinicalRationale: string;
  differentialConsiderations: Array<{
    conditionLabel: string;
    matchLikelihood: TriageMatchLikelihood;
    rationale: string;
  }>;
  extractedEntities: {
    symptoms: string[];
    duration: string;
    pertinentNegatives: string[];
    severityLevel: string;
  };
  recommendedNextSteps: string[];
  visitPrepQuestions: string[];
  suggestedGuidelineCodes: string[];
  redFlagWarnings: string[];
  nonDiagnosticDisclaimer: string;
}

/**
 * Execution metadata tracked for compliance, latency, and audit logs.
 */
export interface AiAssessmentMetadata {
  provider: string;
  modelName: string;
  promptVersion: string;
  schemaVersion: typeof CARENAV_TRIAGE_SCHEMA_VERSION;
  latencyMs: number;
  isAiGenerated: boolean;
  clinicianVerified: boolean;
  deterministicOverrideApplied: boolean;
  evidenceRetrievedCount?: number;
  evidenceStatus?: 'AVAILABLE' | 'UNAVAILABLE';
}

/**
 * Complete result returned by the assessment orchestrator.
 */
export interface OrchestratedAssessmentResult {
  triageOutput: TriageOutputV1;
  metadata: AiAssessmentMetadata;
  redFlagEvaluation: RedFlagEvaluationResult;
  providerStatus: 'SUCCESS' | 'FALLBACK_DETERMINISTIC' | 'MOCK_SIMULATED';
  fallbackReason?: string;
  retrievedPassages?: import('../../guidelines/types').RetrievedPassage[];
  evidenceStatus?: import('../../guidelines/types').EvidenceStatus;
  evidenceLimitation?: string;
}

export interface AiAssessmentOptions {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * Base error class for AI assessment failures.
 */
export class AiAssessmentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AiAssessmentError';
  }
}

export class AiProviderUnavailableError extends AiAssessmentError {
  constructor(message = 'AI assessment provider credentials are not configured or available.') {
    super(message, 'PROVIDER_UNAVAILABLE', 503, false);
    this.name = 'AiProviderUnavailableError';
  }
}

export class AiProviderTimeoutError extends AiAssessmentError {
  constructor(timeoutMs: number) {
    super(`AI assessment provider timed out after ${timeoutMs}ms.`, 'PROVIDER_TIMEOUT', 504, true);
    this.name = 'AiProviderTimeoutError';
  }
}

export class AiProviderRateLimitError extends AiAssessmentError {
  constructor(message = 'AI assessment provider rate limit exceeded. Please retry shortly.') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
    this.name = 'AiProviderRateLimitError';
  }
}

export class AiProviderSchemaValidationError extends AiAssessmentError {
  constructor(message: string, public readonly validationErrors?: unknown) {
    super(
      `AI assessment output failed strict schema validation: ${message}`,
      'SCHEMA_VALIDATION_FAILED',
      502,
      false
    );
    this.name = 'AiProviderSchemaValidationError';
  }
}

export class AiProviderExecutionError extends AiAssessmentError {
  constructor(message: string, originalError?: unknown) {
    super(`AI assessment execution failed: ${message}`, 'PROVIDER_EXECUTION_ERROR', 502, true);
    this.name = 'AiProviderExecutionError';
    if (originalError && originalError instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}
