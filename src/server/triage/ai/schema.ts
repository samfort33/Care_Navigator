import { z } from 'zod';
import { Type } from '@google/genai';
import { CARENAV_TRIAGE_SCHEMA_VERSION, type TriageOutputV1 } from './types';

/**
 * Zod validation schema for TriageOutputV1.
 * Enforces non-diagnostic clinical decision support boundaries (AGENTS.md Rule 4.2).
 */
export const triageOutputZodSchema = z.object({
  schemaVersion: z.literal(CARENAV_TRIAGE_SCHEMA_VERSION).default(CARENAV_TRIAGE_SCHEMA_VERSION),
  acuityLevel: z.enum(['SELF_CARE', 'ROUTINE', 'URGENT', 'EMERGENCY']),
  confidenceScore: z.number().int().min(1).max(100),
  uncertaintyRationale: z
    .string()
    .min(10, 'Uncertainty rationale must explain confidence level and data gaps.'),
  recommendedCareSetting: z.string().min(5),
  plainLanguageSummary: z.string().min(15),
  clinicalRationale: z.string().min(20),
  differentialConsiderations: z
    .array(
      z.object({
        conditionLabel: z.string().min(2),
        matchLikelihood: z.enum(['HIGH', 'MODERATE', 'LOW']),
        rationale: z.string().min(5),
      })
    )
    .min(1, 'At least one differential consideration must be provided.'),
  extractedEntities: z.object({
    symptoms: z.array(z.string()).min(1),
    duration: z.string().default('Not specified'),
    pertinentNegatives: z.array(z.string()).default([]),
    severityLevel: z.string().default('Moderate'),
  }),
  recommendedNextSteps: z.array(z.string()).min(1),
  visitPrepQuestions: z.array(z.string()).min(1),
  suggestedGuidelineCodes: z.array(z.string()).default([]),
  redFlagWarnings: z.array(z.string()).default([]),
  nonDiagnosticDisclaimer: z
    .string()
    .min(10)
    .default(
      'This clinical evaluation is an automated decision-support suggestion and does NOT constitute a confirmed medical diagnosis. Always consult a licensed healthcare professional for clinical care.'
    ),
});

/**
 * Validates untrusted model output against the versioned Zod schema.
 */
export function validateTriageOutput(rawOutput: unknown): TriageOutputV1 {
  const parsed = triageOutputZodSchema.safeParse(rawOutput);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `[${i.path.join('.') || 'root'}]: ${i.message}`)
      .join('; ');
    throw new Error(errorDetails);
  }
  return parsed.data as TriageOutputV1;
}

/**
 * Official Gemini responseSchema definition matching TriageOutputV1
 * for strict JSON output generation via @google/genai.
 */
export const GEMINI_TRIAGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: {
      type: Type.STRING,
      description: 'Version of the triage schema, always "1.0.0".',
    },
    acuityLevel: {
      type: Type.STRING,
      enum: ['SELF_CARE', 'ROUTINE', 'URGENT', 'EMERGENCY'],
      description:
        'Acuity rating: SELF_CARE (home care/OTC), ROUTINE (primary care in 3-7 days), URGENT (urgent care within 24h), EMERGENCY (ER / Call 999).',
    },
    confidenceScore: {
      type: Type.INTEGER,
      description: 'Clinical confidence score between 1 and 100 based on available data.',
    },
    uncertaintyRationale: {
      type: Type.STRING,
      description:
        'Explanation of factors driving clinical uncertainty, missing data, or why confidence is not 100%.',
    },
    recommendedCareSetting: {
      type: Type.STRING,
      description: 'Specific recommended medical setting and time frame for evaluation.',
    },
    plainLanguageSummary: {
      type: Type.STRING,
      description:
        'Empathetic, clear summary written at 6th-8th grade reading level for the patient explaining what the symptoms mean.',
    },
    clinicalRationale: {
      type: Type.STRING,
      description:
        'Detailed clinical reasoning for the triage tier and care setting, intended for physician review.',
    },
    differentialConsiderations: {
      type: Type.ARRAY,
      description:
        'List of potential clinical etiologies to consider (non-diagnostic differential).',
      items: {
        type: Type.OBJECT,
        properties: {
          conditionLabel: { type: Type.STRING },
          matchLikelihood: { type: Type.STRING, enum: ['HIGH', 'MODERATE', 'LOW'] },
          rationale: { type: Type.STRING },
        },
        required: ['conditionLabel', 'matchLikelihood', 'rationale'],
      },
    },
    extractedEntities: {
      type: Type.OBJECT,
      properties: {
        symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
        duration: { type: Type.STRING },
        pertinentNegatives: { type: Type.ARRAY, items: { type: Type.STRING } },
        severityLevel: { type: Type.STRING },
      },
      required: ['symptoms', 'duration', 'pertinentNegatives', 'severityLevel'],
    },
    recommendedNextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Actionable, safe next steps for the patient.',
    },
    visitPrepQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific questions the patient should ask their doctor at their visit.',
    },
    suggestedGuidelineCodes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Relevant guideline codes, e.g. ["GINA_2025", "ACP_CHEST_PAIN", "NICE_NG191", "AHA_ACC_HYPERTENSION"].',
    },
    redFlagWarnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific critical symptoms that should prompt immediate 999 / emergency care.',
    },
    nonDiagnosticDisclaimer: {
      type: Type.STRING,
      description: 'Required medical disclaimer confirming this is clinical decision support, not diagnosis.',
    },
  },
  required: [
    'schemaVersion',
    'acuityLevel',
    'confidenceScore',
    'uncertaintyRationale',
    'recommendedCareSetting',
    'plainLanguageSummary',
    'clinicalRationale',
    'differentialConsiderations',
    'extractedEntities',
    'recommendedNextSteps',
    'visitPrepQuestions',
    'nonDiagnosticDisclaimer',
  ],
};
