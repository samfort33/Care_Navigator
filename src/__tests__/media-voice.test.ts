import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateFileBuffer,
  privateStorageVault,
  generateAuthorizedFileUrl,
  verifyAuthorizedFileToken,
  MAX_FILE_SIZE_BYTES,
} from '@/server/storage';
import {
  MockSpeechToTextProvider,
  setSpeechToTextProviderOverride,
} from '@/server/voice/provider-adapter';
import {
  MockMediaAnalysisProvider,
  OllamaMedGemmaMediaProvider,
  setMediaAnalysisProviderOverride,
} from '@/server/media/analysis-adapter';
import { prisma } from '@/lib/prisma';
import { GET as getFileEndpoint } from '@/app/api/files/[id]/route';
import { POST as uploadMediaEndpoint } from '@/app/api/media/upload/route';
import { GET as getMediaEndpoint, DELETE as deleteMediaEndpoint } from '@/app/api/media/[id]/route';
import { POST as retryMediaEndpoint } from '@/app/api/media/[id]/retry/route';
import { POST as transcribeVoiceEndpoint } from '@/app/api/voice/transcribe/route';
import { POST as createAssessmentEndpoint } from '@/app/api/assessments/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/server/auth/session';
import { NextRequest } from 'next/server';

async function makeAuthHeaders(userId: string, email: string, role: 'PATIENT' | 'CLINICIAN' | 'ADMIN', name: string) {
  const token = await signSessionToken({
    id: userId,
    email,
    name,
    role,
    mrn: `MRN-${userId.slice(-6)}`,
    isSeedFixture: true,
  });
  return {
    cookie: `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`,
    authorization: `Bearer ${token}`,
  };
}

// Sample binary generators for magic bytes testing
function createValidPngBuffer(): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dummyData = Buffer.alloc(100, 0x20);
  return Buffer.concat([header, dummyData]);
}

function createValidJpegBuffer(): Buffer {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const dummyData = Buffer.alloc(100, 0x20);
  return Buffer.concat([header, dummyData]);
}

function createValidPdfBuffer(): Buffer {
  const header = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
  const dummyData = Buffer.alloc(100, 0x20);
  return Buffer.concat([header, dummyData]);
}

function createValidWebmAudioBuffer(): Buffer {
  const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  const dummyData = Buffer.alloc(200, 0x55);
  return Buffer.concat([header, dummyData]);
}

function createValidDicomBuffer(): Buffer {
  const preamble = Buffer.alloc(128, 0x00);
  const dicmTag = Buffer.from('DICM');
  const dummyData = Buffer.alloc(100, 0x11);
  return Buffer.concat([preamble, dicmTag, dummyData]);
}

