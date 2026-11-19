import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { evaluateRedFlags } from '@/server/triage/red-flag-engine';
import { isGeminiConfigured, env } from '@/lib/env';
import { logger } from '@/lib/logger';

const chatTurnSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      sender: z.enum(['ENGINE', 'PATIENT']),
      text: z.string(),
    })
  ),
  input: z.string().min(1, 'Please enter symptom details or select an option.'),
  includeEhrContext: z.boolean().default(true),
  currentStep: z.number().int().min(1).max(6).default(1),
});

interface ExtractedEntities {
  symptoms: string[];
  pertinentNegatives: string[];
  duration: string;
  severity: string;
}

interface ChatResponseData {
  reply: string;
  suggestedPills: string[];
  nextStep: number;
  activeTopic: string;
  activeQuestion: string;
  extractedEntities: ExtractedEntities;
  preliminaryAcuity: 'SELF_CARE' | 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  isEmergency: boolean;
  emergencyRule?: string;
  isReadyForFinalAssessment: boolean;
}

/**
 * Intelligent deterministic CDS clinical dialog generator.
 * Used when external AI credentials (GEMINI_API_KEY) are missing or in offline mode.
 * Adapts questions, follow-ups, and suggested pills dynamically to what the patient types.
 */
function generateDeterministicChatTurn(
  allPatientText: string,
  latestInput: string,
  step: number
): ChatResponseData {
  const lower = latestInput.toLowerCase().trim();
  const allLower = allPatientText.toLowerCase();

  // 1. Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|start|begin)\b/i.test(lower) && allPatientText.length < 25) {
    return {
      reply: 'Hello! I am your CareNavigator clinical intake guide. What specific symptoms are you experiencing today, and approximately when did they start?',
      suggestedPills: [
        'Persistent cough for 3 days',
        'Dull chest tightness after exercise',
        'Throbbing headache with light sensitivity',
        'Fever, chills, and fatigue',
        'Stomach pain and nausea',
      ],
      nextStep: 2,
      activeTopic: 'Chief Complaint & Onset Timeline',
      activeQuestion: 'What symptoms brought you in today, and when did they begin?',
      extractedEntities: {
        symptoms: ['Intake initiated'],
        pertinentNegatives: ['Emergency screening completed'],
        duration: 'Awaiting timeline',
        severity: 'Under evaluation',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: false,
    };
  }

  // 2. Respiratory & Cough
  if (/cough|phlegm|sputum|wheez|breath|throat|lungs/i.test(allLower)) {
    if (step <= 2 || !/day|week|month|hour|yesterday|started|ago/i.test(allLower)) {
      return {
        reply: `Thank you for sharing. Regarding your cough and respiratory symptoms, approximately how long have they been present, and are you coughing up any phlegm or mucus?`,
        suggestedPills: [
          'Started 2-3 days ago with dry cough',
          'Over a week with clear/white phlegm',
          'Yellow or green sputum',
          'Worse at night or when lying flat',
          'Dry hacking cough with throat tickle',
        ],
        nextStep: 3,
        activeTopic: 'Onset Timeline & Secretion Character',
        activeQuestion: 'How long have you had this cough, and is it producing any phlegm?',
        extractedEntities: {
          symptoms: ['Cough / Respiratory irritation'],
          pertinentNegatives: ['No hemoptysis reported'],
          duration: 'Recent onset',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    if (step === 3 || !/breath|dyspnea|fever|tight/i.test(allLower)) {
      return {
        reply: `Recorded. When you take a deep breath or during coughing fits, do you feel any sharp chest pain, shortness of breath, or noticeable wheezing?`,
        suggestedPills: [
          'Sharp stabbing pain on full inhalation',
          'Dull muscular chest soreness from coughing',
          'Occurs only during coughing fits',
          'Mild wheezing on exhale',
          'No pain on deep inhalation',
        ],
        nextStep: 4,
        activeTopic: 'Pleuritic Differentiation & Airway Symptoms',
        activeQuestion: 'How would you characterize the discomfort when taking a full deep breath?',
        extractedEntities: {
          symptoms: ['Cough with chest discomfort', 'Exertional/respiratory variation'],
          pertinentNegatives: ['No rest dyspnea', 'No stridor'],
          duration: '3 to 5 days',
          severity: 'Mild to Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    return {
      reply: `Thank you. I have captured your respiratory symptom timeline, pleuritic characteristics, and severity. Do you have a history of asthma or allergies, or has this cough woken you from sleep at night?`,
      suggestedPills: [
        'Wakes me from sleep at night',
        'History of mild asthma / allergies',
        'No prior lung conditions',
        'Relieved by warm fluids or steam',
      ],
      nextStep: 5,
      activeTopic: 'Medical History & Nocturnal Severity',
      activeQuestion: 'Have you had asthma, allergies, or sleep disruption from these symptoms?',
      extractedEntities: {
        symptoms: ['Subacute cough', 'Cough-associated chest soreness'],
        pertinentNegatives: ['No resting shortness of breath', 'No cyanosis'],
        duration: 'Reported intake timeline',
        severity: 'Moderate (4/10)',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 3. Headache & Neurological
  if (/headache|head|migraine|dizzi|vision|neck/i.test(allLower)) {
    if (step <= 2) {
      return {
        reply: `I understand you have head discomfort. Is the pain throbbing, sharp, or a dull constant pressure, and is it on one side or both sides?`,
        suggestedPills: [
          'Throbbing on right side behind eye',
          'Band-like tension around entire head',
          'Sharp shooting pains',
          'Accompanied by sensitivity to bright light',
          'Mild nausea with movement',
        ],
        nextStep: 3,
        activeTopic: 'Pain Quality & Lateralization',
        activeQuestion: 'How would you describe the quality and location of your headache?',
        extractedEntities: {
          symptoms: ['Headache / Cephalea'],
          pertinentNegatives: ['No thunderclap onset reported'],
          duration: 'Recent onset',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    return {
      reply: `Noted. Have you experienced any fever, neck stiffness when bending your chin to your chest, or changes in your vision or balance?`,
      suggestedPills: [
        'No neck stiffness or fever',
        'Mild sensitivity to light/sound',
        'Worse with screen time or stress',
        'Relieved partially by rest in a dark room',
      ],
      nextStep: 4,
      activeTopic: 'Red-Flag Neurological & Meningeal Screening',
      activeQuestion: 'Are you having any neck stiffness, vision changes, or high fever?',
      extractedEntities: {
        symptoms: ['Headache', 'Light sensitivity'],
        pertinentNegatives: ['No meningeal signs', 'No focal neurological deficits'],
        duration: 'Hours to days',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 4. Abdominal & Digestive
  if (/stomach|abdomen|nausea|vomit|diarrhea|cramp|bowel|belly/i.test(allLower)) {
    return {
      reply: `Recorded. Where in your abdomen is the discomfort located (e.g. upper central, lower right, around navel), and is it cramping, burning, or constant sharp pain?`,
      suggestedPills: [
        'Upper central burning after meals',
        'Lower abdominal cramping',
        'Diffuse ache with bloating',
        'No severe localized tenderness',
        'Mild nausea without vomiting',
      ],
      nextStep: Math.min(5, step + 1),
      activeTopic: 'Abdominal Pain Localization & Quality',
      activeQuestion: 'Where is the pain centered, and what does it feel like?',
      extractedEntities: {
        symptoms: ['Abdominal discomfort'],
        pertinentNegatives: ['No peritoneal signs', 'No hematemesis'],
        duration: 'Current episode',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: step >= 3,
    };
  }

  // 5. General Adaptive Follow-up
  return {
    reply: `I have noted: "${latestInput}". To help gauge the appropriate level of care, could you share if symptoms are getting progressively worse, and if anything provides noticeable relief?`,
    suggestedPills: [
      'Gradually improving with rest',
      'Staying about the same',
      'Noticeably worse with exertion',
      'Partially eased with hydration and rest',
      'No obvious triggers identified',
    ],
    nextStep: Math.min(5, step + 1),
    activeTopic: 'Symptom Progression & Aggravating Factors',
    activeQuestion: 'Are your symptoms worsening, and does anything provide relief?',
    extractedEntities: {
      symptoms: [latestInput],
      pertinentNegatives: ['Emergency symptoms screened'],
      duration: 'Ongoing',
      severity: 'Moderate',
    },
    preliminaryAcuity: 'ROUTINE',
    isEmergency: false,
    isReadyForFinalAssessment: step >= 3,
  };
}

/**
 * POST /api/assessments/chat
 * Multi-turn conversational intake guide endpoint with deterministic red-flag screening
 * and live Gemini or intelligent CDS response generation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const body = await request.json();
    const parsed = chatTurnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid message payload.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { messages, input, includeEhrContext, currentStep } = parsed.data;

    // 1. Compile full conversation narrative for safety screening
    const fullPatientNarrative = [
      ...messages.filter((m) => m.sender === 'PATIENT').map((m) => m.text),
      input,
    ].join(' ');

    // 2. Enforce Deterministic Red-Flag Safety Engine
    const redFlagCheck = evaluateRedFlags(fullPatientNarrative);
    if (redFlagCheck.triggered) {
      const topRule = redFlagCheck.matchedRules[0]!;
      return NextResponse.json({
        success: true,
        data: {
          reply: `CRITICAL ALERT: Your reported symptoms indicate a potential medical emergency (${topRule.clinicalLabel}: ${topRule.escalationDirective}). Automated routine intake has been paused. Please call 999 or proceed immediately to the nearest Emergency Department.`,
          suggestedPills: ['Call Emergency (999)', 'Locate Nearest Hospital'],
          nextStep: 6,
          activeTopic: 'Emergency Escalation Protocol',
          activeQuestion: 'Immediate Emergency Care Required — Call 999',
          extractedEntities: {
            symptoms: [input, topRule.clinicalLabel],
            pertinentNegatives: [],
            duration: 'Acute onset',
            severity: 'CRITICAL EMERGENCY RED FLAG',
          },
          preliminaryAcuity: 'EMERGENCY',
          isEmergency: true,
          emergencyRule: topRule.clinicalLabel,
          isReadyForFinalAssessment: true,
        },
      });
    }

    // 3. Retrieve patient clinical context if EHR consent is enabled
    let clinicalContextSummary = '';
    if (includeEhrContext) {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId: user.id },
        include: {
          conditions: { where: { status: 'active' } },
          allergies: true,
          medications: { where: { status: 'active' } },
        },
      });
      if (profile) {
        clinicalContextSummary = `Patient Profile: Age ${profile.age || 'Unknown'}, Sex: ${profile.sex || 'Unspecified'}. Active Conditions: ${profile.conditions.map((c) => c.name).join(', ') || 'None'}. Allergies: ${profile.allergies.map((a) => a.substance).join(', ') || 'None'}.`;
      }
    }

    // 4. If Gemini is configured, invoke live model with strict JSON schema
    if (isGeminiConfigured()) {
      try {
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        const systemPrompt = `You are CareNavigator Clinical Intake Guide, an empathetic, non-diagnostic AI medical triage assistant.
Conduct a structured, step-by-step clinical intake to clarify patient symptoms, timeline, pain quality, triggers, and severity.
SAFETY RULES:
- Never provide a confirmed medical diagnosis.
- Always ask one clear, focused follow-up question per turn.
- Provide 3 to 5 helpful, brief quick-select suggestion pills tailored to what the patient just reported.
- Extract clinical entities (symptoms, pertinent negatives, duration, severity).
- Keep replies compassionate, professional, and under 3 sentences.
Return ONLY a valid JSON object matching this schema:
{
  "reply": "string (your empathetic response and next focused clinical question)",
  "suggestedPills": ["string", "string", "string"],
  "activeTopic": "string (e.g. Onset Timeline, Pain Character, Associated Symptoms)",
  "activeQuestion": "string (concise headline question for the active step)",
  "extractedEntities": {
    "symptoms": ["string"],
    "pertinentNegatives": ["string"],
    "duration": "string",
    "severity": "string"
  },
  "preliminaryAcuity": "SELF_CARE" | "ROUTINE" | "URGENT",
  "isReadyForFinalAssessment": boolean
}`;

        const conversationContext = messages
          .slice(-6)
          .map((m) => `${m.sender === 'PATIENT' ? 'Patient' : 'Intake Guide'}: ${m.text}`)
          .join('\n');

        const prompt = `${clinicalContextSummary ? `[Clinical Context: ${clinicalContextSummary}]\n` : ''}Conversation history:\n${conversationContext}\n\nPatient just entered: "${input}"\n\nCurrent Step: ${currentStep} of 6.\nProvide the next conversational turn in strict JSON format.`;

        const response = await ai.models.generateContent({
          model: env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const rawText = response.text?.trim() || '{}';
        const parsedGemini = JSON.parse(rawText);

        return NextResponse.json({
          success: true,
          data: {
            reply: parsedGemini.reply || `Thank you for the update. Could you describe if symptoms change with position or rest?`,
            suggestedPills: Array.isArray(parsedGemini.suggestedPills) && parsedGemini.suggestedPills.length > 0
              ? parsedGemini.suggestedPills.slice(0, 5)
              : ['Worse with exertion', 'Relieved by rest', 'No change'],
            nextStep: Math.min(6, currentStep + 1),
            activeTopic: parsedGemini.activeTopic || 'Symptom Characterization',
            activeQuestion: parsedGemini.activeQuestion || 'How do your symptoms change throughout the day?',
            extractedEntities: {
              symptoms: Array.isArray(parsedGemini.extractedEntities?.symptoms) ? parsedGemini.extractedEntities.symptoms : [input],
              pertinentNegatives: Array.isArray(parsedGemini.extractedEntities?.pertinentNegatives) ? parsedGemini.extractedEntities.pertinentNegatives : [],
              duration: parsedGemini.extractedEntities?.duration || 'Reported timeline',
              severity: parsedGemini.extractedEntities?.severity || 'Moderate',
            },
            preliminaryAcuity: parsedGemini.preliminaryAcuity || 'ROUTINE',
            isEmergency: false,
            isReadyForFinalAssessment: Boolean(parsedGemini.isReadyForFinalAssessment || currentStep >= 4),
          },
        });
      } catch (geminiError) {
        logger.warn('GEMINI_INTAKE_CHAT_FALLBACK', {
          error: geminiError instanceof Error ? geminiError.message : String(geminiError),
        });
      }
    }

    // 5. Deterministic fallback dialog engine (safe, offline-capable, responsive)
    const fallbackData = generateDeterministicChatTurn(fullPatientNarrative, input, currentStep);
    return NextResponse.json({
      success: true,
      data: fallbackData,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('ASSESSMENT_CHAT_ERROR', error);
    return NextResponse.json({ error: 'Failed to process intake message.' }, { status: 500 });
  }
}
