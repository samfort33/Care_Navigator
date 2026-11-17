import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { requireAuthenticated, AuthError } from '@/server/auth/guards';
import { recordAuditLog } from '@/server/audit/audit-logger';
import {
  validateFileBuffer,
  privateStorageVault,
  generateAuthorizedFileUrl,
  isPrivateFileStorageAvailable,
} from '@/server/storage';
import { getMediaAnalysisProvider } from '@/server/media/analysis-adapter';
import { checkRateLimit, createRateLimitResponse } from '@/server/security/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    if (!isPrivateFileStorageAvailable()) {
      return NextResponse.json(
        { error: 'File uploads are unavailable until persistent private storage is configured.' },
        { status: 503 }
      );
    }

    // 1. Rate Limiting: Max 25 uploads per 10 minutes per IP
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'media_upload',
      limit: 25,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const session = await getServerSession({ strictCookieOnly: true, req: request });
    const user = requireAuthenticated(session);

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found. Please complete profile setup first.' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No valid file was uploaded.' }, { status: 400 });
    }

    const rawModality = (formData.get('modality') as string) || 'CLINICAL_IMAGE';
    const triageSessionId = (formData.get('triageSessionId') as string) || undefined;
    const runAnalysisParam = formData.get('runAnalysis');
    const runAnalysis = runAnalysisParam === null ? true : runAnalysisParam !== 'false';

    const modality = ['CLINICAL_IMAGE', 'VOICE_RECORDING', 'LAB_DOCUMENT'].includes(rawModality)
      ? (rawModality as 'CLINICAL_IMAGE' | 'VOICE_RECORDING' | 'LAB_DOCUMENT')
      : 'CLINICAL_IMAGE';

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = 'name' in file ? (file as File).name : 'uploaded_file';
    const declaredType = file.type || 'application/octet-stream';

    // 1. Validate file buffer against approved MIME types and magic bytes
    const validation = validateFileBuffer(buffer, originalName, declaredType);
    if (!validation.isValid) {
      logger.warn('INVALID_FILE_UPLOAD_ATTEMPT', {
        originalName,
        declaredType,
        error: validation.errorMessage,
        userId: user.id,
      });
      return NextResponse.json(
        {
          error: validation.errorMessage || 'Invalid file format or size.',
          detectedMimeType: validation.detectedMimeType,
        },
        { status: 400 }
      );
    }

    // 2. If triageSessionId provided, verify it belongs to this patient
    if (triageSessionId) {
      const sessionRecord = await prisma.triageSession.findUnique({
        where: { id: triageSessionId },
      });
      if (!sessionRecord || sessionRecord.patientProfileId !== profile.id) {
        return NextResponse.json(
          { error: 'The specified triage session does not belong to your account.' },
          { status: 403 }
        );
      }
    }

    // 3. Save to private storage vault (never in public/)
    const storageKey = `patients/${profile.id}/${crypto.randomUUID()}-${validation.sanitizedFileName}`;
    await privateStorageVault.saveFile(storageKey, buffer);

    // 4. Initial database record
    const media = await prisma.uploadedMedia.create({
      data: {
        patientProfileId: profile.id,
        triageSessionId: triageSessionId || null,
        fileName: validation.sanitizedFileName,
        fileSizeBytes: validation.fileSizeBytes,
        mimeType: validation.detectedMimeType,
        storageKey,
        modality,
        processingStatus: 'QUEUED',
        processingProgress: 25,
        extractedSummary: 'Uploaded and secured in encrypted vault. Queued for analysis.',
        extractedDataJson: '{}',
        isSeedFixture: false,
      },
    });

    // 5. Run analysis if requested and format supported
    let finalStatus = 'QUEUED';
    let summary = media.extractedSummary;
    let dataJson = '{}';
    let errorMsg: string | undefined = undefined;

    if (runAnalysis) {
      const provider = getMediaAnalysisProvider();
      const analysisResult = await provider.analyzeMedia(
        buffer,
        validation.detectedMimeType,
        validation.sanitizedFileName,
        modality
      );

      finalStatus = analysisResult.status;
      summary = analysisResult.extractedSummary;
      dataJson = JSON.stringify(analysisResult.extractedData);
      errorMsg = analysisResult.errorMessage;

      await prisma.uploadedMedia.update({
        where: { id: media.id },
        data: {
          processingStatus: finalStatus,
          processingProgress: 100,
          extractedSummary: summary,
          extractedDataJson: dataJson,
          errorMessage: errorMsg || null,
        },
      });
    }

    // 6. Generate short-lived authorized URL
    const authorizedUrl = generateAuthorizedFileUrl(media.id, profile.id);

    // 7. Audit log
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_UPLOADED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: media.id,
      metadata: {
        fileName: validation.sanitizedFileName,
        modality,
        fileSizeBytes: validation.fileSizeBytes,
        processingStatus: finalStatus,
      },
    });

    const updatedMedia = await prisma.uploadedMedia.findUnique({
      where: { id: media.id },
    });

    return NextResponse.json(
      {
        success: true,
        media: updatedMedia,
        authorizedUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('MEDIA_UPLOAD_ENDPOINT_ERROR', error);
    return NextResponse.json({ error: 'Failed to process and store media file.' }, { status: 500 });
  }
}
