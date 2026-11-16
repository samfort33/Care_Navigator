import { RetrievedPassage } from './types';

export interface ClinicalExplanationResult {
  basisSummary: string;
  limitations: string[];
  patientActionGuidance: string;
}

/**
 * Generates an understandable, patient-facing explanation of the clinical basis
 * and limitations of retrieved guidelines.
 * AGENTS.md Rule 4.2 & Requirement 9.
 */
export function explainGuidelineBasisAndLimitations(
  chiefComplaint: string,
  passages: RetrievedPassage[],
  isEmergency: boolean
): ClinicalExplanationResult {
  if (!passages || passages.length === 0) {
    return {
      basisSummary: `Triage evaluation for "${chiefComplaint}" was conducted using deterministic clinical safety guardrails. No specific guideline passage met the relevance threshold in the current knowledge repository.`,
      limitations: [
        'Automated decision support only; does not replace examination by a physician or advanced practice provider.',
        'No direct physical exam or diagnostic tests (such as lab work or imaging) have been performed.',
        'Symptom trajectory can change rapidly; new or evolving red flags require immediate emergency care.',
      ],
      patientActionGuidance: isEmergency
        ? 'Seek immediate emergency medical attention or call 999.'
        : 'Consult a primary care clinician or schedule an outpatient visit for comprehensive clinical evaluation.',
    };
  }

  const primaryPassage = passages[0];
  const basisSummary = `This care recommendation is substantiated by ${primaryPassage.organization} (${primaryPassage.guidelineTitle} [${primaryPassage.guidelineCode}], ${primaryPassage.sectionTitle}), which defines standardized clinical protocols for evaluating "${chiefComplaint}". Specifically: "${primaryPassage.passageText.slice(0, 180)}..."`;

  const limitations = [
    `Clinical Scope: The ${primaryPassage.organization} guideline assumes in-person physiological verification (e.g. vital signs, auscultation, or laboratory diagnostics) that cannot be completed remotely.`,
    'Patient Specifics: Individual comorbidities, active medications, and genetic differences may modify appropriate therapy.',
    'Temporal Validity: Recommendations apply strictly to the symptoms reported during this intake session. Worsening shortness of breath, chest pressure, or syncope requires immediate emergency re-escalation.',
  ];

  const patientActionGuidance = isEmergency
    ? 'Call 999 or proceed to the nearest emergency department immediately.'
    : `Discuss these guideline-recommended considerations with your doctor during your consultation. Mention the relevant ${primaryPassage.organization} protocol (${primaryPassage.guidelineCode}) if helpful.`;

  return {
    basisSummary,
    limitations,
    patientActionGuidance,
  };
}
