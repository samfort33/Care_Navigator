import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { recordAuditLog } from '@/server/audit/audit-logger';
import {
  ApprovedGuidelineInput,
  ApprovedGuidelineInputSchema,
} from './types';
import { chunkGuidelineSections } from './chunker';

export interface IngestionOptions {
  actorUserId?: string;
  isSeedFixture?: boolean;
}

/**
 * Ingests an approved clinical guideline document into persistent storage.
 * Chunks sections, extracts metadata (publisher, version, dates, pages, URLs),
 * and creates searchable passage records.
 * AGENTS.md Rule 4.1 & Requirement 1, 2, 8.
 */
export async function ingestApprovedGuideline(
  rawInput: unknown,
  options?: IngestionOptions
) {
  const validated = ApprovedGuidelineInputSchema.parse(rawInput);
  const chunks = chunkGuidelineSections(validated.sections);

  const guideline = await prisma.$transaction(async (tx) => {
    // Upsert guideline root record
    const record = await tx.clinicalGuideline.upsert({
      where: { code: validated.code },
      update: {
        title: validated.title,
        organization: validated.organization,
        publisher: validated.publisher || validated.organization,
        version: validated.version,
        status: 'ACTIVE',
        publicationYear: validated.publicationYear,
        publicationDate: validated.publicationDate,
        reviewDate: validated.reviewDate,
        specialty: validated.specialty,
        summary: validated.summary,
        keyRecommendations: validated.keyRecommendations,
        sourceReference: validated.sourceReference,
        sourceUrl: validated.sourceUrl,
        keywords: validated.keywords,
        isSeedFixture: options?.isSeedFixture ?? false,
      },
      create: {
        code: validated.code,
        title: validated.title,
        organization: validated.organization,
        publisher: validated.publisher || validated.organization,
        version: validated.version,
        status: 'ACTIVE',
        publicationYear: validated.publicationYear,
        publicationDate: validated.publicationDate,
        reviewDate: validated.reviewDate,
        specialty: validated.specialty,
        summary: validated.summary,
        keyRecommendations: validated.keyRecommendations,
        sourceReference: validated.sourceReference,
        sourceUrl: validated.sourceUrl,
        keywords: validated.keywords,
        isSeedFixture: options?.isSeedFixture ?? false,
      },
    });

    // Delete existing chunks for this guideline if re-ingesting
    await tx.guidelineChunk.deleteMany({
      where: { guidelineId: record.id },
    });

    // Bulk create chunks
    if (chunks.length > 0) {
      await tx.guidelineChunk.createMany({
        data: chunks.map((c) => ({
          guidelineId: record.id,
          chunkIndex: c.chunkIndex,
          sectionTitle: c.sectionTitle,
          sectionNumber: c.sectionNumber || null,
          pageNumber: c.pageNumber || null,
          passageText: c.passageText,
          keywordsJson: JSON.stringify(c.keywords),
          tokenCount: c.tokenCount,
        })),
      });
    }

    return record;
  });

  logger.info('CLINICAL_GUIDELINE_INGESTED', {
    code: guideline.code,
    version: guideline.version,
    chunksCreated: chunks.length,
    organization: guideline.organization,
  });

  if (options?.actorUserId) {
    await recordAuditLog({
      actorUserId: options.actorUserId,
      actorRole: 'ADMIN',
      actionType: 'GUIDELINE_INGESTED',
      targetEntityType: 'ClinicalGuideline',
      targetEntityId: guideline.id,
      metadata: {
        code: guideline.code,
        version: guideline.version,
        chunksCount: chunks.length,
        organization: guideline.organization,
      },
    });
  }

  return {
    guideline,
    chunksCount: chunks.length,
  };
}

/**
 * Retires an outdated clinical guideline so it is excluded from future AI retrieval.
 * AGENTS.md Rule 4.1 & Requirement 8.
 */
export async function retireGuideline(
  code: string,
  retirementReason: string,
  actorUserId?: string
) {
  const existing = await prisma.clinicalGuideline.findUnique({
    where: { code },
  });

  if (!existing) {
    throw new Error(`Clinical guideline with code "${code}" not found.`);
  }

  const updated = await prisma.clinicalGuideline.update({
    where: { code },
    data: {
      status: 'RETIRED',
      retirementReason,
    },
  });

  logger.info('CLINICAL_GUIDELINE_RETIRED', {
    code,
    reason: retirementReason,
    actorUserId,
  });

  if (actorUserId) {
    await recordAuditLog({
      actorUserId,
      actorRole: 'ADMIN',
      actionType: 'GUIDELINE_RETIRED',
      targetEntityType: 'ClinicalGuideline',
      targetEntityId: updated.id,
      metadata: {
        code,
        reason: retirementReason,
      },
    });
  }

  return updated;
}

/**
 * Supersedes an older guideline version with a newer edition.
 * The old guideline is marked as SUPERSEDED with a reference to the replacement.
 * Requirement 8.
 */
export async function supersedeGuideline(
  oldCode: string,
  newGuidelineData: ApprovedGuidelineInput,
  actorUserId?: string
) {
  const oldGuideline = await prisma.clinicalGuideline.findUnique({
    where: { code: oldCode },
  });

  if (!oldGuideline) {
    throw new Error(`Original guideline "${oldCode}" not found.`);
  }

  // Ingest new guideline
  const ingestionResult = await ingestApprovedGuideline(newGuidelineData, {
    actorUserId,
    isSeedFixture: false,
  });

  // Mark old guideline as SUPERSEDED
  await prisma.clinicalGuideline.update({
    where: { code: oldCode },
    data: {
      status: 'SUPERSEDED',
      supersededById: ingestionResult.guideline.id,
      retirementReason: `Superseded by updated guideline "${newGuidelineData.code}" (v${newGuidelineData.version})`,
    },
  });

  logger.info('CLINICAL_GUIDELINE_SUPERSEDED', {
    oldCode,
    newCode: newGuidelineData.code,
    newVersion: newGuidelineData.version,
    actorUserId,
  });

  if (actorUserId) {
    await recordAuditLog({
      actorUserId,
      actorRole: 'ADMIN',
      actionType: 'GUIDELINE_SUPERSEDED',
      targetEntityType: 'ClinicalGuideline',
      targetEntityId: oldGuideline.id,
      metadata: {
        oldCode,
        newCode: newGuidelineData.code,
        replacementId: ingestionResult.guideline.id,
      },
    });
  }

  return {
    oldGuidelineCode: oldCode,
    newGuideline: ingestionResult.guideline,
    chunksCount: ingestionResult.chunksCount,
  };
}

/**
 * Lists active guidelines, with optional status/specialty filtering.
 */
export async function listGuidelines(options?: {
  status?: 'ACTIVE' | 'RETIRED' | 'SUPERSEDED';
  specialty?: string;
}) {
  return prisma.clinicalGuideline.findMany({
    where: {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.specialty ? { specialty: { contains: options.specialty } } : {}),
    },
    orderBy: { publicationYear: 'desc' },
    include: {
      _count: {
        select: { chunks: true, citations: true },
      },
    },
  });
}
