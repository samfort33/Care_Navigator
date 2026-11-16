import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { prisma } from '@/lib/prisma';
import { retireGuideline, supersedeGuideline } from '@/server/guidelines/ingestion';
import { ApprovedGuidelineInputSchema } from '@/server/guidelines/types';
import { z } from 'zod';

const lifecycleActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('RETIRE'),
    retirementReason: z.string().min(5, 'Retirement reason must be at least 5 characters'),
  }),
  z.object({
    action: z.literal('SUPERSEDE'),
    newGuideline: ApprovedGuidelineInputSchema,
  }),
]);

/**
 * GET /api/admin/guidelines/[id]
 * Retrieves a single clinical guideline with all associated passages/chunks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    requireRole(session, ['ADMIN', 'CLINICIAN']);

    const { id } = await params;

    const guideline = await prisma.clinicalGuideline.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
        _count: {
          select: { citations: true },
        },
      },
    });

    if (!guideline) {
      return NextResponse.json({ error: 'Clinical guideline not found.' }, { status: 404 });
    }

    return NextResponse.json({ guideline });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching guideline';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/guidelines/[id]
 * Allows administrators to retire or supersede outdated clinical guidelines.
 * AGENTS.md Rule 4.1 & Requirement 8.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireRole(session, ['ADMIN']);

    const { id } = await params;

    // Check if guideline exists
    const existing = await prisma.clinicalGuideline.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Clinical guideline not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = lifecycleActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid lifecycle action',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'RETIRE') {
      const retired = await retireGuideline(
        existing.code,
        parsed.data.retirementReason,
        user.id
      );

      return NextResponse.json({
        message: `Guideline "${existing.code}" successfully retired.`,
        guideline: retired,
      });
    }

    if (parsed.data.action === 'SUPERSEDE') {
      const result = await supersedeGuideline(
        existing.code,
        parsed.data.newGuideline,
        user.id
      );

      return NextResponse.json({
        message: `Guideline "${existing.code}" successfully superseded by "${result.newGuideline.code}" (v${result.newGuideline.version}).`,
        result,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lifecycle update failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
