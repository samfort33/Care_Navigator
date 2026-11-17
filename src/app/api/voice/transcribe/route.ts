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
import { getSpeechToTextProvider } from '@/server/voice/provider-adapter';
import { SilenceDetectedError, SpeechToTextError } from '@/server/voice/types';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    if (!isPrivateFileStorageAvailable()) {
      return NextResponse.json(
        { error: 'Voice uploads are unavailable until persistent private storage is configured.' },
        { status: 503 }
      );
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
    const audioFile = formData.get('audio');
    const rawDuration = formData.get('durationSeconds');
    const durationSeconds = rawDuration ? Math.max(1, parseInt(String(rawDuration), 10)) : 5;
    const triageSessionId = (formData.get('triageSessionId') as string) || undefined;

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'No audio recording file was provided.' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = 'name' in audioFile ? (audioFile as File).name : 'recording.webm';
    const declaredType = audioFile.type || 'audio/webm';

    // 1. Validate file buffer against approved audio types and size limits
    const validation = validateFileBuffer(buffer, originalName, declaredType);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.errorMessage || 'Invalid audio recording format or size.',
          detectedMimeType: validation.detectedMimeType,
        },
        { status: 400 }
      );
    }

    // 2. Validate triage session ownership if specified
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

    // 3. Save audio securely to private vault
    const storageKey = `patients/${profile.id}/voice/${crypto.randomUUID()}-${validation.sanitizedFileName}`;
    await privateStorageVault.saveFile(storageKey, buffer);

    // 4. Create database record for the voice recording
    const media = await prisma.uploadedMedia.create({
      data: {
        patientProfileId: profile.id,
        triageSessionId: triageSessionId || null,
        fileName: validation.sanitizedFileName,
        fileSizeBytes: validation.fileSizeBytes,
        mimeType: validation.detectedMimeType,
        storageKey,
        modality: 'VOICE_RECORDING',
        processingStatus: 'EXTRACTING',
        processingProgress: 50,
        extractedSummary: 'Processing audio speech-to-text transcription...',
        extractedDataJson: '{}',
        isSeedFixture: false,
      },
    });

    // 5. Execute Speech-to-Text transcription
    const sttProvider = getSpeechToTextProvider();
    let transcription;
    try {
      transcription = await sttProvider.transcribe(buffer, {
        mimeType: validation.detectedMimeType,
        durationSeconds,
      });
    } catch (sttError) {
      if (sttError instanceof SilenceDetectedError) {
        await prisma.uploadedMedia.update({
          where: { id: media.id },
          data: {
            processingStatus: 'FAILED',
            processingProgress: 100,
            errorMessage: 'Silence detected: No audible patient speech was detected.',
            extractedSummary: 'Recording contains silence or background noise.',
          },
        });

        return NextResponse.json(
          {
            error: 'SILENCE_DETECTED',
            message: 'No clear speech detected in recording. Please speak closer to your microphone or type your symptoms below.',
            mediaId: media.id,
          },
          { status: 422 }
        );
      }

      await prisma.uploadedMedia.update({
        where: { id: media.id },
        data: {
          processingStatus: 'FAILED',
          processingProgress: 100,
          errorMessage: sttError instanceof Error ? sttError.message : 'Transcription failed.',
        },
      });

      logger.error('VOICE_TRANSCRIBE_PROVIDER_ERROR', sttError);
      return NextResponse.json(
        {
          error: 'TRANSCRIPTION_FAILED',
          message: sttError instanceof Error ? sttError.message : 'Failed to transcribe audio recording.',
          mediaId: media.id,
        },
        { status: sttError instanceof SpeechToTextError ? sttError.statusCode : 502 }
      );
    }

    // 6. Persist successful transcription
    const updatedMedia = await prisma.uploadedMedia.update({
      where: { id: media.id },
      data: {
        processingStatus: 'ANALYZED',
        processingProgress: 100,
        extractedSummary: transcription.transcript,
        extractedDataJson: JSON.stringify({
          entities: transcription.extractedEntities,
          confidence: transcription.confidence,
          durationSeconds: transcription.durationSeconds,
          provider: transcription.provider,
        }),
      },
    });

    // 7. Update triage session voiceTranscript if attached
    if (triageSessionId) {
      await prisma.triageSession.update({
        where: { id: triageSessionId },
        data: {
          voiceTranscript: transcription.transcript,
        },
      });
    }

    // 8. Generate authorized playback URL
    const authorizedUrl = generateAuthorizedFileUrl(media.id, profile.id);

    // 9. Audit log
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'DOCUMENT_UPLOADED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: media.id,
      metadata: {
        modality: 'VOICE_RECORDING',
        durationSeconds: transcription.durationSeconds,
        confidence: transcription.confidence,
      },
    });

    return NextResponse.json({
      success: true,
      transcript: transcription.transcript,
      durationSeconds: transcription.durationSeconds,
      extractedEntities: transcription.extractedEntities,
      confidence: transcription.confidence,
      mediaId: updatedMedia.id,
      authorizedUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    logger.error('VOICE_TRANSCRIBE_ENDPOINT_ERROR', error);
    return NextResponse.json({ error: 'Failed to process voice transcription.' }, { status: 500 });
  }
}
