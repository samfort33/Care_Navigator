import { z } from 'zod';

export const GuidelineSectionInputSchema = z.object({
  sectionTitle: z.string().min(1, 'Section title is required'),
  sectionNumber: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  content: z.string().min(10, 'Section content must contain at least 10 characters'),
  keywords: z.array(z.string()).optional(),
});

export type GuidelineSectionInput = z.infer<typeof GuidelineSectionInputSchema>;

export const ApprovedGuidelineInputSchema = z.object({
  code: z
    .string()
    .min(3, 'Guideline code must be at least 3 characters')
    .regex(/^[A-Z0-9_\-]+$/, 'Guideline code must be alphanumeric with hyphens or underscores'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  organization: z.string().min(2, 'Organization is required'),
  publisher: z.string().optional(),
  version: z.string().default('1.0'),
  publicationYear: z.number().int().min(1990).max(2035),
  publicationDate: z.string().optional(),
  reviewDate: z.string().optional(),
  specialty: z.string().min(2, 'Specialty is required'),
  summary: z.string().min(20, 'Summary must be at least 20 characters'),
  keyRecommendations: z.string().min(20, 'Key recommendations must be at least 20 characters'),
  sourceReference: z.string().min(5, 'Source reference is required'),
  sourceUrl: z.string().url('Source URL must be a valid URL').optional(),
  keywords: z.string().min(2, 'Keywords are required (comma-separated)'),
  sections: z.array(GuidelineSectionInputSchema).min(1, 'Guideline must have at least one section'),
});

export type ApprovedGuidelineInput = z.infer<typeof ApprovedGuidelineInputSchema>;

export interface GuidelineChunkData {
  chunkIndex: number;
  sectionTitle: string;
  sectionNumber?: string;
  pageNumber?: number;
  passageText: string;
  keywords: string[];
  tokenCount: number;
}

export type EvidenceStatus = 'AVAILABLE' | 'UNAVAILABLE';

export interface RetrievedPassage {
  chunkId: string;
  guidelineId: string;
  guidelineCode: string;
  guidelineTitle: string;
  organization: string;
  publisher?: string | null;
  version: string;
  sectionTitle: string;
  sectionNumber?: string | null;
  pageNumber?: number | null;
  sourceUrl?: string | null;
  publicationYear: number;
  passageText: string;
  relevanceScore: number;
  matchedTerms: string[];
}

export interface RetrievalResult {
  evidenceStatus: EvidenceStatus;
  query: string;
  passages: RetrievedPassage[];
  limitationExplanation?: string;
  thresholdMet: boolean;
  minThreshold: number;
}

export type CitationVerificationStatus =
  | 'VERIFIED'
  | 'REJECTED'
  | 'UNVERIFIED_SOURCE'
  | 'EVIDENCE_UNAVAILABLE';

export interface CitationVerificationInput {
  guidelineId?: string;
  guidelineCode?: string;
  chunkId?: string;
  claimedPassageText?: string;
  claimSupported?: string;
}

export interface CitationVerificationResult {
  isValid: boolean;
  status: CitationVerificationStatus;
  relevanceScore: number;
  reason: string;
  matchedChunk?: {
    chunkId: string;
    guidelineCode: string;
    sectionTitle: string;
    pageNumber?: number | null;
    sourceUrl?: string | null;
    exactPassageExcerpt: string;
  };
}
