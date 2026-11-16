import type { AcuityLevel } from '@/lib/design-tokens';

export interface RedFlagRuleMatch {
  ruleId: string;
  protocolCategory:
    | 'ACUTE_CORONARY_SYNDROME'
    | 'SEVERE_RESPIRATORY_DISTRESS'
    | 'STROKE_FAST_NEUROLOGIC'
    | 'ANAPHYLAXIS_AIRWAY'
    | 'SEVERE_HEMORRHAGE_SHOCK'
    | 'PSYCHIATRIC_CRISIS_SELF_HARM';
  clinicalLabel: string;
  escalationDirective: string;
}

export interface RedFlagEvaluationResult {
  triggered: boolean;
  forcedAcuity: AcuityLevel | null;
  matchedRules: RedFlagRuleMatch[];
  screenedConditions: {
    label: string;
    status: 'CLEAR' | 'TRIGGERED';
  }[];
}

interface RedFlagPatternDefinition {
  ruleId: string;
  protocolCategory: RedFlagRuleMatch['protocolCategory'];
  clinicalLabel: string;
  patterns: RegExp[];
  escalationDirective: string;
}

const RED_FLAG_PROTOCOLS: RedFlagPatternDefinition[] = [
  {
    ruleId: 'RF-ACS-001',
    protocolCategory: 'ACUTE_CORONARY_SYNDROME',
    clinicalLabel: 'Acute Coronary Syndrome / Crushing Chest Pain',
    patterns: [
      /crushing\s+chest\s+(pain|pressure|tightness)/i,
      /chest\s+(pain|pressure|tightness).*(left\s+arm|jaw\s+pain|radiating|diaphoresis|cold\s+sweat)/i,
      /(left\s+arm|jaw)\s+radiation.*chest/i,
      /heart\s+attack/i,
    ],
    escalationDirective:
      'Immediate Emergency Department evaluation (Call 999). Do not drive yourself to the hospital.',
  },
  {
    ruleId: 'RF-RESP-002',
    protocolCategory: 'SEVERE_RESPIRATORY_DISTRESS',
    clinicalLabel: 'Severe Respiratory Distress / Hypoxia / Status Asthmaticus',
    patterns: [
      /cannot\s+speak\s+full\s+sentences/i,
      /gasping\s+for\s+air/i,
      /(blue|cyanotic)\s+(lips|fingernails|face)/i,
      /severe\s+shortness\s+of\s+breath\s+at\s+rest/i,
      /unable\s+to\s+breathe/i,
    ],
    escalationDirective:
      'Critical airway/respiratory compromise detected. Call 999 immediately for emergency oxygenation and stabilization.',
  },
  {
    ruleId: 'RF-STROKE-003',
    protocolCategory: 'STROKE_FAST_NEUROLOGIC',
    clinicalLabel: 'Acute Neurologic Deficit / Stroke (FAST Protocol)',
    patterns: [
      /facial\s+droop/i,
      /slurred\s+speech/i,
      /sudden\s+(weakness|numbness|paralysis)\s+on\s+(one|left|right)\s+side/i,
      /worst\s+headache\s+of\s+(my|their)\s+life/i,
      /thunderclap\s+headache/i,
    ],
    escalationDirective:
      'Time-critical neurological red flag (FAST Stroke Protocol). Call 999 immediately and note time of symptom onset.',
  },
  {
    ruleId: 'RF-ANAPH-004',
    protocolCategory: 'ANAPHYLAXIS_AIRWAY',
    clinicalLabel: 'Anaphylaxis / Acute Airway Angioedema',
    patterns: [
      /(throat|tongue|airway)\s+(swelling|closing)/i,
      /anaphylaxis/i,
      /anaphylactic/i,
      /hives.*(difficulty\s+breathing|wheezing|swallowing)/i,
    ],
    escalationDirective:
      'Administer epinephrine auto-injector (EpiPen) if prescribed and call 999 immediately.',
  },
  {
    ruleId: 'RF-HEMO-005',
    protocolCategory: 'SEVERE_HEMORRHAGE_SHOCK',
    clinicalLabel: 'Uncontrolled Hemorrhage / Hemodynamic Instability',
    patterns: [
      /uncontrolled\s+bleeding/i,
      /(coughing|vomiting)\s+up\s+blood/i,
      /(?<!(no|denies|without|negative for)\s+)hemoptysis/i,
      /(?<!(no|denies|without|negative for)\s+)hematemesis/i,
      /fainted.*chest\s+pain/i,
      /loss\s+of\s+consciousness/i,
    ],
    escalationDirective:
      'Apply direct pressure if external bleeding is present and call 999 for immediate emergency transport.',
  },
  {
    ruleId: 'RF-PSYCH-006',
    protocolCategory: 'PSYCHIATRIC_CRISIS_SELF_HARM',
    clinicalLabel: 'Acute Self-Harm or Suicidal Ideation',
    patterns: [
      /suicidal/i,
      /want\s+to\s+end\s+my\s+life/i,
      /thoughts\s+of\s+self[- ]harm/i,
      /kill\s+myself/i,
    ],
    escalationDirective:
      'Immediate crisis support required: Contact a local crisis-support professional or call 999 immediately.',
  },
];

