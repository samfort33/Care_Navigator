import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { listGuidelines, ingestApprovedGuideline } from '@/server/guidelines/ingestion';
import { ApprovedGuidelineInputSchema } from '@/server/guidelines/types';

/**
 * GET /api/admin/guidelines
 * Lists clinical guidelines with lifecycle status, versioning, and chunk counts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    requireRole(session, ['ADMIN', 'CLINICIAN']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'ACTIVE' | 'RETIRED' | 'SUPERSEDED' | null;
    const specialty = searchParams.get('specialty') || undefined;

    const guidelines = await listGuidelines({
      status: status || undefined,
      specialty,
    });

    return NextResponse.json({
      total: guidelines.length,
      guidelines,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/admin/guidelines
 * Ingests an approved clinical guideline document into the persistent database.
 * Chunks sections, extracts metadata, and records an immutable audit log.
 * AGENTS.md Rule 4.1 & Requirement 1, 2, 8.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireRole(session, ['ADMIN']);

    const body = await request.json();
    const parsed = ApprovedGuidelineInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid guideline document structure',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const result = await ingestApprovedGuideline(parsed.data, {
      actorUserId: user.id,
      isSeedFixture: false,
    });

    return NextResponse.json(
      {
        message: `Clinical guideline "${result.guideline.code}" ingested successfully.`,
        guideline: result.guideline,
        chunksCreated: result.chunksCount,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ingestion failed.';
    const status = message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
