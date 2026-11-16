import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/server/auth/session';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { privateStorageVault, verifyAuthorizedFileToken } from '@/server/storage';
import type { UserRole } from '@/lib/design-tokens';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: fileId } = await context.params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const expires = parseInt(searchParams.get('expires') || '0', 10);

    // 1. Look up file metadata across UploadedMedia or MedicalDocument
    const media = await prisma.uploadedMedia.findUnique({
      where: { id: fileId },
      include: { patientProfile: true },
    });

    let storageKey: string | null = null;
    let fileName: string = 'file';
    let mimeType: string = 'application/octet-stream';
    let patientProfileId: string = '';
    let patientUserId: string = '';

    if (media) {
      storageKey = media.storageKey;
      fileName = media.fileName;
      mimeType = media.mimeType;
      patientProfileId = media.patientProfileId;
      patientUserId = media.patientProfile.userId;
    } else {
      const doc = await prisma.medicalDocument.findUnique({
        where: { id: fileId },
        include: { patientProfile: true },
      });
      if (doc) {
        storageKey = doc.storageKey;
        fileName = doc.fileName;
        mimeType = doc.mimeType;
        patientProfileId = doc.patientProfileId;
        patientUserId = doc.patientProfile.userId;
      }
    }

    if (!storageKey) {
      return NextResponse.json({ error: 'Requested file was not found.' }, { status: 404 });
    }

    // 2. Validate Access: Check short-lived signed token OR active session ownership
    let isAuthorized = false;
    let actorId: string | null = null;
    let actorRole: UserRole = 'PATIENT';

    if (token && expires > 0) {
      const tokenValid = verifyAuthorizedFileToken(fileId, patientProfileId, token, expires);
      if (tokenValid) {
        isAuthorized = true;
        actorId = patientUserId || null;
      }
    }

    if (!isAuthorized) {
      const session = await getServerSession({ strictCookieOnly: true, req: request });
      if (session) {
        actorId = session.id;
        actorRole = session.role;
        // Patient can access their own files; Clinician/Admin can access any patient file
        if (session.role === 'ADMIN' || session.role === 'CLINICIAN' || session.id === patientUserId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      logger.warn('UNAUTHORIZED_FILE_ACCESS_ATTEMPT', { fileId, patientUserId });
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to access this medical file.' },
        { status: 403 }
      );
    }

    // 3. Read file from private vault
    const fileBuffer = await privateStorageVault.getFile(storageKey);
    if (!fileBuffer) {
      logger.error('FILE_NOT_FOUND_IN_VAULT', { fileId, storageKey });
      return NextResponse.json({ error: 'File content could not be located in storage vault.' }, { status: 404 });
    }

    // 4. Record access audit log
    await recordAuditLog({
      actorUserId: actorId,
      actorRole,
      actionType: 'DOCUMENT_VIEWED',
      targetEntityType: 'UploadedMedia',
      targetEntityId: fileId,
      metadata: { fileName, mimeType, fileSizeBytes: fileBuffer.length },
    });

    // 5. Stream response with security headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('FILE_SERVE_ERROR', error);
    return NextResponse.json({ error: 'Failed to retrieve file.' }, { status: 500 });
  }
}
