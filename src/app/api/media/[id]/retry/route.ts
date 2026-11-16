import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { privateStorageVault, generateAuthorizedFileUrl } from '@/server/storage';
import { getMediaAnalysisProvider } from '@/server/media/analysis-adapter';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/media/[id]/retry
 * Re-triggers processing and feature extraction for a failed or queued media item.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
      return NextResponse.json({ error: 'Forbidden: You do not own this media.' }, { status: 403 });
    }

    const buffer = await privateStorageVault.getFile(media.storageKey);
    if (!buffer) {
      return NextResponse.json(
        { error: 'Media binary file not found in storage vault. Please re-upload the file.' },
        { status: 404 }
      );
    }

    // Set status to EXTRACTING
    await prisma.uploadedMedia.update({
      where: { id },
      data: {
        processingStatus: 'EXTRACTING',
        processingProgress: 50,
        errorMessage: null,
      },
    });

    // Re-run analysis
    const provider = getMediaAnalysisProvider();
    const result = await provider.analyzeMedia(
      buffer,
      media.mimeType,
      media.fileName,
      media.modality as 'CLINICAL_IMAGE' | 'LAB_DOCUMENT' | 'VOICE_RECORDING'
    );

    const updated = await prisma.uploadedMedia.update({
      where: { id },
      data: {
        processingStatus: result.status,
        processingProgress: 100,
        extractedSummary: result.extractedSummary,
        extractedDataJson: JSON.stringify(result.extractedData),
        errorMessage: result.errorMessage || null,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_UPDATED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: id,
      metadata: {
        action: 'RETRY_PROCESSING',
        newStatus: result.status,
      },
    });

    const authorizedUrl = generateAuthorizedFileUrl(updated.id, updated.patientProfileId);

    return NextResponse.json({
      success: true,
      media: updated,
      authorizedUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('MEDIA_RETRY_ERROR', error);
    return NextResponse.json({ error: 'Failed to retry media processing.' }, { status: 500 });
  }
}
