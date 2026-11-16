import { GoogleGenAI } from '@google/genai';
import { isGeminiConfigured, env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  CARENAV_TRIAGE_SCHEMA_VERSION,
  type DeidentifiedTriageInput,
  type TriageOutputV1,
  type AiAssessmentOptions,
  AiAssessmentError,
  AiProviderUnavailableError,
  AiProviderTimeoutError,
  AiProviderRateLimitError,
  AiProviderSchemaValidationError,
  AiProviderExecutionError,
} from './types';
import { GEMINI_TRIAGE_RESPONSE_SCHEMA, validateTriageOutput } from './schema';
import { formatTriagePrompt } from './deidentifier';
import { callOllamaChat } from '@/server/ai/ollama-client';

export const CARENAV_SYSTEM_INSTRUCTION = `You are CareNavigator Clinical Decision Support Assistant, an AI system providing evidence-based healthcare triage evaluations for adult and adolescent patients.

CLINICAL & SAFETY GOVERNANCE RULES:
1. NON-DIAGNOSTIC FRAMING: You provide clinical triage guidance and differential considerations for clinician review. You NEVER assert a definitive medical diagnosis.
2. ACUITY DEFINITIONS:
   - "SELF_CARE": Mild, self-limiting symptoms safely managed at home with rest, hydration, or OTC remedies.
   - "ROUTINE": Subacute or chronic symptoms requiring non-urgent outpatient consultation (e.g., primary care visit within 3-7 days).
   - "URGENT": Acute or escalating symptoms requiring timely same-day or next-day in-person evaluation (urgent care or same-day clinic within 24 hours).
   - "EMERGENCY": Life-, limb-, or vision-threatening symptoms requiring immediate 999 dispatch or Emergency Department presentation.
3. UNCERTAINTY & TRANSPARENCY: Always quantify clinical uncertainty and explain what missing data (e.g. absent lab values, unmeasured vitals) limits confidence.
4. EVIDENCE GROUNDING: Reference recognized clinical management guidelines (e.g. GINA for asthma, ACP for chest pain, NICE for respiratory infections).
5. SAFETY ESCALATION: Explicitly highlight red-flag warning signs that mandate immediate emergency escalation.
6. EXPERIMENTAL MODEL LIMITATION: You are a developer model, not a medical device. Do not provide definitive diagnosis or treatment decisions; frame all output as uncertain decision support requiring clinician review.
7. Return your response strictly adhering to the requested CareNavigator JSON schema.`;

/**
 * Universal interface for AI assessment providers.
 */
export interface AiAssessmentProvider {
  readonly providerName: string;
  readonly modelName: string;
  assess(input: DeidentifiedTriageInput, options?: AiAssessmentOptions): Promise<TriageOutputV1>;
  isAvailable(): boolean;
}

/**
 * Production Gemini AI assessment adapter using the official @google/genai SDK.
 */
