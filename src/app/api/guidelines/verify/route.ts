import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated } from '@/server/auth/guards';
import { verifyCitationIntegrity } from '@/server/guidelines/verifier';
import { z } from 'zod';

const verifyCitationRequestSchema = z.object({
  guidelineId: z.string().optional(),
  guidelineCode: z.string().optional(),
  chunkId: z.string().optional(),
  claimedPassageText: z.string().optional(),
  claimSupported: z.string().optional(),
});

/**
 * POST /api/guidelines/verify
 * Allows clinicians, auditors, or automated systems to verify that a citation
 * genuinely exists in the approved guideline corpus and supports the claimed statement.
 * AGENTS.md Rule 4.1 & Requirement 5.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    requireAuthenticated(session);

    const body = await request.json();
    const parsed = verifyCitationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const verificationResult = await verifyCitationIntegrity(parsed.data);

    return NextResponse.json({
      verified: verificationResult.isValid,
      status: verificationResult.status,
      relevanceScore: verificationResult.relevanceScore,
      reason: verificationResult.reason,
      matchedChunk: verificationResult.matchedChunk,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Citation verification failed.' },
      { status: 500 }
    );
  }
}
