import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, requireRecordOwnership, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

/**
 * GET /api/records/[id]
 * Enforces strict record ownership (AGENTS.md Rule 3.3).
 * A patient can only view their own document. Clinicians/Admins can view when allowClinicalAccess is true.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const document = await prisma.medicalDocument.findUnique({
      where: { id },
      include: {
        biomarkers: true,
        patientProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, mrn: true, email: true } },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Medical document not found.' }, { status: 404 });
    }

    // ENFORCE RECORD OWNERSHIP
    requireRecordOwnership(user, document.patientProfile.userId, { allowClinicalAccess: true });

    return NextResponse.json({ success: true, document });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('RECORD_BY_ID_GET_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve document details.' }, { status: 500 });
  }
}

/**
 * DELETE /api/records/[id]
 * Enforces ownership: only document owner or admin can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const document = await prisma.medicalDocument.findUnique({
      where: { id },
      include: { patientProfile: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Medical document not found.' }, { status: 404 });
    }

    requireRecordOwnership(user, document.patientProfile.userId);

    await prisma.medicalDocument.delete({ where: { id } });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'ACCOUNT_PURGE_REQUESTED',
      targetEntityType: 'MedicalDocument',
      targetEntityId: id,
      metadata: { deletedFileName: document.fileName },
    });

    return NextResponse.json({ success: true, message: 'Document removed from medical vault.' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error('RECORD_BY_ID_DELETE_ERROR', error);
    return NextResponse.json({ error: 'Failed to delete document.' }, { status: 500 });
  }
}
