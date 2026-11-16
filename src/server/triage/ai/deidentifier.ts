import type { DeidentifiedTriageInput } from './types';

export interface RawPatientClinicalContext {
  age?: number | null;
  sex?: string | null;
  conditions?: Array<{ name: string; status?: string }>;
  medications?: Array<{ name: string; dosage?: string; status?: string }>;
  allergies?: Array<{ substance?: string; allergen?: string; severity?: string }>;
  vitals?: Array<{
    vitalType: string;
    value: string;
    unit: string;
    flag?: string | null;
  }>;
}

export interface IntakeSubmissionData {
  chiefComplaint: string;
  includeEhrContext: boolean;
  answers?: Array<{
    stepNumber: number;
    questionKey: string;
    questionPrompt: string;
    answerValue: string;
  }>;
}

/**
 * Sanitizes and de-identifies patient input before sending to any external AI provider.
 * Follows AGENTS.md Rule 3.1 & Rule 3.3:
 * - Omits names, MRNs, addresses, emails, phone numbers, and IDs.
 * - Strictly respects the includeEhrContext consent toggle.
 */
export function prepareDeidentifiedTriagePayload(
  submission: IntakeSubmissionData,
  clinicalContext?: RawPatientClinicalContext | null
): DeidentifiedTriageInput {
  const includeEhr = Boolean(submission.includeEhrContext);

  const deidentified: DeidentifiedTriageInput = {
    age: clinicalContext?.age ?? null,
    sex: clinicalContext?.sex ?? null,
    chiefComplaint: submission.chiefComplaint.trim(),
    structuredAnswers: (submission.answers || []).map((ans) => ({
      stepNumber: ans.stepNumber,
      questionKey: ans.questionKey,
      questionPrompt: ans.questionPrompt,
      answerValue: ans.answerValue.trim(),
    })),
    includeEhrContext: includeEhr,
  };

  // Only include vitals if available
  if (clinicalContext?.vitals && clinicalContext.vitals.length > 0) {
    deidentified.vitalsTelemetry = clinicalContext.vitals.map((v) => ({
      vitalType: v.vitalType,
      value: v.value,
      unit: v.unit,
      flag: v.flag ?? null,
    }));
  }

  // Strictly enforce EHR consent: omit medical history if consent toggle is false
  if (includeEhr && clinicalContext) {
    if (clinicalContext.conditions && clinicalContext.conditions.length > 0) {
      deidentified.relevantConditions = clinicalContext.conditions
        .filter((c) => !c.status || c.status.toLowerCase() === 'active')
        .map((c) => c.name);
    }

    if (clinicalContext.medications && clinicalContext.medications.length > 0) {
      deidentified.activeMedications = clinicalContext.medications
        .filter((m) => !m.status || m.status.toLowerCase() === 'active')
        .map((m) => (m.dosage ? `${m.name} (${m.dosage})` : m.name));
    }

    if (clinicalContext.allergies && clinicalContext.allergies.length > 0) {
      deidentified.knownAllergies = clinicalContext.allergies.map((a) => {
        const allergenName = a.substance || a.allergen || 'Unknown allergen';
        return a.severity ? `${allergenName} [Severity: ${a.severity}]` : allergenName;
      });
    }
  }

  return deidentified;
}

/**
 * Formats de-identified clinical input into a prompt for clinical decision support.
 */
export function formatTriagePrompt(input: DeidentifiedTriageInput): string {
  const lines: string[] = [];

  lines.push('### PATIENT CLINICAL INTAKE (DE-IDENTIFIED)');
  lines.push(`Chief Complaint: "${input.chiefComplaint}"`);

  if (input.age !== undefined && input.age !== null) {
    lines.push(`Patient Demographics: Age ${input.age}, Biological Sex: ${input.sex || 'Unspecified'}`);
  }

  if (input.structuredAnswers && input.structuredAnswers.length > 0) {
    lines.push('\n### STRUCTURED INTAKE QUESTION RESPONSES:');
    for (const ans of input.structuredAnswers) {
      lines.push(`- Step ${ans.stepNumber} [${ans.questionPrompt}]: ${ans.answerValue}`);
    }
  }

  if (input.vitalsTelemetry && input.vitalsTelemetry.length > 0) {
    lines.push('\n### RECORDED VITALS TELEMETRY:');
    for (const v of input.vitalsTelemetry) {
      lines.push(`- ${v.vitalType}: ${v.value} ${v.unit}${v.flag ? ` [FLAG: ${v.flag}]` : ''}`);
    }
  }

  if (input.includeEhrContext) {
    lines.push('\n### APPROVED LONGITUDINAL HEALTH CONTEXT (PATIENT CONSENTED):');
    if (input.relevantConditions && input.relevantConditions.length > 0) {
      lines.push(`- Active Conditions: ${input.relevantConditions.join(', ')}`);
    } else {
      lines.push('- Active Conditions: None documented');
    }

    if (input.activeMedications && input.activeMedications.length > 0) {
      lines.push(`- Current Medications: ${input.activeMedications.join(', ')}`);
    } else {
      lines.push('- Current Medications: None documented');
    }

    if (input.knownAllergies && input.knownAllergies.length > 0) {
      lines.push(`- Documented Allergies: ${input.knownAllergies.join(', ')}`);
    } else {
      lines.push('- Documented Allergies: No known allergies');
    }
  } else {
    lines.push('\n### HEALTH CONTEXT NOTE:');
    lines.push('Patient opted out of sharing longitudinal EHR context for this evaluation.');
  }

  if (input.guidelineEvidenceContext) {
    lines.push('\n### RETRIEVED CLINICAL GUIDELINE PASSAGES (GROUNDING EVIDENCE):');
    lines.push(input.guidelineEvidenceContext);
  }

  lines.push('\n### CLINICAL INSTRUCTION:');
  lines.push(
    'Synthesize the above clinical intake data against the retrieved evidence and standard clinical triage protocols (GINA, NICE, ACP, AHA/ACC). Return a strictly validated JSON response adhering to CARENAV_TRIAGE_SCHEMA_VERSION 1.0.0. Provide non-diagnostic differential considerations, explicit uncertainty rationale, and practical next steps.'
  );

  return lines.join('\n');
}
