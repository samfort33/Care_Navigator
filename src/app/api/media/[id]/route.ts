import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { generateAuthorizedFileUrl, privateStorageVault } from '@/server/storage';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/media/[id]
 * Retrieves metadata and fresh authorized access URL for an uploaded media item.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const media = await prisma.uploadedMedia.findUnique({
      where: { id },
      include: { patientProfile: true },
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    // Ownership check: Patient can only access own media; Clinician / Admin can access any
    if (user.role === 'PATIENT' && media.patientProfile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this media.' }, { status: 403 });
    }

    const authorizedUrl = generateAuthorizedFileUrl(media.id, media.patientProfileId);

    return NextResponse.json({
      data: {
        ...media,
        authorizedUrl,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('MEDIA_GET_ID_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve media record.' }, { status: 500 });
  }
}

/**
 * DELETE /api/media/[id]
 * Deletes uploaded media from both private storage and database.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const media = await prisma.uploadedMedia.findUnique({
      where: { id },
      include: { patientProfile: true },
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    if (user.role === 'PATIENT' && media.patientProfile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete this media.' }, { status: 403 });
    }

    // Delete file from private storage vault
    await privateStorageVault.deleteFile(media.storageKey);

    // Delete database record
    await prisma.uploadedMedia.delete({
      where: { id },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_DELETED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: id,
      metadata: { fileName: media.fileName, storageKey: media.storageKey },
    });

    return NextResponse.json({ success: true, message: 'Media removed successfully.' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('MEDIA_DELETE_ID_ERROR', error);
    return NextResponse.json({ error: 'Failed to delete media record.' }, { status: 500 });
  }
}