describe('CareNavigator Media Upload & Voice Workflows', () => {
  beforeEach(() => {
    setSpeechToTextProviderOverride(new MockSpeechToTextProvider('SUCCESS'));
    setMediaAnalysisProviderOverride(new MockMediaAnalysisProvider('SUCCESS'));
  });

  afterEach(() => {
    setSpeechToTextProviderOverride(null);
    setMediaAnalysisProviderOverride(null);
    vi.unstubAllGlobals();
  });

  it('sends supported clinical photos to the local MedGemma vision adapter without tool calls', async () => {
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ message: { content: JSON.stringify({ summary: 'Test-only visual description', observations: [], qualityCheck: 'ADEQUATE', recommendedAction: 'Clinician review' }) } }),
        { status: 200 }
      );
    }));

    const result = await new OllamaMedGemmaMediaProvider().analyzeMedia(
      createValidPngBuffer(),
      'image/png',
      'sample.png',
      'CLINICAL_IMAGE'
    );

    expect(result.status).toBe('ANALYZED');
    expect(result.provider).toBe('ollama-medgemma-vision');
    expect(requestBody).not.toHaveProperty('tools');
    const messages = requestBody?.messages as Array<{ images?: string[] }>;
    expect(messages[1]?.images?.[0]).toBe(createValidPngBuffer().toString('base64'));
  });

  describe('1. Media File Validation & Magic Byte Signatures', () => {
    it('approves valid PNG buffer with matching PNG magic bytes', () => {
      const pngBuffer = createValidPngBuffer();
      const res = validateFileBuffer(pngBuffer, 'skin_lesion.png', 'image/png');
      expect(res.isValid).toBe(true);
      expect(res.detectedMimeType).toBe('image/png');
    });

    it('approves valid JPEG buffer with matching JPEG magic bytes', () => {
      const jpegBuffer = createValidJpegBuffer();
      const res = validateFileBuffer(jpegBuffer, 'rash_closeup.jpg', 'image/jpeg');
      expect(res.isValid).toBe(true);
      expect(res.detectedMimeType).toBe('image/jpeg');
    });

    it('approves valid PDF buffer with %PDF- signature', () => {
      const pdfBuffer = createValidPdfBuffer();
      const res = validateFileBuffer(pdfBuffer, 'metabolic_panel.pdf', 'application/pdf');
      expect(res.isValid).toBe(true);
      expect(res.detectedMimeType).toBe('application/pdf');
    });

    it('approves valid DICOM buffer with 128-byte preamble and DICM header', () => {
      const dicomBuffer = createValidDicomBuffer();
      const res = validateFileBuffer(dicomBuffer, 'chest_scan.dcm', 'application/dicom');
      expect(res.isValid).toBe(true);
      expect(res.detectedMimeType).toBe('application/dicom');
    });

    it('approves valid WebM audio buffer', () => {
      const webmBuffer = createValidWebmAudioBuffer();
      const res = validateFileBuffer(webmBuffer, 'patient_voice.webm', 'audio/webm');
      expect(res.isValid).toBe(true);
      expect(res.detectedMimeType).toBe('audio/webm');
    });

    it('rejects unsupported .raw format explicitly mentioned in reference design', () => {
      const dummyBuffer = Buffer.alloc(100, 0x12);
      const res = validateFileBuffer(dummyBuffer, 'chest_xray_scan_damaged.raw', 'application/octet-stream');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('.raw');
    });

    it('rejects dangerous executable files (.exe, .sh, .bat)', () => {
      const dummyBuffer = Buffer.alloc(100, 0x90);
      const res = validateFileBuffer(dummyBuffer, 'malicious_payload.exe', 'application/x-msdownload');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('.exe');
    });

    it('rejects files exceeding the 25 MB maximum size limit', () => {
      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
      const res = validateFileBuffer(largeBuffer, 'large_mri.pdf', 'application/pdf');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('exceeds maximum allowed limit of 25MB');
    });

    it('rejects empty 0-byte files', () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = validateFileBuffer(emptyBuffer, 'empty.png', 'image/png');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('empty');
    });
  });

  describe('2. Private Object Storage Vault & Short-Lived Authorized URLs', () => {
    it('stores and retrieves binary data in private storage vault', async () => {
      const testKey = `test/unit-${Date.now()}.png`;
      const originalData = Buffer.from('private-clinical-image-content-2026');

      await privateStorageVault.saveFile(testKey, originalData);
      const retrieved = await privateStorageVault.getFile(testKey);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe(originalData.toString());

      await privateStorageVault.deleteFile(testKey);
    });

    it('generates a valid short-lived HMAC-signed authorized URL', () => {
      const mediaId = 'media-unit-123';
      const patientProfileId = 'profile-patient-456';
      const url = generateAuthorizedFileUrl(mediaId, patientProfileId, 300);

      expect(url).toContain(`/api/files/${mediaId}?token=`);
      expect(url).toContain('&expires=');

      const urlObj = new URL(url, 'http://localhost');
      const token = urlObj.searchParams.get('token')!;
      const expires = parseInt(urlObj.searchParams.get('expires')!, 10);

      const isValid = verifyAuthorizedFileToken(mediaId, patientProfileId, token, expires);
      expect(isValid).toBe(true);
    });

    it('rejects tampered or expired signed file tokens', () => {
      const mediaId = 'media-unit-123';
      const patientProfileId = 'profile-patient-456';
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago

      const expiredUrl = generateAuthorizedFileUrl(mediaId, patientProfileId, -10);
      const urlObj = new URL(expiredUrl, 'http://localhost');
      const token = urlObj.searchParams.get('token')!;

      const isExpiredValid = verifyAuthorizedFileToken(mediaId, patientProfileId, token, expiredTimestamp);
      expect(isExpiredValid).toBe(false);

      // Tampered token test
      const tamperedValid = verifyAuthorizedFileToken(mediaId, patientProfileId, 'corrupted_token_value', Math.floor(Date.now() / 1000) + 300);
      expect(tamperedValid).toBe(false);
    });
  });

  describe('3. Patient Ownership & Access Control (AGENTS.md Rule 3.3)', () => {
    it('denies patient access to another patient private media (403 Forbidden)', async () => {
      // Find two distinct patients
      const profiles = await prisma.patientProfile.findMany({
        take: 2,
        include: { user: true },
      });
      expect(profiles.length).toBeGreaterThanOrEqual(2);

      const [patientA, patientB] = profiles;

      // Create a media item belonging to Patient B
      const mediaKey = `patients/${patientB.id}/test-private.png`;
      await privateStorageVault.saveFile(mediaKey, createValidPngBuffer());

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patientB.id,
          fileName: 'confidential_lab.png',
          fileSizeBytes: 1024,
          mimeType: 'image/png',
          storageKey: mediaKey,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'ANALYZED',
          isSeedFixture: false,
        },
      });

      // Patient A attempts to access Patient B's media detail endpoint
      const patientAHeaders = await makeAuthHeaders(patientA.userId, patientA.user.email, 'PATIENT', patientA.user.name);
      const req = new NextRequest(`http://localhost:3000/api/media/${media.id}`, {
        headers: patientAHeaders,
      });

      const res = await getMediaEndpoint(req, { params: Promise.resolve({ id: media.id }) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain('Forbidden');

      // Patient A attempts to download file directly from /api/files/[id] without valid signed token
      const fileReq = new NextRequest(`http://localhost:3000/api/files/${media.id}`, {
        headers: patientAHeaders,
      });
      const fileRes = await getFileEndpoint(fileReq, { params: Promise.resolve({ id: media.id }) });
      expect(fileRes.status).toBe(403);

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: media.id } });
      await privateStorageVault.deleteFile(mediaKey);
    });

    it('allows patient to access their own media file', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const mediaKey = `patients/${patient.id}/own-file.png`;
      const pngBuffer = createValidPngBuffer();
      await privateStorageVault.saveFile(mediaKey, pngBuffer);

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patient.id,
          fileName: 'own_skin_rash.png',
          fileSizeBytes: pngBuffer.length,
          mimeType: 'image/png',
          storageKey: mediaKey,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'ANALYZED',
          isSeedFixture: false,
        },
      });

      const patientHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest(`http://localhost:3000/api/files/${media.id}`, {
        headers: patientHeaders,
      });

      const res = await getFileEndpoint(req, { params: Promise.resolve({ id: media.id }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: media.id } });
      await privateStorageVault.deleteFile(mediaKey);
    });

    it('allows access via valid signed URL token even without active session', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow();
      const mediaKey = `patients/${patient.id}/token-file.png`;
      const pngBuffer = createValidPngBuffer();
      await privateStorageVault.saveFile(mediaKey, pngBuffer);

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patient.id,
          fileName: 'token_access.png',
          fileSizeBytes: pngBuffer.length,
          mimeType: 'image/png',
          storageKey: mediaKey,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'ANALYZED',
          isSeedFixture: false,
        },
      });

      const signedUrl = generateAuthorizedFileUrl(media.id, patient.id, 600);
      const req = new NextRequest(`http://localhost:3000${signedUrl}`);

      const res = await getFileEndpoint(req, { params: Promise.resolve({ id: media.id }) });
      expect(res.status).toBe(200);

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: media.id } });
      await privateStorageVault.deleteFile(mediaKey);
    });
  });

  describe('4. Multipart Media Upload Endpoint (/api/media/upload)', () => {
    it('uploads a valid clinical photo, saves to private vault, and triggers multimodal analysis', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const pngBuffer = createValidPngBuffer();
      const formData = new FormData();
      const fileBlob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' });
      formData.append('file', fileBlob, 'dermatology_forearm.png');
      formData.append('modality', 'CLINICAL_IMAGE');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/media/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await uploadMediaEndpoint(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.media.processingStatus).toBe('ANALYZED');
      expect(json.media.fileName).toBe('dermatology_forearm.png');
      expect(json.authorizedUrl).toContain(`/api/files/${json.media.id}`);

      // Verify file is actually in private storage vault
      const vaultedData = await privateStorageVault.getFile(json.media.storageKey);
      expect(vaultedData).not.toBeNull();

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: json.media.id } });
      await privateStorageVault.deleteFile(json.media.storageKey);
    });

    it('rejects upload when file exceeds 25 MB with 400 Bad Request', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 2048);
      const formData = new FormData();
      const fileBlob = new Blob([new Uint8Array(largeBuffer)], { type: 'application/pdf' });
      formData.append('file', fileBlob, 'oversized_scan.pdf');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/media/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await uploadMediaEndpoint(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('exceeds maximum allowed limit of 25MB');
    });

    it('preserves DICOM format without claiming automated AI interpretation (AGENTS.md Rule 4.1)', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const dicomBuffer = createValidDicomBuffer();
      const formData = new FormData();
      const fileBlob = new Blob([new Uint8Array(dicomBuffer)], { type: 'application/dicom' });
      formData.append('file', fileBlob, 'head_ct.dcm');
      formData.append('modality', 'CLINICAL_IMAGE');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/media/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await uploadMediaEndpoint(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.media.processingStatus).toBe('UNSUPPORTED_FORMAT');
      expect(json.media.extractedSummary).toContain('preserved for clinician review');

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: json.media.id } });
      await privateStorageVault.deleteFile(json.media.storageKey);
    });
  });

  describe('5. Media Retry & Deletion Controls', () => {
    it('successfully reprocesses a failed media item via POST /api/media/[id]/retry', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const pngBuffer = createValidPngBuffer();
      const key = `patients/${patient.id}/failed-initially.png`;
      await privateStorageVault.saveFile(key, pngBuffer);

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patient.id,
          fileName: 'retry_test.png',
          fileSizeBytes: pngBuffer.length,
          mimeType: 'image/png',
          storageKey: key,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'FAILED',
          errorMessage: 'Initial timeout',
          isSeedFixture: false,
        },
      });

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest(`http://localhost:3000/api/media/${media.id}/retry`, {
        method: 'POST',
        headers: authHeaders,
      });

      const res = await retryMediaEndpoint(req, { params: Promise.resolve({ id: media.id }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.media.processingStatus).toBe('ANALYZED');
      expect(json.media.errorMessage).toBeNull();

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: media.id } });
      await privateStorageVault.deleteFile(key);
    });

    it('deletes media from database and private storage vault via DELETE /api/media/[id]', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const key = `patients/${patient.id}/delete-target.png`;
      await privateStorageVault.saveFile(key, createValidPngBuffer());

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patient.id,
          fileName: 'to_delete.png',
          fileSizeBytes: 1024,
          mimeType: 'image/png',
          storageKey: key,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'ANALYZED',
          isSeedFixture: false,
        },
      });

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest(`http://localhost:3000/api/media/${media.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const res = await deleteMediaEndpoint(req, { params: Promise.resolve({ id: media.id }) });
      expect(res.status).toBe(200);

      // Verify deletion in DB and Vault
      const checkDb = await prisma.uploadedMedia.findUnique({ where: { id: media.id } });
      expect(checkDb).toBeNull();

      const checkVault = await privateStorageVault.getFile(key);
      expect(checkVault).toBeNull();
    });
  });

  describe('6. Voice Conversation Workflow & Speech-to-Text Transcription', () => {
    it('transcribes valid audio recording, saves to vault, and returns structured transcript', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const audioBuffer = createValidWebmAudioBuffer();
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'spoken_symptoms.webm');
      formData.append('durationSeconds', '14');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/voice/transcribe', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await transcribeVoiceEndpoint(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.transcript).toContain('rash');
      expect(json.extractedEntities.length).toBeGreaterThan(0);
      expect(json.confidence).toBeGreaterThanOrEqual(90);
      expect(json.mediaId).toBeDefined();

      // Verify database record was created with modality VOICE_RECORDING
      const savedMedia = await prisma.uploadedMedia.findUnique({
        where: { id: json.mediaId },
      });
      expect(savedMedia).not.toBeNull();
      expect(savedMedia!.modality).toBe('VOICE_RECORDING');
      expect(savedMedia!.processingStatus).toBe('ANALYZED');

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: json.mediaId } });
      await privateStorageVault.deleteFile(savedMedia!.storageKey);
    });

    it('handles silence detection with 422 status and helpful guidance', async () => {
      setSpeechToTextProviderOverride(new MockSpeechToTextProvider('SILENCE'));

      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const audioBuffer = createValidWebmAudioBuffer();
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'silence.webm');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/voice/transcribe', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await transcribeVoiceEndpoint(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.error).toBe('SILENCE_DETECTED');
      expect(json.message).toContain('No clear speech detected');

      // Clean up
      if (json.mediaId) {
        await prisma.uploadedMedia.delete({ where: { id: json.mediaId } });
      }
    });

    it('handles provider transcription errors gracefully without crashing or faking results', async () => {
      setSpeechToTextProviderOverride(new MockSpeechToTextProvider('ERROR'));

      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      const audioBuffer = createValidWebmAudioBuffer();
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
      formData.append('audio', audioBlob, 'error.webm');

      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const req = new NextRequest('http://localhost:3000/api/voice/transcribe', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const res = await transcribeVoiceEndpoint(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe('TRANSCRIPTION_FAILED');

      // Clean up
      if (json.mediaId) {
        await prisma.uploadedMedia.delete({ where: { id: json.mediaId } });
      }
    });
  });

  describe('7. Assessment Pipeline Integration with Media & Voice', () => {
    it('associates uploaded media and voice transcript with created TriageSession', async () => {
      const patient = await prisma.patientProfile.findFirstOrThrow({
        include: { user: true },
      });

      // 1. Create a media item first
      const mediaKey = `patients/${patient.id}/encounter-linked.png`;
      const pngBuffer = createValidPngBuffer();
      await privateStorageVault.saveFile(mediaKey, pngBuffer);

      const media = await prisma.uploadedMedia.create({
        data: {
          patientProfileId: patient.id,
          fileName: 'linked_photo.png',
          fileSizeBytes: pngBuffer.length,
          mimeType: 'image/png',
          storageKey: mediaKey,
          modality: 'CLINICAL_IMAGE',
          processingStatus: 'ANALYZED',
          isSeedFixture: false,
        },
      });

      // 2. Submit assessment with mediaIds and voiceTranscript
      const authHeaders = await makeAuthHeaders(patient.userId, patient.user.email, 'PATIENT', patient.user.name);
      const voiceTranscript = 'Patient reported localized erythema on right lateral forearm after gardening.';

      const req = new NextRequest('http://localhost:3000/api/assessments', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chiefComplaint: 'Erythematous rash on lateral forearm',
          includeEhrContext: true,
          voiceTranscript,
          mediaIds: [media.id],
        }),
      });

      const res = await createAssessmentEndpoint(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.session.id).toBeDefined();

      // 3. Verify TriageSession has voiceTranscript persisted
      const sessionInDb = await prisma.triageSession.findUnique({
        where: { id: json.session.id },
        include: { uploadedMedia: true },
      });
      expect(sessionInDb!.voiceTranscript).toBe(voiceTranscript);

      // 4. Verify Media is linked to this TriageSession
      expect(sessionInDb!.uploadedMedia.length).toBe(1);
      expect(sessionInDb!.uploadedMedia[0].id).toBe(media.id);

      // Clean up
      await prisma.uploadedMedia.delete({ where: { id: media.id } });
      await prisma.triageSession.delete({ where: { id: json.session.id } });
      await privateStorageVault.deleteFile(mediaKey);
    });
  });
});
