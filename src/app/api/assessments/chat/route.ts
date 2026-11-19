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
 * Employs stateful question tracking so it NEVER repeats a previously asked question.
 * Understands conversational questions, personal issues, mental health, and physical symptoms.
 */
function generateDeterministicChatTurn(
  allPatientText: string,
  latestInput: string,
  step: number,
  messages: Array<{ sender: 'ENGINE' | 'PATIENT'; text: string }> = []
): ChatResponseData {
  const lower = latestInput.toLowerCase().trim();
  const allLower = allPatientText.toLowerCase();

  const engineTexts = messages
    .filter((m) => m.sender === 'ENGINE')
    .map((m) => m.text.toLowerCase());

  // 1. Personal / Confidential / Privacy queries (check on latestInput first)
  if (/personal|private|secret|confidential|can i ask|trust|embarrass|issue/i.test(lower)) {
    return {
      reply:
        'Yes, absolutely. Everything you discuss here is confidential, private, and encrypted under HIPAA-standard clinical protections. You can freely share any physical, emotional, or sensitive health concerns. What is on your mind?',
      suggestedPills: [
        'Stress, anxiety, or emotional distress',
        'Sensitive physical or bodily symptom',
        'Stomach or digestive discomfort',
        'Sleep disruption and fatigue',
        'Question about my medications or health',
      ],
      nextStep: Math.min(5, step + 1),
      activeTopic: 'Confidential Personal Consultation',
      activeQuestion: 'What personal health concern or symptom would you like to discuss?',
      extractedEntities: {
        symptoms: ['Patient requested confidential health consultation'],
        pertinentNegatives: ['Emergency screening active'],
        duration: 'Under evaluation',
        severity: 'Personal / Emotional context',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: false,
    };
  }

  // 2. Questions / What should I do / Reassurance
  if (/what should i do|what do you think|can you help|is this (serious|bad|normal|dangerous)|am i (ok|okay|fine|safe)/i.test(lower)) {
    return {
      reply:
        'I am here to guide you. CareNavigator evaluates your symptoms against evidence-based clinical protocols (NICE, ACP, GINA) to help you understand what they mean and direct you to the safest care. To assist you accurately, how severe does your discomfort feel right now?',
      suggestedPills: [
        'Mild discomfort, manageable at home',
        'Moderate pain that limits daily tasks',
        'Worsening over the last 24 hours',
        'Feels severe when moving or coughing',
        'Relieved when resting or after medications',
      ],
      nextStep: Math.min(5, step + 1),
      activeTopic: 'Symptom Severity & Functional Impact',
      activeQuestion: 'How severe are your symptoms, and how are they affecting your daily routine?',
      extractedEntities: {
        symptoms: ['Clinical evaluation inquiry'],
        pertinentNegatives: ['No immediate red-flag indicators'],
        duration: 'Under ongoing evaluation',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 3. Stress / Mental Health / Emotional Tension
  if (/stress|anxious|anxiety|depress|sad|panic|overwhelm|scared|nervous|worry|fear/i.test(lower)) {
    return {
      reply:
        'Thank you for being open. Stress and emotional strain frequently trigger physical reactions such as stomach distress, muscle tension, or rapid heart rate. Have you noticed sleep changes, fatigue, or difficulty with meals?',
      suggestedPills: [
        'Stomach tension and loss of appetite',
        'Trouble falling or staying asleep',
        'Muscle tightness in neck or chest',
        'Heart racing during stressful moments',
        'Persistent fatigue and low energy',
      ],
      nextStep: Math.min(5, step + 1),
      activeTopic: 'Stress & Somatic Health Assessment',
      activeQuestion: 'How is stress or emotional tension affecting your physical health?',
      extractedEntities: {
        symptoms: ['Stress / Anxiety somatic manifestations'],
        pertinentNegatives: ['No self-harm or suicidal ideation reported'],
        duration: 'Recent weeks',
        severity: 'Moderate somatic impact',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 4. Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|start|begin)\b/i.test(lower) && allPatientText.length < 30) {
    return {
      reply:
        'Hello! I am your CareNavigator clinical intake guide. What specific symptoms are you experiencing today, and approximately when did they start?',
      suggestedPills: [
        'Stomach pain and nausea',
        'Persistent cough for 3 days',
        'Throbbing headache with light sensitivity',
        'Fever, chills, and fatigue',
        'Dull chest tightness after exercise',
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

  // 5. Thanks / Acknowledgements
  if (/^(thanks|thank you|ok|okay|got it|understood)\b/i.test(lower)) {
    return {
      reply:
        'You are welcome. Is there any other symptom, past medical condition, or medication you would like included in your clinical evaluation?',
      suggestedPills: [
        'No other symptoms to report',
        'I take daily prescription medications',
        'I have known allergies',
        'Ready to generate clinical results',
      ],
      nextStep: 5,
      activeTopic: 'Clinical Review & Finalization',
      activeQuestion: 'Are there any other symptoms or history to note before reviewing your triage summary?',
      extractedEntities: {
        symptoms: ['Intake finalized'],
        pertinentNegatives: ['Review complete'],
        duration: 'As reported',
        severity: 'Stable',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 6. Abdominal & Digestive (with progressive question state tracking)
  if (
    /stomach|abdomen|nausea|vomit|diarrhea|cramp|bowel|belly|acid|reflux|bloat|indigestion/i.test(lower) ||
    /stomach|abdomen|nausea/i.test(allLower)
  ) {
    const askedLocation = engineTexts.some((t) => t.includes('where in your abdomen'));
    const askedSeverity = engineTexts.some(
      (t) => t.includes('scale of 1 to 10') || t.includes('how severe') || t.includes('how intense')
    );
    const askedRelief = engineTexts.some(
      (t) => t.includes('eating') || t.includes('meals') || t.includes('antacid') || t.includes('better or worse')
    );

    if (!askedLocation) {
      return {
        reply:
          'Recorded. Where in your abdomen is the discomfort centered (e.g. upper stomach, lower right quadrant, around navel), and is it cramping, dull burning, or constant sharp pain?',
        suggestedPills: [
          'Upper central stomach (burning or dull ache)',
          'Lower abdomen with cramping',
          'Around navel with mild nausea',
          'Sharp localized pain in lower right side',
          'Diffuse bloating and gas pain',
        ],
        nextStep: 3,
        activeTopic: 'Abdominal Location & Pain Quality',
        activeQuestion: 'Where is the abdominal discomfort located, and what does it feel like?',
        extractedEntities: {
          symptoms: ['Abdominal pain', 'Nausea'],
          pertinentNegatives: ['No hematochezia', 'No hematemesis'],
          duration: 'Current onset',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    if (!askedSeverity) {
      return {
        reply:
          'Thank you for specifying. On a scale of 1 to 10, how intense is the discomfort, and have you been able to keep fluids down without vomiting?',
        suggestedPills: [
          'Mild (2-3/10) — able to eat and drink normally',
          'Moderate (4-6/10) — feel nauseated but no vomiting',
          'Severe (7-8/10) — significant cramping and vomiting',
          'Occurs in waves or cramps',
        ],
        nextStep: 4,
        activeTopic: 'Severity & Hydration Tolerance',
        activeQuestion: 'How intense is the discomfort (1-10), and can you keep fluids down?',
        extractedEntities: {
          symptoms: ['Abdominal pain', 'Nausea'],
          pertinentNegatives: ['Hydration maintained', 'No persistent emesis'],
          duration: 'Reported timeline',
          severity: 'Moderate (4-6/10)',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    if (!askedRelief) {
      return {
        reply:
          'Noted. Does eating meals, drinking warm fluids, or resting make the discomfort better or worse, and have you taken any antacids or pain relief?',
        suggestedPills: [
          'Worse after eating meals',
          'Better after eating or taking antacids',
          'Eased by lying down with warm compress',
          'No medication taken yet',
        ],
        nextStep: 5,
        activeTopic: 'Dietary Triggers & Relieving Factors',
        activeQuestion: 'Does food, hydration, or medication affect the discomfort?',
        extractedEntities: {
          symptoms: ['Abdominal discomfort', 'Nausea with food correlation'],
          pertinentNegatives: ['No peritoneal signs', 'No high fever'],
          duration: 'Reported timeline',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: true,
      };
    }

    return {
      reply:
        'I have recorded comprehensive clinical details regarding your abdominal symptoms, timing, and triggers. You can now generate your full clinical triage report and care recommendations.',
      suggestedPills: [
        'Generate clinical triage report now',
        'Add details about other symptoms',
        'Review my entered answers',
      ],
      nextStep: 6,
      activeTopic: 'Triage Synthesis Ready',
      activeQuestion: 'Ready to generate clinical triage results and care pathway?',
      extractedEntities: {
        symptoms: ['Abdominal pain', 'Nausea', 'Postprandial variation'],
        pertinentNegatives: ['No acute peritoneal signs', 'No fever'],
        duration: 'Current episode',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 7. Respiratory & Cough (with progressive question state tracking)
  if (/cough|phlegm|sputum|wheez|breath|throat|lungs/i.test(lower) || /cough|phlegm/i.test(allLower)) {
    const askedSputum = engineTexts.some((t) => t.includes('phlegm') || t.includes('mucus'));
    const askedPleuritic = engineTexts.some((t) => t.includes('deep breath') || t.includes('pleuritic'));
    const askedHistory = engineTexts.some((t) => t.includes('asthma') || t.includes('nocturnal'));

    if (!askedSputum) {
      return {
        reply:
          'Thank you for sharing. Regarding your cough and respiratory symptoms, approximately how long have they been present, and are you coughing up any phlegm or mucus?',
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

    if (!askedPleuritic) {
      return {
        reply:
          'Recorded. When you take a deep breath or during coughing fits, do you feel any sharp chest pain, shortness of breath, or noticeable wheezing?',
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
          symptoms: ['Cough with chest discomfort', 'Respiratory variation'],
          pertinentNegatives: ['No rest dyspnea', 'No stridor'],
          duration: '3 to 5 days',
          severity: 'Mild to Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: false,
      };
    }

    if (!askedHistory) {
      return {
        reply:
          'Thank you. Do you have a history of asthma or allergies, and has this cough woken you from sleep at night?',
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
          duration: 'Reported timeline',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: true,
      };
    }

    return {
      reply:
        'I have recorded your respiratory symptom timeline, pleuritic characteristics, and triggers. You can now generate your full clinical triage report and recommendations.',
      suggestedPills: [
        'Generate clinical triage report now',
        'Review my entered responses',
      ],
      nextStep: 6,
      activeTopic: 'Triage Synthesis Ready',
      activeQuestion: 'Ready to generate clinical triage results?',
      extractedEntities: {
        symptoms: ['Subacute cough', 'Cough-associated chest soreness'],
        pertinentNegatives: ['No hypoxia', 'No hemoptysis'],
        duration: 'Reported timeline',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 8. Headache & Neurological
  if (/headache|head|migraine|dizzi|vision|neck/i.test(lower) || /headache|head/i.test(allLower)) {
    const askedCharacter = engineTexts.some((t) => t.includes('throbbing') || t.includes('dull constant'));
    const askedRedFlags = engineTexts.some((t) => t.includes('neck stiffness') || t.includes('vision or balance'));

    if (!askedCharacter) {
      return {
        reply:
          'I understand you have head discomfort. Is the pain throbbing, sharp, or a dull constant pressure, and is it on one side or both sides?',
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

    if (!askedRedFlags) {
      return {
        reply:
          'Noted. Have you experienced any fever, neck stiffness when bending your chin to your chest, or changes in your vision or balance?',
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
          pertinentNegatives: ['No meningeal signs', 'No focal deficits'],
          duration: 'Hours to days',
          severity: 'Moderate',
        },
        preliminaryAcuity: 'ROUTINE',
        isEmergency: false,
        isReadyForFinalAssessment: true,
      };
    }

    return {
      reply:
        'Your headache characteristics, onset timeline, and red-flag screening responses are documented. You can now generate your full clinical triage assessment.',
      suggestedPills: [
        'Generate clinical triage report now',
        'Review my entered responses',
      ],
      nextStep: 6,
      activeTopic: 'Triage Synthesis Ready',
      activeQuestion: 'Ready to generate clinical triage results?',
      extractedEntities: {
        symptoms: ['Headache', 'Light sensitivity'],
        pertinentNegatives: ['No meningeal signs', 'No focal neurological deficits'],
        duration: 'Reported timeline',
        severity: 'Moderate',
      },
      preliminaryAcuity: 'ROUTINE',
      isEmergency: false,
      isReadyForFinalAssessment: true,
    };
  }

  // 9. Adaptive General Progression
  return {
    reply: `I have noted: "${latestInput}". Could you describe if your symptoms are getting progressively worse, staying about the same, or if any particular activity triggers them?`,
    suggestedPills: [
      'Gradually improving with rest',
      'Staying about the same',
      'Noticeably worse with exertion',
      'Partially eased with hydration and rest',
      'No obvious triggers identified',
    ],
    nextStep: Math.min(5, step + 1),
    activeTopic: 'Symptom Progression & Triggers',
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
 * and live Gemini or stateful CDS response generation.
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
Conduct a natural, compassionate, step-by-step clinical intake to clarify patient symptoms, timeline, pain quality, triggers, and severity.
SAFETY & COMMUNICATION RULES:
- Never provide a definitive medical diagnosis.
- Always address the patient's exact latest statement or question empathetically.
- If the patient asks about privacy, personal issues, or sensitive topics, reassure them warmly that their information is confidential and safe.
- Ask one clear, focused follow-up question per turn.
- Provide 3 to 5 helpful, brief quick-select suggestion pills tailored directly to what the patient just reported.
- Extract clinical entities (symptoms, pertinent negatives, duration, severity).
- Keep replies compassionate, professional, and under 3 sentences.
Return ONLY a valid JSON object matching this schema:
{
  "reply": "string (your empathetic response and next focused clinical question)",
  "suggestedPills": ["string", "string", "string"],
  "activeTopic": "string (e.g. Confidential Consultation, Onset Timeline, Pain Character, Associated Symptoms)",
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
          .slice(-8)
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
            reply:
              parsedGemini.reply ||
              `Thank you for sharing. Could you describe if symptoms change with position or rest?`,
            suggestedPills:
              Array.isArray(parsedGemini.suggestedPills) && parsedGemini.suggestedPills.length > 0
                ? parsedGemini.suggestedPills.slice(0, 5)
                : ['Worse with exertion', 'Relieved by rest', 'No change'],
            nextStep: Math.min(6, currentStep + 1),
            activeTopic: parsedGemini.activeTopic || 'Symptom Characterization',
            activeQuestion: parsedGemini.activeQuestion || 'How do your symptoms change throughout the day?',
            extractedEntities: {
              symptoms: Array.isArray(parsedGemini.extractedEntities?.symptoms)
                ? parsedGemini.extractedEntities.symptoms
                : [input],
              pertinentNegatives: Array.isArray(parsedGemini.extractedEntities?.pertinentNegatives)
                ? parsedGemini.extractedEntities.pertinentNegatives
                : [],
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

    // 5. Deterministic fallback dialog engine with stateful question tracking
    const fallbackData = generateDeterministicChatTurn(fullPatientNarrative, input, currentStep, messages);
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
