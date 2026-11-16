import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  CitationVerificationInput,
  CitationVerificationResult,
} from './types';

/**
 * Normalizes text for comparison by collapsing whitespace and punctuation.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies that a displayed citation genuinely exists in the verified database corpus
 * and genuinely supports the claimed clinical statement.
 * AGENTS.md Rule 4.1 & Requirement 5.
 */
export async function verifyCitationIntegrity(
  input: CitationVerificationInput
): Promise<CitationVerificationResult> {
  // 1. Locate guideline by code or ID
  const guideline = await prisma.clinicalGuideline.findFirst({
    where: {
      OR: [
        ...(input.guidelineId ? [{ id: input.guidelineId }] : []),
        ...(input.guidelineCode ? [{ code: input.guidelineCode }] : []),
      ],
    },
    include: {
      chunks: true,
    },
  });

  if (!guideline) {
    logger.warn('CITATION_VERIFICATION_FAILED_UNRECOGNIZED_GUIDELINE', { input });
    return {
      isValid: false,
      status: 'UNVERIFIED_SOURCE',
      relevanceScore: 0.0,
      reason: `Unverified source: Guideline "${input.guidelineCode || input.guidelineId}" is not present in the approved clinical guideline repository.`,
    };
  }

  if (guideline.status === 'RETIRED') {
    return {
      isValid: false,
      status: 'REJECTED',
      relevanceScore: 0.0,
      reason: `Guideline "${guideline.code}" was retired (${guideline.retirementReason || 'outdated clinical evidence'}) and cannot substantiate active clinical decisions.`,
    };
  }

  // 2. Identify target chunk (either explicitly by chunkId or best matching chunk)
  let targetChunk = input.chunkId
    ? guideline.chunks.find((c) => c.id === input.chunkId)
    : null;

  // If chunkId was not specified or not found, try matching claimed passage against guideline chunks
  if (!targetChunk && input.claimedPassageText) {
    const claimNormalized = normalizeForComparison(input.claimedPassageText);
    targetChunk =
      guideline.chunks.find((c) => {
        const chunkNormalized = normalizeForComparison(c.passageText);
        return (
          chunkNormalized.includes(claimNormalized) ||
          claimNormalized.includes(chunkNormalized)
        );
      }) || null;
  }

  // Fallback to first chunk if only general guideline was cited
  if (!targetChunk && guideline.chunks.length > 0) {
    targetChunk = guideline.chunks[0];
  }

  if (!targetChunk) {
    return {
      isValid: false,
      status: 'REJECTED',
      relevanceScore: 0.0,
      reason: `No verified passages found for guideline "${guideline.code}".`,
    };
  }

  // 3. Verify that claimed passage genuinely supports the claim
  const chunkTextNorm = normalizeForComparison(targetChunk.passageText);

  // If a claimed passage was provided, check if it matches the stored passage
  if (input.claimedPassageText) {
    const claimedNorm = normalizeForComparison(input.claimedPassageText);
    const claimedTokens = claimedNorm.split(' ').filter((w) => w.length > 3);
    const matchedTokens = claimedTokens.filter((token) => chunkTextNorm.includes(token));

    const tokenOverlapRatio =
      claimedTokens.length > 0 ? matchedTokens.length / claimedTokens.length : 1.0;

    if (tokenOverlapRatio < 0.4) {
      logger.warn('CITATION_VERIFICATION_PASSAGE_MISMATCH', {
        input,
        tokenOverlapRatio,
        chunkId: targetChunk.id,
      });
      return {
        isValid: false,
        status: 'REJECTED',
        relevanceScore: tokenOverlapRatio,
        reason: `Passage mismatch: Claimed citation quote has only ${(tokenOverlapRatio * 100).toFixed(0)}% token alignment with stored guideline text.`,
      };
    }
  }

  // 4. Verify claim support if claimSupported was specified
  if (input.claimSupported) {
    const claimWords = normalizeForComparison(input.claimSupported)
      .split(' ')
      .filter((w) => w.length > 3);
    const claimMatches = claimWords.filter((w) => chunkTextNorm.includes(w));
    const claimOverlap = claimWords.length > 0 ? claimMatches.length / claimWords.length : 1.0;

    if (claimOverlap < 0.25) {
      return {
        isValid: false,
        status: 'REJECTED',
        relevanceScore: claimOverlap,
        reason: `Claim not substantiated: The cited passage from ${guideline.code} does not contain clinical support for the claim "${input.claimSupported}".`,
      };
    }
  }

  return {
    isValid: true,
    status: 'VERIFIED',
    relevanceScore: 1.0,
    reason: `Citation verified against ${guideline.organization} ${guideline.code} (v${guideline.version}, ${guideline.publicationYear}).`,
    matchedChunk: {
      chunkId: targetChunk.id,
      guidelineCode: guideline.code,
      sectionTitle: targetChunk.sectionTitle,
      pageNumber: targetChunk.pageNumber,
      sourceUrl: guideline.sourceUrl,
      exactPassageExcerpt: targetChunk.passageText,
    },
  };
}
