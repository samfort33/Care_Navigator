import { GuidelineSectionInput, GuidelineChunkData } from './types';
import { sanitizePassageText } from './sanitizer';

const TARGET_CHUNK_WORD_LIMIT = 200;
const CHUNK_WORD_OVERLAP = 30;

// High-value clinical stop words to filter out during keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'this', 'these', 'those', 'or', 'such', 'should', 'must', 'can', 'may',
  'into', 'been', 'have', 'had', 'also', 'than', 'more', 'most', 'very', 'each',
  'other', 'some', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'all',
]);

/**
 * Extracts distinct clinical and domain keywords from text.
 */
export function extractKeywordsFromText(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Sort by frequency and return top unique keywords
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([w]) => w);
}

/**
 * Splits section content into manageable chunks with overlap,
 * preserving clinical sentence boundaries.
 */
export function chunkGuidelineSections(sections: GuidelineSectionInput[]): GuidelineChunkData[] {
  const chunks: GuidelineChunkData[] = [];
  let globalChunkIndex = 0;

  for (const section of sections) {
    const sanitizedContent = sanitizePassageText(section.content);
    const paragraphs = sanitizedContent
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    let currentChunkWords: string[] = [];

    const flushChunk = () => {
      if (currentChunkWords.length === 0) return;

      const passageText = currentChunkWords.join(' ').trim();
      const keywords = extractKeywordsFromText(
        `${section.sectionTitle} ${passageText} ${(section.keywords || []).join(' ')}`
      );

      chunks.push({
        chunkIndex: globalChunkIndex++,
        sectionTitle: section.sectionTitle,
        sectionNumber: section.sectionNumber,
        pageNumber: section.pageNumber,
        passageText,
        keywords,
        tokenCount: Math.ceil(currentChunkWords.length * 1.3), // Approx token count
      });

      // Retain overlap for the next chunk
      if (currentChunkWords.length > CHUNK_WORD_OVERLAP) {
        currentChunkWords = currentChunkWords.slice(-CHUNK_WORD_OVERLAP);
      } else {
        currentChunkWords = [];
      }
    };

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean);

      // If adding this paragraph exceeds target limit and we already have content, flush first
      if (currentChunkWords.length + paraWords.length > TARGET_CHUNK_WORD_LIMIT && currentChunkWords.length > 50) {
        flushChunk();
      }

      currentChunkWords.push(...paraWords);

      // If current chunk is now comfortably sized, flush
      if (currentChunkWords.length >= TARGET_CHUNK_WORD_LIMIT) {
        flushChunk();
      }
    }

    // Flush any remaining words in this section
    if (currentChunkWords.length > 0) {
      flushChunk();
    }
  }

  return chunks;
}