/**
 * Deterministically evaluates patient symptom narratives and quick-symptom selections
 * against approved emergency clinical protocols (AGENTS.md Section 4.3).
 */
export function evaluateRedFlags(
  symptomText: string,
  selectedPills: string[] = []
): RedFlagEvaluationResult {
  const combinedNarrative = `${symptomText} ${selectedPills.join(' ')}`.trim();
  const matchedRules: RedFlagRuleMatch[] = [];

  for (const protocol of RED_FLAG_PROTOCOLS) {
    const isMatch = protocol.patterns.some((regex) => regex.test(combinedNarrative));
    if (isMatch) {
      matchedRules.push({
        ruleId: protocol.ruleId,
        protocolCategory: protocol.protocolCategory,
        clinicalLabel: protocol.clinicalLabel,
        escalationDirective: protocol.escalationDirective,
      });
    }
  }

  // Combination rule: Chest Tightness/Pain + Radiating Pain + Shortness of Breath
  const normalizedPills = selectedPills.map((p) => p.toLowerCase());
  const hasChestSymptom =
    normalizedPills.some((p) => p.includes('chest')) || /chest\s+(pain|pressure|tightness)/i.test(symptomText);
  const hasRadiation =
    normalizedPills.some((p) => p.includes('radiating')) || /radiating\s+pain/i.test(symptomText);
  const hasDyspnea =
    normalizedPills.some((p) => p.includes('shortness of breath')) || /shortness\s+of\s+breath/i.test(symptomText);

  if (
    hasChestSymptom &&
    hasRadiation &&
    hasDyspnea &&
    !matchedRules.some((r) => r.protocolCategory === 'ACUTE_CORONARY_SYNDROME')
  ) {
    matchedRules.push({
      ruleId: 'RF-ACS-COMBO',
      protocolCategory: 'ACUTE_CORONARY_SYNDROME',
      clinicalLabel: 'Acute Chest Pain + Radiation + Dyspnea Triad',
      escalationDirective:
        'High-risk cardiac symptom triad detected. Call 999 immediately for emergency evaluation.',
    });
  }

  const triggered = matchedRules.length > 0;

  return {
    triggered,
    forcedAcuity: triggered ? 'EMERGENCY' : null,
    matchedRules,
    screenedConditions: [
      {
        label: 'Acute Coronary Syndrome',
        status: matchedRules.some((m) => m.protocolCategory === 'ACUTE_CORONARY_SYNDROME')
          ? 'TRIGGERED'
          : 'CLEAR',
      },
      {
        label: 'Severe Respiratory Compromise',
        status: matchedRules.some((m) => m.protocolCategory === 'SEVERE_RESPIRATORY_DISTRESS')
          ? 'TRIGGERED'
          : 'CLEAR',
      },
      {
        label: 'Acute Neurologic / Stroke FAST',
        status: matchedRules.some((m) => m.protocolCategory === 'STROKE_FAST_NEUROLOGIC')
          ? 'TRIGGERED'
          : 'CLEAR',
      },
      {
        label: 'Anaphylaxis & Airway Compromise',
        status: matchedRules.some((m) => m.protocolCategory === 'ANAPHYLAXIS_AIRWAY')
          ? 'TRIGGERED'
          : 'CLEAR',
      },
    ],
  };
}
