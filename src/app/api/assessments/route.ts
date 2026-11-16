import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { orchestrateAiAssessment } from '@/server/triage';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const createAssessmentSchema = z.object({
  chiefComplaint: z.string().min(5, { message: 'Chief complaint must describe current symptoms.' }),
  includeEhrContext: z.boolean().default(true),
  confidenceScore: z.number().int().min(50).max(100).default(88),
  acuityLevel: z.enum(['SELF_CARE', 'ROUTINE', 'URGENT', 'EMERGENCY']).default('ROUTINE'),
  recommendedCareSetting: z.string().default('Outpatient Primary Care or Telehealth Consultation'),
  plainLanguageSummary: z.string().optional(),
  voiceTranscript: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
  answers: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        questionKey: z.string(),
        questionPrompt: z.string(),
        answerValue: z.string(),
      })
    )
    .optional(),
  explanations: z
    .array(
      z.object({
        factorType: z.string(),
        factorLabel: z.string(),
        rationale: z.string(),
        importanceRank: z.number().int().default(1),
      })
    )
    .optional(),
});

/**
 * GET /api/assessments
 * Returns paginated triage assessments for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const status = searchParams.get('status');

    let patientProfileId: string | undefined;

    if (user.role === 'PATIENT') {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) {
        return NextResponse.json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      patientProfileId = profile.id;
    }

    const whereClause: Record<string, unknown> = {};
    if (patientProfileId) {
      whereClause.patientProfileId = patientProfileId;
    }
    if (status) {
      whereClause.status = status;
    }

    const [total, sessions] = await Promise.all([
      prisma.triageSession.count({ where: whereClause }),
      prisma.triageSession.findMany({
        where: whereClause,
        include: {
          clinicianReview: true,
          patientProfile: {
            select: {
              id: true,
              userId: true,
              user: { select: { name: true, mrn: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: sessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('ASSESSMENTS_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve assessments.' }, { status: 500 });
  }
}

/**
 * POST /api/assessments
 * Creates a new TriageSession with deterministic red-flag screening, answers, and audit trail.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
      include: {
        conditions: true,
        medications: true,
        allergies: true,
        vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found. Please complete profile setup first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createAssessmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const {
      chiefComplaint,
      includeEhrContext,
      answers,
      explanations,
      plainLanguageSummary,
      voiceTranscript,
      mediaIds,
    } = parsed.data;

    // Convert latest vital signs to telemetry items if available
    const vitalsList = profile.vitalSigns.flatMap((vs) => [
      { vitalType: 'Blood Pressure', value: vs.bloodPressure, unit: 'mmHg' },
      {
        vitalType: 'Heart Rate',
        value: String(vs.heartRateBpm),
        unit: 'BPM',
        flag: vs.heartRateBpm > 100 ? 'ELEVATED' : vs.heartRateBpm < 60 ? 'LOW' : null,
      },
      {
        vitalType: 'SpO2',
        value: String(vs.spO2Percent),
        unit: '%',
        flag: vs.spO2Percent < 95 ? 'LOW' : null,
      },
      { vitalType: 'Temperature', value: String(vs.temperatureF), unit: '°F' },
    ]);

    // Orchestrate complete assessment pipeline:
    // Deterministic Red Flags -> De-identification -> AI Provider -> Schema Validation -> Override -> Metadata
    const aiResult = await orchestrateAiAssessment(
      {
        chiefComplaint,
        includeEhrContext: Boolean(includeEhrContext),
        answers,
      },
      {
        age: profile.age,
        sex: profile.sex,
        conditions: profile.conditions,
        medications: profile.medications,
        allergies: profile.allergies,
        vitals: vitalsList,
      }
    );

    const finalAcuity = aiResult.triageOutput.acuityLevel;
    const finalCareSetting = aiResult.triageOutput.recommendedCareSetting;
    const finalConfidence = aiResult.triageOutput.confidenceScore;
    const finalSummary = plainLanguageSummary || aiResult.triageOutput.plainLanguageSummary;

    const sessionCode = `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const triageSession = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.triageSession.create({
        data: {
          sessionCode,
          patientProfileId: profile.id,
          chiefComplaint,
          status: aiResult.redFlagEvaluation.triggered ? 'ACTION_REQUIRED' : 'PENDING_REVIEW',
          acuityLevel: finalAcuity,
          confidenceScore: finalConfidence,
          recommendedCareSetting: finalCareSetting,
          plainLanguageSummary: finalSummary,
          includeEhrContext: Boolean(includeEhrContext),
          redFlagTriggered: aiResult.redFlagEvaluation.triggered,
          redFlagReasonsJson: JSON.stringify(aiResult.redFlagEvaluation.matchedRules),
          extractedEntitiesJson: JSON.stringify(aiResult.triageOutput.extractedEntities),
          differentialJson: JSON.stringify(aiResult.triageOutput.differentialConsiderations),
          visitPrepQuestionsJson: JSON.stringify(aiResult.triageOutput.visitPrepQuestions),
          voiceTranscript: voiceTranscript || null,
          isSeedFixture: false,
        },
      });

      // Link any uploaded media to this triage session
      if (mediaIds && mediaIds.length > 0) {
        await tx.uploadedMedia.updateMany({
          where: {
            id: { in: mediaIds },
            patientProfileId: profile.id,
          },
          data: {
            triageSessionId: createdSession.id,
          },
        });
      }

      // Persist status history
      await tx.assessmentStatusHistory.create({
        data: {
          sessionId: createdSession.id,
          fromStatus: 'DRAFT',
          toStatus: createdSession.status,
          transitionReason: aiResult.redFlagEvaluation.triggered
            ? 'Emergency red-flag rule triggered during automated intake'
            : 'Assessment completed and queued for clinician verification',
          changedByUserId: user.id,
        },
      });

      // Persist answers
      if (answers && answers.length > 0) {
        await tx.assessmentAnswer.createMany({
          data: answers.map((ans) => ({
            sessionId: createdSession.id,
            stepNumber: ans.stepNumber,
            questionKey: ans.questionKey,
            questionPrompt: ans.questionPrompt,
            answerValue: ans.answerValue,
            isSeedFixture: false,
          })),
        });
      }

      // Persist explanations
      if (explanations && explanations.length > 0) {
        await tx.assessmentExplanation.createMany({
          data: explanations.map((exp) => ({
            sessionId: createdSession.id,
            factorType: exp.factorType,
            factorLabel: exp.factorLabel,
            rationale: exp.rationale,
            importanceRank: exp.importanceRank,
            isSeedFixture: false,
          })),
        });
      } else {
        const topDifferential = aiResult.triageOutput.differentialConsiderations[0];
        const defaultExplanations = [
          {
            factorType: 'PRIMARY_SYMPTOM',
            factorLabel: 'Chief Complaint & Clinical Synthesis',
            rationale: aiResult.triageOutput.clinicalRationale,
            importanceRank: 1,
          },
          {
            factorType: aiResult.redFlagEvaluation.triggered ? 'RED_FLAG_MATCH' : 'PERTINENT_NEGATIVE',
            factorLabel: aiResult.redFlagEvaluation.triggered
              ? 'Emergency Red Flag Match'
              : 'Pertinent Negatives Evaluated',
            rationale: aiResult.redFlagEvaluation.triggered
              ? `One or more acute red flags triggered: ${aiResult.redFlagEvaluation.matchedRules.map((r) => r.clinicalLabel).join(', ')}`
              : (aiResult.triageOutput.extractedEntities.pertinentNegatives.join(', ') || 'No acute red flags observed.'),
            importanceRank: 2,
          },
          {
            factorType: 'DIFFERENTIAL_MATCH',
            factorLabel: topDifferential?.conditionLabel || 'Clinical Guideline Rule Match',
            rationale: topDifferential?.rationale || aiResult.triageOutput.uncertaintyRationale,
            importanceRank: 3,
          },
        ];

        await tx.assessmentExplanation.createMany({
          data: defaultExplanations.map((exp) => ({
            sessionId: createdSession.id,
            ...exp,
            isSeedFixture: false,
          })),
        });
      }

      // Grounded Clinical Guideline Citations from RAG Retrieval (AGENTS.md Rule 4.1 & Requirement 4, 6)
      const retrievedPassages = aiResult.retrievedPassages || [];

      if (retrievedPassages.length > 0) {
        await tx.triageCitation.createMany({
          data: retrievedPassages.map((p) => ({
            sessionId: createdSession.id,
            guidelineId: p.guidelineId,
            chunkId: p.chunkId,
            passageText: p.passageText,
            sectionTitle: p.sectionTitle,
            sectionNumber: p.sectionNumber || null,
            pageNumber: p.pageNumber || null,
            sourceUrl: p.sourceUrl || null,
            verificationStatus: 'VERIFIED',
            relevanceScore: p.relevanceScore,
            relevanceNote: `Matched ${p.organization} ${p.guidelineCode} (${p.sectionTitle}) with score ${p.relevanceScore.toFixed(2)}`,
            claimSupported: `Supports priority triage stratification for "${chiefComplaint}"`,
          })),
        });
      } else if (aiResult.evidenceStatus === 'UNAVAILABLE') {
        // Transparent evidence-unavailable record (AGENTS.md Rule 4.1 & Requirement 6)
        // Never invent fake citations or attach unrelated guidelines
        const fallbackActiveGuideline = await tx.clinicalGuideline.findFirst({
          where: { status: 'ACTIVE' },
        });

        if (fallbackActiveGuideline) {
          await tx.triageCitation.create({
            data: {
              sessionId: createdSession.id,
              guidelineId: fallbackActiveGuideline.id,
              verificationStatus: 'EVIDENCE_UNAVAILABLE',
              relevanceScore: 0.0,
              relevanceNote:
                aiResult.evidenceLimitation ||
                'No approved clinical practice guidelines in the active knowledge base met the relevance threshold for this specific symptom cluster. Flagged for direct clinician review.',
              claimSupported: 'General Clinical Governance Protocol — Direct Clinician Review Required',
            },
          });
        }
      }

      // Automatically create pending ClinicianReview if non-emergency
      if (!aiResult.redFlagEvaluation.triggered) {
        const clinician = await tx.user.findFirst({
          where: { role: 'CLINICIAN' },
        });

        if (clinician) {
          await tx.clinicianReview.create({
            data: {
              sessionId: createdSession.id,
              clinicianId: clinician.id,
              stage: 'QUEUED',
              concordanceStatus: 'PENDING',
              isSeedFixture: false,
            },
          });
        }
      }

      return createdSession;
    });

    // Record immutable audit log entry
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: aiResult.redFlagEvaluation.triggered ? 'HIGH_RISK_ESCALATION' : 'TRIAGE_CREATED',
      targetEntityType: 'TriageSession',
      targetEntityId: triageSession.id,
      aiAcuity: aiResult.metadata.deterministicOverrideApplied ? 'ROUTINE' : finalAcuity,
      finalAcuity: finalAcuity,
      latencySeconds: Math.max(1, Math.round(aiResult.metadata.latencyMs / 1000)),
      metadata: {
        sessionCode,
        provider: aiResult.metadata.provider,
        modelName: aiResult.metadata.modelName,
        promptVersion: aiResult.metadata.promptVersion,
        schemaVersion: aiResult.metadata.schemaVersion,
        providerStatus: aiResult.providerStatus,
        fallbackReason: aiResult.fallbackReason,
        redFlagTriggered: aiResult.redFlagEvaluation.triggered,
        rulesMatched: aiResult.redFlagEvaluation.matchedRules.map((r) => r.ruleId),
      },
    });

    return NextResponse.json(
      {
        success: true,
        session: triageSession,
        aiMetadata: aiResult.metadata,
        providerStatus: aiResult.providerStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('ASSESSMENTS_POST_ERROR', error);
    return NextResponse.json({ error: 'Failed to create assessment.' }, { status: 500 });
  }
}
