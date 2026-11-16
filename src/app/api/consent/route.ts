import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const updateConsentSchema = z.object({
  includeEhrContext: z.boolean().optional(),
  storeVoiceTranscripts: z.boolean().optional(),
  deidentifiedModelImprovement: z.boolean().optional(),
  automatedHieSync: z.boolean().optional(),
  commCriticalEmail: z.boolean().optional(),
  commCriticalSms: z.boolean().optional(),
  commCriticalPush: z.boolean().optional(),
  commReviewEmail: z.boolean().optional(),
  commReviewSms: z.boolean().optional(),
  commReviewPush: z.boolean().optional(),
  commAppointmentEmail: z.boolean().optional(),
  commAppointmentSms: z.boolean().optional(),
  commAppointmentPush: z.boolean().optional(),
  commPreventiveEmail: z.boolean().optional(),
  commPreventiveSms: z.boolean().optional(),
  commPreventivePush: z.boolean().optional(),
});

/**
 * GET /api/consent
 * Returns consent preferences for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    let consent = await prisma.consentPreference.findUnique({
      where: { userId: user.id },
    });

    if (!consent) {
      consent = await prisma.consentPreference.create({
        data: {
          userId: user.id,
          includeEhrContext: true,
          storeVoiceTranscripts: true,
          deidentifiedModelImprovement: false,
          automatedHieSync: true,
        },
      });
    }

    return NextResponse.json({ success: true, consent });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('CONSENT_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve consent preferences.' }, { status: 500 });
  }
}

/**
 * PUT /api/consent
 * Updates consent preferences for the authenticated user and logs audit trail.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const body = await request.json();
    const parsed = updateConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const updated = await prisma.consentPreference.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: {
        userId: user.id,
        ...parsed.data,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'CONSENT_UPDATED',
      targetEntityType: 'ConsentPreference',
      targetEntityId: updated.id,
      metadata: parsed.data,
    });

    return NextResponse.json({ success: true, consent: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('CONSENT_PUT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update consent preferences.' }, { status: 500 });
  }
}