export class GeminiTriageProvider implements AiAssessmentProvider {
  public readonly providerName = 'google-gemini';
  public readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName?: string, apiKey?: string) {
    this.modelName = modelName || env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.apiKey = apiKey ?? env.GEMINI_API_KEY;
  }

  isAvailable(): boolean {
    return isGeminiConfigured({
      ...process.env,
      GEMINI_API_KEY: this.apiKey,
    });
  }

  async assess(
    input: DeidentifiedTriageInput,
    options?: AiAssessmentOptions
  ): Promise<TriageOutputV1> {
    if (!this.isAvailable()) {
      throw new AiProviderUnavailableError(
        'Gemini API key is not configured or is invalid. Set GEMINI_API_KEY in environment.'
      );
    }

    const timeoutMs = options?.timeoutMs ?? 15000;
    const prompt = formatTriagePrompt(input);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: CARENAV_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_TRIAGE_RESPONSE_SCHEMA,
          temperature: 0.2, // Low temperature for consistent clinical decision support
        },
      });

      clearTimeout(timer);

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new AiProviderSchemaValidationError('Model returned an empty text response.');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseErr) {
        throw new AiProviderSchemaValidationError(
          `Model output was not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      // Validate output strictly against Zod schema
      return validateTriageOutput(parsedJson);
    } catch (err: unknown) {
      clearTimeout(timer);

      if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new AiProviderTimeoutError(timeoutMs);
      }

      if (err instanceof AiAssessmentError) {
        throw err;
      }

      // Handle rate limits or quota errors
      const errString = String(err);
      if (errString.includes('429') || /quota|rate limit|resource exhausted/i.test(errString)) {
        throw new AiProviderRateLimitError();
      }

      logger.error('GEMINI_PROVIDER_ASSESSMENT_ERROR', { error: errString });
      throw new AiProviderExecutionError(
        err instanceof Error ? err.message : 'Unknown error during Gemini assessment generation',
        err
      );
    }
  }
}

/** Local MedGemma adapter. It sends only the already de-identified intake to Ollama. */
export class OllamaMedGemmaTriageProvider implements AiAssessmentProvider {
  public readonly providerName = 'ollama-medgemma';
  public readonly modelName: string;

  constructor(modelName = env.OLLAMA_MODEL) {
    this.modelName = modelName;
  }

  isAvailable(): boolean {
    return Boolean(this.modelName.trim() && env.OLLAMA_BASE_URL);
  }

  async assess(
    input: DeidentifiedTriageInput,
    options?: AiAssessmentOptions
  ): Promise<TriageOutputV1> {
    if (!this.isAvailable()) {
      throw new AiProviderUnavailableError('Ollama is not configured for local MedGemma inference.');
    }

    const content = await callOllamaChat({
      model: this.modelName,
      system: CARENAV_SYSTEM_INSTRUCTION,
      prompt: `${formatTriagePrompt(input)}\n\nReturn only a JSON object that follows the requested CareNavigator output fields. Do not include markdown fences.`,
      timeoutMs: options?.timeoutMs ?? env.OLLAMA_TIMEOUT_MS,
      signal: options?.abortSignal,
    });

    let output: unknown;
    try {
      output = JSON.parse(content);
    } catch {
      throw new AiProviderSchemaValidationError('Ollama returned text that was not valid JSON.');
    }
    try {
      return validateTriageOutput(output);
    } catch (error) {
      throw new AiProviderSchemaValidationError(
        error instanceof Error ? error.message : 'Output did not match the triage schema.'
      );
    }
  }
}

export type MockProviderBehavior =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SCHEMA_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAVAILABLE';

/**
 * Mock provider adapter for automated testing and offline development.
 */
export class MockTriageProvider implements AiAssessmentProvider {
  public readonly providerName = 'mock-triage-adapter';
  public readonly modelName = 'mock-clinical-v1';
  public behavior: MockProviderBehavior = 'SUCCESS';
  public customResponse?: Partial<TriageOutputV1>;
  public simulatedLatencyMs = 20;

  constructor(behavior: MockProviderBehavior = 'SUCCESS', customResponse?: Partial<TriageOutputV1>) {
    this.behavior = behavior;
    this.customResponse = customResponse;
  }

  isAvailable(): boolean {
    return this.behavior !== 'UNAVAILABLE';
  }

  async assess(
    input: DeidentifiedTriageInput,
    options?: AiAssessmentOptions
  ): Promise<TriageOutputV1> {
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    if (this.behavior === 'UNAVAILABLE') {
      throw new AiProviderUnavailableError('Simulated mock provider unavailable.');
    }

    if (this.behavior === 'TIMEOUT') {
      throw new AiProviderTimeoutError(options?.timeoutMs ?? 1000);
    }

    if (this.behavior === 'RATE_LIMIT') {
      throw new AiProviderRateLimitError('Simulated 429 quota exhaustion.');
    }

    if (this.behavior === 'NETWORK_ERROR') {
      throw new AiProviderExecutionError('Simulated network socket connection drop.');
    }

    if (this.behavior === 'SCHEMA_ERROR') {
      throw new AiProviderSchemaValidationError('Missing required field acuityLevel in mock payload.');
    }

    const defaultMock: TriageOutputV1 = {
      schemaVersion: CARENAV_TRIAGE_SCHEMA_VERSION,
      acuityLevel: 'ROUTINE',
      confidenceScore: 88,
      uncertaintyRationale:
        'Confidence is 88% due to clear respiratory symptom onset, but lack of auscultation and spirometry introduces moderate clinical uncertainty.',
      recommendedCareSetting: 'Outpatient Primary Care or Telehealth Consultation within 3-5 days',
      plainLanguageSummary: `Based on your reported ${input.chiefComplaint}, your symptoms appear consistent with a subacute respiratory tract irritation. A non-urgent medical evaluation is recommended.`,
      clinicalRationale:
        'Non-emergent subacute respiratory symptoms with normal wearable telemetry (if available) and absent acute red flags. Safe for outpatient evaluation.',
      differentialConsiderations: [
        {
          conditionLabel: 'Acute Bronchitis / Tracheobronchitis',
          matchLikelihood: 'HIGH',
          rationale: 'Persistent dry cough and mild chest tightness without acute hemodynamic compromise.',
        },
        {
          conditionLabel: 'Cough-Variant Asthma / Bronchospasm',
          matchLikelihood: 'MODERATE',
          rationale: 'Reported chest tightness with dry nocturnal coughing pattern.',
        },
        {
          conditionLabel: 'Upper Airway Cough Syndrome (Post-Nasal Drip)',
          matchLikelihood: 'LOW',
          rationale: 'Low-grade irritation without localized pleurisy.',
        },
      ],
      extractedEntities: {
        symptoms: [input.chiefComplaint, 'mild chest tightness', 'dry cough'],
        duration: '3 to 5 days',
        pertinentNegatives: ['No hemoptysis', 'No cyanosis', 'No high fever'],
        severityLevel: 'Mild to Moderate',
      },
      recommendedNextSteps: [
        'Schedule a primary care appointment or telehealth visit within 3-5 days.',
        'Maintain oral hydration and rest in a well-ventilated, humidified room.',
        'Monitor resting pulse and temperature twice daily.',
      ],
      visitPrepQuestions: [
        'Could these symptoms be related to cough-variant asthma or reactive airway disease?',
        'Would a short course of an inhaled bronchodilator be appropriate?',
        'At what point should I seek urgent care if the cough persists?',
      ],
      suggestedGuidelineCodes: ['GINA_2025', 'ACP_CHEST_PAIN', 'NICE_NG191'],
      redFlagWarnings: [
        'Sudden severe shortness of breath or inability to speak in full sentences',
        'Coughing up frank blood or dark clots',
        'Chest pain radiating to the left arm, neck, or jaw',
      ],
      nonDiagnosticDisclaimer:
        'This clinical evaluation is an automated decision-support suggestion and does NOT constitute a confirmed medical diagnosis. Always consult a licensed healthcare professional for clinical care.',
    };

    return {
      ...defaultMock,
      ...this.customResponse,
    };
  }
}

let activeProviderOverride: AiAssessmentProvider | null = null;

/**
 * Sets an active provider override (useful for unit and integration tests).
 */
export function setAiAssessmentProviderOverride(provider: AiAssessmentProvider | null): void {
  activeProviderOverride = provider;
}

/**
 * Resolves the configured AI assessment provider.
 */
export function getAiAssessmentProvider(): AiAssessmentProvider {
  if (activeProviderOverride) {
    return activeProviderOverride;
  }

  const configuredProvider = process.env.AI_ASSESSMENT_PROVIDER?.toLowerCase();
  if (configuredProvider === 'mock') {
    return new MockTriageProvider('SUCCESS');
  }
  if (configuredProvider === 'ollama') {
    return new OllamaMedGemmaTriageProvider();
  }

  return new GeminiTriageProvider();
}
