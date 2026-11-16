import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RetrievedPassage, RetrievalResult } from './types';
import { sanitizePassageText } from './sanitizer';

export const MIN_RELEVANCE_THRESHOLD = 0.25;

// Weight multipliers for clinical domain tokens
const CLINICAL_TERM_WEIGHTS: Record<string, number> = {
  // Respiratory
  asthma: 2.5,
  wheezing: 2.5,
  dyspnea: 2.2,
  cough: 2.0,
  saba: 2.2,
  albuterol: 2.2,
  inhaler: 2.0,
  bronchospasm: 2.5,
  spo2: 2.5,
  oximetry: 2.2,
  hypoxia: 2.5,
  respiratory: 2.0,
  stridor: 2.8,

  // Cardiac
  chest: 2.0,
  pain: 1.8,
  substernal: 2.5,
  pleuritic: 2.2,
  ecg: 2.5,
  ischemia: 2.8,
  infarction: 2.8,
  cardiac: 2.2,
  angina: 2.8,
  hypertension: 2.2,
  troponin: 2.8,

  // General / Infectious
  fever: 2.0,
  pyrexia: 2.0,
  hypotension: 2.5,
  anaphylaxis: 3.0,
  sepsis: 3.0,
  diabetes: 2.2,
  hyperglycemia: 2.5,
  ketoacidosis: 3.0,
};

/**
 * Tokenizes a query string into lowercase, normalized search tokens.
 */
function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Computes BM25/TF-IDF-style keyword score between query tokens and passage text,
 * incorporating clinical term weighting and section boosts.
 */
function scorePassage(
  queryTokens: string[],
  passageText: string,
  sectionTitle: string,
  guidelineKeywords: string[],
  guidelineTitle: string
): { score: number; matchedTerms: string[] } {
  const textLower = passageText.toLowerCase();
  const sectionLower = sectionTitle.toLowerCase();
  const titleLower = guidelineTitle.toLowerCase();
  const keywordsSet = new Set(guidelineKeywords.map((k) => k.toLowerCase()));

  let totalScore = 0;
  const matchedTerms: string[] = [];

  const uniqueQueryTokens = Array.from(new Set(queryTokens));

  for (const token of uniqueQueryTokens) {
    let tokenScore = 0;
    const clinicalWeight = CLINICAL_TERM_WEIGHTS[token] || 1.0;

    // Direct match in passage content
    const occurrences = (textLower.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
    if (occurrences > 0) {
      tokenScore += Math.min(occurrences, 4) * 0.15 * clinicalWeight;
      matchedTerms.push(token);
    }

    // Boost if token appears in section title
    if (sectionLower.includes(token)) {
      tokenScore += 0.25 * clinicalWeight;
      if (!matchedTerms.includes(token)) matchedTerms.push(token);
    }

    // Boost if token appears in guideline title or keywords
    if (titleLower.includes(token) || keywordsSet.has(token)) {
      tokenScore += 0.20 * clinicalWeight;
      if (!matchedTerms.includes(token)) matchedTerms.push(token);
    }

    totalScore += tokenScore;
  }

  // Normalize score between 0.0 and 1.0 based on query length and expected saturation
  const normalizedScore = Math.min(1.0, totalScore / (uniqueQueryTokens.length * 0.6 + 0.4));

  return {
    score: Number(normalizedScore.toFixed(3)),
    matchedTerms,
  };
}

export interface RetrievalOptions {
  topK?: number;
  minThreshold?: number;
  includeRetired?: boolean;
  specialtyFilter?: string;
}

/**
 * Retrieves relevant, passage-level clinical guideline chunks from active corpus.
 * If no approved guidelines pass the relevance threshold, returns EVIDENCE_UNAVAILABLE
 * rather than fabricating citations (AGENTS.md Rule 4.1 & Requirement 6).
 */
export async function retrieveGuidelineEvidence(
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const topK = options?.topK ?? 3;
  const minThreshold = options?.minThreshold ?? MIN_RELEVANCE_THRESHOLD;
  const includeRetired = options?.includeRetired ?? false;

  const queryTokens = tokenizeQuery(query);

  if (queryTokens.length === 0) {
    return {
      evidenceStatus: 'UNAVAILABLE',
      query,
      passages: [],
      thresholdMet: false,
      minThreshold,
      limitationExplanation: 'Empty or insufficient symptom query provided for clinical guideline retrieval.',
    };
  }

  // Fetch candidate chunks linked to active guidelines
  const activeGuidelinesWithChunks = await prisma.clinicalGuideline.findMany({
    where: {
      ...(includeRetired ? {} : { status: 'ACTIVE' }),
      ...(options?.specialtyFilter ? { specialty: { contains: options.specialtyFilter } } : {}),
    },
    include: {
      chunks: true,
    },
  });

  const scoredPassages: RetrievedPassage[] = [];

  for (const guideline of activeGuidelinesWithChunks) {
    const guidelineKeywords = guideline.keywords.split(',').map((k) => k.trim());

    for (const chunk of guideline.chunks) {
      const { score, matchedTerms } = scorePassage(
        queryTokens,
        chunk.passageText,
        chunk.sectionTitle,
        guidelineKeywords,
        guideline.title
      );

      if (score >= minThreshold) {
        scoredPassages.push({
          chunkId: chunk.id,
          guidelineId: guideline.id,
          guidelineCode: guideline.code,
          guidelineTitle: guideline.title,
          organization: guideline.organization,
          publisher: guideline.publisher,
          version: guideline.version,
          sectionTitle: chunk.sectionTitle,
          sectionNumber: chunk.sectionNumber,
          pageNumber: chunk.pageNumber,
          sourceUrl: guideline.sourceUrl,
          publicationYear: guideline.publicationYear,
          passageText: sanitizePassageText(chunk.passageText),
          relevanceScore: score,
          matchedTerms,
        });
      }
    }
  }

  // Sort descending by relevance score
  scoredPassages.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const topPassages = scoredPassages.slice(0, topK);

  // Requirement 6: If relevant evidence is unavailable, state that limitation rather than inventing a source
  if (topPassages.length === 0) {
    logger.info('GUIDELINE_RETRIEVAL_NO_EVIDENCE_FOUND', {
      query,
      tokens: queryTokens,
      minThreshold,
    });

    return {
      evidenceStatus: 'UNAVAILABLE',
      query,
      passages: [],
      thresholdMet: false,
      minThreshold,
      limitationExplanation:
        'No validated clinical practice guidelines in the active knowledge base met the required relevance threshold for this specific symptom cluster. In accordance with clinical governance, no synthetic or unverified citations have been generated; direct clinical review is required.',
    };
  }

  return {
    evidenceStatus: 'AVAILABLE',
    query,
    passages: topPassages,
    thresholdMet: true,
    minThreshold,
  };
}
