import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const APPROVED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  // Documents
  'application/pdf',
  'application/dicom',
  // Audio
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
] as const;

export type ApprovedMimeType = (typeof APPROVED_MIME_TYPES)[number];

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: string;
  sanitizedFileName: string;
  fileSizeBytes: number;
  errorMessage?: string;
}

/**
 * Validates file buffer, checking size, allowed extensions, and magic byte file signatures.
 * AGENTS.md Rule 3.1 & 3.3.
 */
export function validateFileBuffer(
  buffer: Buffer,
  originalFileName: string,
  declaredMimeType: string
): FileValidationResult {
  const fileSizeBytes = buffer.length;

  // 1. Check size
  if (fileSizeBytes <= 0) {
    return {
      isValid: false,
      detectedMimeType: declaredMimeType,
      sanitizedFileName: sanitizeFileName(originalFileName),
      fileSizeBytes,
      errorMessage: 'Uploaded file is empty (0 bytes).',
    };
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      detectedMimeType: declaredMimeType,
      sanitizedFileName: sanitizeFileName(originalFileName),
      fileSizeBytes,
      errorMessage: `File exceeds maximum allowed limit of 25MB (Received ${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  // 2. Sanitize file name
  const sanitized = sanitizeFileName(originalFileName);
  const ext = path.extname(sanitized).toLowerCase();

  // Reject explicitly forbidden executable / raw extensions
  const FORBIDDEN_EXTENSIONS = ['.raw', '.exe', '.sh', '.bat', '.cmd', '.vbs', '.js', '.mjs', '.zip', '.tar', '.gz'];
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      detectedMimeType: declaredMimeType,
      sanitizedFileName: sanitized,
      fileSizeBytes,
      errorMessage: `File extension "${ext}" is not supported. Please upload JPEG, PNG, WEBP, PDF, DICOM, or supported audio.`,
    };
  }

  // 3. Inspect magic bytes
  const detected = detectMimeTypeFromMagicBytes(buffer, declaredMimeType, ext);
  if (!detected) {
    return {
      isValid: false,
      detectedMimeType: declaredMimeType,
      sanitizedFileName: sanitized,
      fileSizeBytes,
      errorMessage: `File contents do not match an approved medical image, document, or audio format (MIME: ${declaredMimeType}).`,
    };
  }

  if (!APPROVED_MIME_TYPES.includes(detected as ApprovedMimeType)) {
    return {
      isValid: false,
      detectedMimeType: detected,
      sanitizedFileName: sanitized,
      fileSizeBytes,
      errorMessage: `Unsupported MIME type: ${detected}. Allowed formats: JPEG, PNG, WEBP, PDF, DICOM, and standard audio.`,
    };
  }

  return {
    isValid: true,
    detectedMimeType: detected,
    sanitizedFileName: sanitized,
    fileSizeBytes,
  };
}

/**
 * Helper to detect MIME type from magic bytes (file signatures).
 */
function detectMimeTypeFromMagicBytes(buffer: Buffer, declaredMimeType: string, ext: string): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // WAV: RIFF....WAVE
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return 'audio/wav';
  }

  // OGG: OggS (4F 67 67 53)
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'audio/ogg';
  }

  // WebM / EBML: 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm';
  }

  // MP3: ID3 tag or MPEG sync word (FF FB / FF F3 / FF F2)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'audio/mpeg';
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }

  // MP4 / M4A: ftyp at offset 4..7
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return declaredMimeType.includes('audio') || ext === '.m4a' ? 'audio/mp4' : 'video/mp4';
  }

  // DICOM: Check "DICM" signature at offset 128
  if (buffer.length >= 132) {
    const dicmTag = buffer.toString('utf8', 128, 132);
    if (dicmTag === 'DICM' || ext === '.dcm' || ext === '.dicom') {
      return 'application/dicom';
    }
  }

  // Fallback check against declared MIME if it's one of the approved types and matches extension
  if (
    (declaredMimeType === 'audio/webm' && ext === '.webm') ||
    (declaredMimeType === 'audio/wav' && ext === '.wav') ||
    (declaredMimeType === 'audio/mp4' && ext === '.m4a') ||
    (declaredMimeType === 'application/pdf' && ext === '.pdf')
  ) {
    return declaredMimeType;
  }

  return null;
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Storage Vault Manager: Stores patient files in private storage outside public root.
 * Enforces AGENTS.md Rule 3.1: Never store private medical data in public/.
 */
export class PrivateStorageVault {
  private baseDir: string;

  constructor(customVaultDir?: string) {
    this.baseDir = customVaultDir || env.LOCAL_VAULT_DIR || '.local-vault';
  }

  private resolvePath(storageKey: string): string {
    const safeKey = storageKey.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.resolve(process.cwd(), this.baseDir, safeKey);
  }

  async saveFile(storageKey: string, data: Buffer): Promise<string> {
    const fullPath = this.resolvePath(storageKey);
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(fullPath, data);
    return storageKey;
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    try {
      const fullPath = this.resolvePath(storageKey);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(storageKey);
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export const privateStorageVault = new PrivateStorageVault();

/**
 * Generates a short-lived HMAC signed URL for secure file access.
 * Validity defaults to 15 minutes (900 seconds).
 */
export function generateAuthorizedFileUrl(
  mediaId: string,
  patientProfileId: string,
  expiresInSeconds = 900
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${mediaId}:${patientProfileId}:${expires}`;
  const hmac = crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(payload)
    .digest('hex');

  return `/api/files/${mediaId}?token=${hmac}&expires=${expires}`;
}

/**
 * Validates a signed file access token.
 */
export function verifyAuthorizedFileToken(
  mediaId: string,
  patientProfileId: string,
  token: string,
  expires: number
): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now > expires) {
    logger.warn('EXPIRED_FILE_TOKEN', { mediaId, expires, now });
    return false;
  }

  const payload = `${mediaId}:${patientProfileId}:${expires}`;
  const expectedHmac = crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedHmac, 'hex'));
  } catch {
    return false;
  }
}
