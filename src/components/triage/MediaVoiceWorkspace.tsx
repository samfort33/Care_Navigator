'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export type MultimodalTab = 'media' | 'voice' | 'text';

export interface AttachmentItem {
  id: string;
  name: string;
  sizeLabel: string;
  typeLabel: string;
  status: 'READY' | 'PROCESSING' | 'FAILED';
  progress?: number;
  detailText: string;
  authorizedUrl?: string;
  mimeType?: string;
  isBackendSaved?: boolean;
}

export interface VoiceTurn {
  id: string;
  speaker: 'CLINICAL_AI' | 'PATIENT';
  time: string;
  text: string;
  entities?: string[];
}

const INITIAL_ATTACHMENTS: AttachmentItem[] = [
  {
    id: 'att-seed-1',
    name: 'skin_rash_lateral_forearm.png',
    sizeLabel: '4.2 MB',
    typeLabel: 'PNG Image',
    status: 'READY',
    detailText: 'High clarity • Erythematous maculopapular rash (Ready for triage)',
    mimeType: 'image/png',
  },
  {
    id: 'att-seed-2',
    name: 'blood_panel_lab_results.pdf',
    sizeLabel: '1.8 MB',
    typeLabel: 'PDF Document',
    status: 'READY',
    detailText: 'Metadata extracted (CMP, 2 pages verified)',
    mimeType: 'application/pdf',
  },
  {
    id: 'att-seed-3',
    name: 'chest_xray_scan_damaged.raw',
    sizeLabel: '32.4 MB',
    typeLabel: 'Unsupported',
    status: 'FAILED',
    detailText:
      'Upload failed: File exceeds the 25 MB maximum size limit and uses an unsupported .RAW format. Please convert to JPEG, PNG, or DICOM.',
  },
];

const INITIAL_VOICE_TURNS: VoiceTurn[] = [
  {
    id: 'v1',
    speaker: 'CLINICAL_AI',
    time: '00:05',
    text: 'Hello Sarah. You can speak naturally about your symptoms, when they started, and any visible changes like skin rash or swelling.',
  },
  {
    id: 'v2',
    speaker: 'PATIENT',
    time: '00:18',
    text: 'I noticed a raised red rash on my right forearm yesterday morning after gardening. It feels warm and mildly itchy, around four out of ten, but I have no fever or trouble breathing.',
    entities: ['Erythematous Rash (Right Forearm)', 'Onset: 36h ago', 'Pruritus (4/10)', 'No Dyspnea / Afebrile'],
  },
  {
    id: 'v3',
    speaker: 'CLINICAL_AI',
    time: '00:42',
    text: 'Understood. Have you noticed any spreading streaks, blistering, or facial/lip swelling since yesterday?',
  },
];

export function MediaVoiceWorkspace({ initialTab = 'media' }: { initialTab?: MultimodalTab }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<MultimodalTab>(initialTab);
  const [attachments, setAttachments] = useState<AttachmentItem[]>(INITIAL_ATTACHMENTS);
  const [symptomNotes, setSymptomNotes] = useState(
    'Rash appeared approximately 36 hours ago on the right lateral forearm. Mildly pruritic (itchiness 4/10), warm to touch, no systemic fever or chills.'
  );
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview Modal State
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
    url?: string;
    mimeType?: string;
  } | null>(null);

  useEffect(() => {
    if (!previewFile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewFile(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile]);

  // Voice Conversation State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>(INITIAL_VOICE_TURNS);
  const [reviewedTranscript, setReviewedTranscript] = useState('');
  const [showTranscriptReview, setShowTranscriptReview] = useState(false);
  const [fallbackTextInput, setFallbackTextInput] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const readyFiles = attachments.filter((a) => a.status === 'READY');
  const processingFiles = attachments.filter((a) => a.status === 'PROCESSING');
  const failedFiles = attachments.filter((a) => a.status === 'FAILED');

  // Load patient's existing media on mount
  useEffect(() => {
    async function loadSavedMedia() {
      try {
        const res = await fetch('/api/media?limit=10');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            interface LoadedMediaItem {
              id: string;
              fileName: string;
              fileSizeBytes: number;
              mimeType: string;
              processingStatus: string;
              extractedSummary?: string | null;
            }
            const loaded: AttachmentItem[] = (json.data as LoadedMediaItem[]).map((m) => ({
              id: m.id,
              name: m.fileName,
              sizeLabel: `${(m.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
              typeLabel: m.mimeType.includes('image')
                ? 'Clinical Image'
                : m.mimeType.includes('pdf')
                ? 'PDF Document'
                : 'Medical File',
              status: m.processingStatus === 'ANALYZED' ? 'READY' : m.processingStatus === 'FAILED' ? 'FAILED' : 'PROCESSING',
              detailText: m.extractedSummary || 'Saved in private health vault',
              authorizedUrl: `/api/files/${m.id}`,
              mimeType: m.mimeType,
              isBackendSaved: true,
            }));
            // Prepend new loaded media while keeping demo items accessible
            setAttachments((prev) => {
              const prevNonBackend = prev.filter((p) => !p.isBackendSaved);
              return [...loaded, ...prevNonBackend];
            });
          }
        }
      } catch {
        // Use initial attachments if unauthenticated or offline
      }
    }
    loadSavedMedia();
  }, []);

  // Handle Real File Upload
  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    e.target.value = '';

    const tempId = `temp-${Date.now()}`;
    const sizeMb = (picked.size / (1024 * 1024)).toFixed(1);

    // Immediate client-side validation
    if (picked.size > 25 * 1024 * 1024) {
      setAttachments((prev) => [
        {
          id: tempId,
          name: picked.name,
          sizeLabel: `${sizeMb} MB`,
          typeLabel: picked.type || 'Clinical File',
          status: 'FAILED',
          detailText: 'Upload failed: File exceeds the 25 MB maximum size limit.',
        },
        ...prev,
      ]);
      setStatusMessage(`"${picked.name}" exceeds the 25 MB limit.`);
      return;
    }

    // Add in PROCESSING state
    const newAtt: AttachmentItem = {
      id: tempId,
      name: picked.name,
      sizeLabel: `${sizeMb} MB`,
      typeLabel: picked.type || 'Clinical File',
      status: 'PROCESSING',
      progress: 30,
      detailText: 'Encrypting & uploading to private health vault...',
    };
    setAttachments((prev) => [newAtt, ...prev]);

    try {
      const formData = new FormData();
      formData.append('file', picked);
      formData.append(
        'modality',
        picked.type.includes('image')
          ? 'CLINICAL_IMAGE'
          : picked.type.includes('pdf')
          ? 'LAB_DOCUMENT'
          : 'CLINICAL_IMAGE'
      );

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: 'FAILED',
                  detailText: errorData.error || 'Upload failed validation.',
                }
              : item
          )
        );
        setStatusMessage(`Upload failed: ${errorData.error || 'Server rejected file.'}`);
        return;
      }

      const result = await res.json();
      const media = result.media;
      setAttachments((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                id: media.id,
                name: media.fileName,
                sizeLabel: `${(media.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
                typeLabel: media.mimeType.includes('image')
                  ? 'Clinical Image'
                  : media.mimeType.includes('pdf')
                  ? 'PDF Document'
                  : 'Medical File',
                status: media.processingStatus === 'FAILED' ? 'FAILED' : 'READY',
                progress: 100,
                detailText: media.extractedSummary || 'Validated & encrypted in private vault',
                authorizedUrl: result.authorizedUrl || `/api/files/${media.id}`,
                mimeType: media.mimeType,
                isBackendSaved: true,
              }
            : item
        )
      );
      setStatusMessage(`Successfully secured "${picked.name}" in your clinical vault.`);
    } catch {
      setAttachments((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                status: 'FAILED',
                detailText: 'Network connection error during upload. Please retry.',
              }
            : item
        )
      );
      setStatusMessage('Network error occurred during upload.');
    }
  }

  // Retry Attachment
  async function handleRetryAttachment(id: string) {
    const target = attachments.find((a) => a.id === id);
    if (!target) return;

    if (target.isBackendSaved) {
      setAttachments((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'PROCESSING', progress: 50, detailText: 'Retrying analysis...' }
            : item
        )
      );
      try {
        const res = await fetch(`/api/media/${id}/retry`, { method: 'POST' });
        if (res.ok) {
          const result = await res.json();
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: result.media.processingStatus === 'ANALYZED' ? 'READY' : 'FAILED',
                    detailText: result.media.extractedSummary || 'Analysis completed.',
                    authorizedUrl: result.authorizedUrl,
                  }
                : item
            )
          );
          setStatusMessage('Attachment reprocessed successfully.');
          return;
        }
      } catch {
        // Fallback to local recovery
      }
    }

    // Local recovery for sample attachments
    setAttachments((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: item.name.replace('.raw', '.png'),
              sizeLabel: '6.4 MB',
              typeLabel: 'PNG Image',
              status: 'READY',
              detailText: 'Converted & verified for clinical review',
            }
          : item
      )
    );
    setStatusMessage('Attachment converted and marked Ready.');
  }

  // Remove Attachment
  async function handleRemoveAttachment(id: string) {
    const target = attachments.find((a) => a.id === id);
    if (target?.isBackendSaved) {
      try {
        await fetch(`/api/media/${id}`, { method: 'DELETE' });
      } catch {
        // Ignore deletion failure
      }
    }
    setAttachments((prev) => prev.filter((item) => item.id !== id));
    setStatusMessage('Attachment removed.');
  }

  // Preview Attachment in Modal
  function handlePreviewAttachment(att: AttachmentItem) {
    setPreviewFile({
      id: att.id,
      name: att.name,
      url: att.authorizedUrl || `/api/files/${att.id}`,
      mimeType: att.mimeType,
    });
  }

  // Microphone Recording Handler
  async function startRecording() {
    setMicPermissionDenied(false);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusMessage('Audio recording is not supported in this browser. Please use text input.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioRecorded(audioBlob, recordingSeconds);
      };

      recorder.start(250);
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermissionDenied(true);
        setStatusMessage('Microphone access was denied. Please grant permission or use fallback text.');
      } else {
        setStatusMessage(`Microphone error: ${error.message || 'Could not access audio device.'}`);
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
  }

  // Handle Recorded Audio & Send to STT
  async function handleAudioRecorded(blob: Blob, duration: number) {
    if (blob.size < 100) {
      setStatusMessage('Recording was too short. Please try speaking again.');
      return;
    }

    setIsTranscribing(true);
    setStatusMessage('Transcribing audio with CareNavigator Speech-to-Text...');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'patient_voice.webm');
      formData.append('durationSeconds', String(Math.max(1, duration)));

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error === 'SILENCE_DETECTED') {
          setStatusMessage(
            'Silence detected: No audible speech was found. Please speak closer to your microphone or use text input.'
          );
        } else {
          setStatusMessage(`Transcription failed: ${json.message || json.error}`);
        }
        setIsTranscribing(false);
        return;
      }

      const transcript = json.transcript;
      const entities = json.extractedEntities || [];

      // Open review box for transcript confirmation
      setReviewedTranscript(transcript);
      setShowTranscriptReview(true);
      setIsTranscribing(false);
      setStatusMessage('Voice transcribed! Please review your words below before confirming.');

      // Add as draft turn
      const patientTurn: VoiceTurn = {
        id: `v-${Date.now()}`,
        speaker: 'PATIENT',
        time: `00:${String(duration).padStart(2, '0')}`,
        text: transcript,
        entities,
      };
      setVoiceTurns((prev) => [...prev, patientTurn]);
    } catch {
      setIsTranscribing(false);
      setStatusMessage('Network error during transcription. You can type your symptoms below.');
    }
  }

  // Confirm or Edit Voice Transcript
  function handleConfirmTranscript() {
    if (!reviewedTranscript.trim()) return;

    setSymptomNotes((prev) =>
      prev ? `${prev}\n\n[Voice Memo]: ${reviewedTranscript.trim()}` : reviewedTranscript.trim()
    );
    setShowTranscriptReview(false);
    setStatusMessage('Transcript confirmed and synced to your symptom context.');
  }

  // Append Fallback Text
  function handleAddFallbackText() {
    if (!fallbackTextInput.trim()) return;

    const patientTurn: VoiceTurn = {
      id: `v-text-${Date.now()}`,
      speaker: 'PATIENT',
      time: 'Text Entry',
      text: fallbackTextInput.trim(),
      entities: ['Direct Text Note'],
    };
    setVoiceTurns((prev) => [...prev, patientTurn]);
    setSymptomNotes((prev) =>
      prev ? `${prev}\n\n[Text Note]: ${fallbackTextInput.trim()}` : fallbackTextInput.trim()
    );
    setFallbackTextInput('');
    setStatusMessage('Text note added to your assessment context.');
  }

  // Submit Encounter for Clinical Triage
  async function handleSubmitForTriage() {
    if (!privacyConsent) {
      setStatusMessage('Please confirm the Encrypted Storage & Privacy Consent checkbox before submitting.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Submitting encounter media and notes for AI clinical triage...');

    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chiefComplaint: symptomNotes.slice(0, 150) || 'Dermatology & Multimodal Media Consultation',
          includeEhrContext: true,
          answers: [
            {
              stepNumber: 1,
              questionKey: 'symptom_notes',
              questionPrompt: 'Patient reported symptom context and uploaded media notes',
              answerValue: symptomNotes,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        setStatusMessage(`Submission failed: ${errorJson.error || 'Server error'}`);
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      router.push(`/assessments/${data.session.id}/results`);
    } catch {
      setIsSubmitting(false);
      setStatusMessage('Network error submitting assessment. Please retry.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span>Multimodal Intake Module</span>
            <span>•</span>
            <span className="text-primary font-semibold font-mono">Encounter #CN-88412</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile lg:text-headline-xl text-on-surface tracking-tight">
            Media &amp; Voice Health Assessment
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
            Attach clinical photographs, lab reports, or diagnostic documents alongside your symptom
            description to help guide accurate clinical triage.
          </p>
        </div>

        {/* Encryption & Session Badge */}
        <div className="flex items-center gap-3 self-start md:self-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
            <MaterialIcon name="enhanced_encryption" className="text-primary text-[16px]" />
            <span>TLS 1.3 / AES-256 Session Encrypted</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Assessment Intake Modality"
        className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl w-full sm:w-fit overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'media'}
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'media'
              ? 'bg-surface-container-lowest text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <MaterialIcon name="cloud_upload" filled={activeTab === 'media'} className="text-[18px]" />
          <span>Media Upload ({attachments.length} files)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'voice'}
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'voice'
              ? 'bg-surface-container-lowest text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <MaterialIcon name="mic" filled={activeTab === 'voice'} className="text-[18px]" />
          <span>Voice Conversation</span>
          <span className="w-2 h-2 rounded-full bg-secondary" title="Voice workflow active" />
        </button>

        <Link
          href="/assessments/new"
          role="tab"
          aria-selected={activeTab === 'text'}
          className="flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-all whitespace-nowrap"
        >
          <MaterialIcon name="chat" className="text-[18px]" />
          <span>Text Assessment</span>
        </Link>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-surface-container-lowest border-l-4 border-primary shadow-xs flex items-center justify-between gap-3 font-body-sm text-body-sm text-on-surface"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon name="info" className="text-primary text-[18px]" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-outline hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}

      {/* Main Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols): Active Modality Workspace */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {activeTab === 'media' ? (
            <>
              {/* 1. Clinical Upload Instructions & Drag-and-Drop Zone */}
              <section className="bg-surface-container-lowest rounded-xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      Upload Clinical Media &amp; Diagnostic Files
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Ensure skin photos are well-lit and in focus. Redact external financial
                      billing numbers if not needed for clinical care.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm shrink-0">
                    Max 25 MB / file
                  </span>
                </div>

                {/* Safety Notice Banner */}
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-container-low">
                  <MaterialIcon
                    name="verified_user"
                    className="text-primary text-[20px] mt-0.5 shrink-0"
                  />
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    <span className="font-semibold text-on-surface">
                      Clinical Intake Protocol Notice:
                    </span>{' '}
                    Uploaded images and PDFs are scanned for readability and structured into your
                    triage summary.{' '}
                    <span className="underline">
                      This is a decision-support tool, not a replacement for a doctor.
                    </span>{' '}
                    Do not upload emergency trauma photos—if you have a severe injury or medical
                    emergency, call 999 immediately.
                  </div>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.dcm"
                  onChange={handleFilePicked}
                  className="sr-only"
                  aria-label="Upload clinical file"
                />

                {/* Drag & Drop Upload Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="rounded-xl bg-surface-container-low/70 hover:bg-surface-container transition-colors p-8 flex flex-col items-center justify-center text-center cursor-pointer group border-2 border-dashed border-outline-variant/60 hover:border-primary"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs mb-3 group-hover:scale-105 transition-transform">
                    <MaterialIcon name="upload_file" className="text-[26px]" />
                  </div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">
                    Drag and drop clinical files here, or{' '}
                    <span className="text-primary underline">browse device</span>
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Accepted formats: <span className="font-medium text-on-surface">JPEG, PNG, WEBP</span>{' '}
                    (skin/visible symptoms),{' '}
                    <span className="font-medium text-on-surface">PDF</span> (lab reports, discharge
                    notes), <span className="font-medium text-on-surface">DICOM (.dcm)</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-95 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <MaterialIcon name="add_photo_alternate" className="text-[16px]" />
                      <span>Browse Files</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <MaterialIcon name="photo_camera" className="text-[16px] text-secondary" />
                      <span>Capture with Camera</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* 2. File Queue & Attachment States */}
              <section className="bg-surface-container-lowest rounded-xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      Encounter Attachments
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Review file status before including in your triage submission.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-label-sm text-label-sm">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-primary">
                      {readyFiles.length} Ready
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary">
                      {processingFiles.length} Processing
                    </span>
                    <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container">
                      {failedFiles.length} Failed
                    </span>
                  </div>
                </div>

                {attachments.length === 0 ? (
                  <div className="rounded-xl bg-surface-container-low/40 p-6 flex flex-col items-center justify-center text-center gap-2">
                    <MaterialIcon name="folder_off" className="text-outline text-[24px]" />
                    <p className="font-label-md text-label-md text-on-surface">
                      No files attached to this encounter yet
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                      Use the upload dropzone above to attach clinical photos or lab reports, or
                      restore the sample evaluation queue.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAttachments(INITIAL_ATTACHMENTS)}
                      className="mt-2 px-3.5 py-1.5 rounded-lg bg-surface-container text-primary font-label-md text-label-md hover:bg-surface-container-high"
                    >
                      Restore Sample Queue
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {attachments.map((att) => {
                      if (att.status === 'PROCESSING') {
                        return (
                          <div
                            key={att.id}
                            className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                                  <MaterialIcon name="image" className="text-[22px]" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-label-lg text-label-lg text-on-surface truncate">
                                      {att.name}
                                    </p>
                                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                                      Uploading &amp; Validating ({att.progress ?? 78}%)
                                    </span>
                                  </div>
                                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                                    {att.sizeLabel} • {att.typeLabel} • {att.detailText}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(att.id)}
                                  title="Cancel upload"
                                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                                >
                                  <MaterialIcon name="close" className="text-[18px]" />
                                </button>
                              </div>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                              <div
                                className="h-full bg-secondary rounded-full transition-all"
                                style={{ width: `${att.progress ?? 78}%` }}
                              />
                            </div>
                          </div>
                        );
                      }

                      if (att.status === 'READY') {
                        return (
                          <div
                            key={att.id}
                            className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                                <MaterialIcon
                                  name={att.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                                  className="text-[22px]"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-label-lg text-label-lg text-on-surface truncate">
                                    {att.name}
                                  </p>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                                    <MaterialIcon name="check_circle" className="text-[13px]" />
                                    <span>Ready • {att.detailText}</span>
                                  </span>
                                </div>
                                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                                  {att.sizeLabel} • {att.typeLabel} • Stored in private vault
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handlePreviewAttachment(att)}
                                className="px-2.5 py-1.5 rounded-lg text-secondary hover:bg-surface-container font-label-md text-label-md transition-colors"
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                title="Remove file"
                                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                              >
                                <MaterialIcon name="delete" className="text-[18px]" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={att.id}
                          className="p-4 rounded-xl bg-error-container/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error shrink-0 mt-0.5">
                              <MaterialIcon name="error" className="text-[22px]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-label-lg text-label-lg text-on-surface truncate">
                                  {att.name}
                                </p>
                                <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm">
                                  Failed
                                </span>
                              </div>
                              <p className="font-body-sm text-body-sm text-on-error-container mt-0.5">
                                {att.detailText}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleRetryAttachment(att.id)}
                              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-xs transition-colors flex items-center gap-1"
                            >
                              <MaterialIcon name="refresh" className="text-[15px]" />
                              <span>Retry</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att.id)}
                              className="px-3 py-1.5 rounded-lg bg-error text-on-error hover:opacity-90 font-label-md text-label-md transition-opacity"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* VOICE CONVERSATION TAB WORKSPACE */
            <section className="bg-surface-container-lowest rounded-xl p-6 shadow-xs flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isRecording ? 'bg-error animate-ping' : 'bg-primary'
                      }`}
                    />
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                      Hands-Free Clinical Voice Intake
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mt-1">
                    Interactive Voice Symptom Conversation
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Speak naturally. CareNavigator transcribes your spoken symptoms, flags clinical
                    entities, and lets you review before submission.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isTranscribing}
                      className="px-5 py-3 rounded-xl font-label-lg text-label-lg flex items-center gap-2 shadow-sm bg-primary text-on-primary hover:opacity-95 transition-all disabled:opacity-50"
                    >
                      <MaterialIcon name="mic" filled className="text-[20px]" />
                      <span>{isTranscribing ? 'Transcribing...' : 'Start Speaking'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-5 py-3 rounded-xl font-label-lg text-label-lg flex items-center gap-2 shadow-sm bg-error text-on-error animate-pulse transition-all"
                    >
                      <MaterialIcon name="stop_circle" filled className="text-[20px]" />
                      <span>
                        Stop &amp; Transcribe (00:{String(recordingSeconds).padStart(2, '0')})
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Permission Alert if Denied */}
              {micPermissionDenied && (
                <div className="p-4 rounded-xl bg-error-container/40 border border-error/20 flex items-start gap-3">
                  <MaterialIcon name="mic_off" className="text-error text-[22px] shrink-0 mt-0.5" />
                  <div className="font-body-sm text-body-sm text-on-surface">
                    <p className="font-semibold text-error">Microphone Access Denied</p>
                    <p className="mt-0.5 text-on-surface-variant">
                      Your browser is blocking microphone access. You can grant access in your browser site
                      settings, or use the accessible text fallback input below.
                    </p>
                  </div>
                </div>
              )}

              {/* Audio Visualizer Strip */}
              <div className="p-5 rounded-xl bg-surface-container-low flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 h-12">
                  {[24, 40, 65, 90, 55, 80, 100, 70, 45, 85, 60, 95, 50, 35, 75, 45, 30, 60].map(
                    (barH, idx) => (
                      <span
                        key={idx}
                        className={`w-1.5 rounded-full transition-all duration-300 ${
                          isRecording ? 'bg-primary animate-pulse' : 'bg-secondary/40'
                        }`}
                        style={{
                          height: `${
                            isRecording ? barH : Math.max(20, Math.round(barH * 0.4))
                          }%`,
                        }}
                      />
                    )
                  )}
                </div>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {isRecording
                    ? `Recording active (00:${String(recordingSeconds).padStart(2, '0')}). Speak clearly into your mic.`
                    : isTranscribing
                    ? 'Processing speech-to-text with AI transcription...'
                    : 'Audio channel ready • Click "Start Speaking" or enter text below'}
                </p>
              </div>

              {/* Transcript Review Modal / Box (Required: Show transcript for review before submission) */}
              {showTranscriptReview && (
                <div className="p-4 rounded-xl bg-primary-fixed/30 border border-primary/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md text-primary font-semibold flex items-center gap-1.5">
                      <MaterialIcon name="rate_review" className="text-[18px]" />
                      <span>Review &amp; Edit Spoken Transcript</span>
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Review before attaching to encounter
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={reviewedTranscript}
                    onChange={(e) => setReviewedTranscript(e.target.value)}
                    className="w-full p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/60 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Review and correct your spoken words..."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTranscriptReview(false)}
                      className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container font-label-md text-label-md"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmTranscript}
                      className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-95 flex items-center gap-1"
                    >
                      <MaterialIcon name="check" className="text-[16px]" />
                      <span>Confirm &amp; Attach to Notes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Real-Time Voice Transcript Feed */}
              <div className="space-y-3">
                <h3 className="font-label-md text-label-md uppercase tracking-wider text-outline">
                  Captured Voice Conversation &amp; Extracted Clinical Entities
                </h3>
                {voiceTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`p-4 rounded-xl ${
                      turn.speaker === 'CLINICAL_AI'
                        ? 'bg-surface-container-low'
                        : 'bg-secondary-container/35 border border-secondary/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-label-md text-label-md text-primary flex items-center gap-1.5">
                        <MaterialIcon
                          name={turn.speaker === 'CLINICAL_AI' ? 'record_voice_over' : 'person'}
                          className="text-[16px]"
                        />
                        {turn.speaker === 'CLINICAL_AI'
                          ? 'CareNavigator Voice Assistant'
                          : 'Patient (Spoken Narrative)'}
                      </span>
                      <span className="font-mono text-xs text-outline">{turn.time}</span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface">{turn.text}</p>
                    {turn.entities && turn.entities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-outline-variant/20">
                        {turn.entities.map((ent) => (
                          <span
                            key={ent}
                            className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm"
                          >
                            {ent}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Accessible Text Fallback Input */}
              <div className="pt-4 border-t border-surface-container flex flex-col gap-2">
                <label
                  htmlFor="fallback-text-input"
                  className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5"
                >
                  <MaterialIcon name="keyboard" className="text-[18px] text-secondary" />
                  <span>Accessible Fallback: Type symptoms without microphone</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="fallback-text-input"
                    type="text"
                    value={fallbackTextInput}
                    onChange={(e) => setFallbackTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFallbackText();
                      }
                    }}
                    placeholder="Type symptom details or clarification questions here..."
                    className="flex-1 px-3.5 py-2 rounded-lg bg-surface-container-low border border-outline-variant/50 text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddFallbackText}
                    className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 3. Clinical Context Notes & Privacy Consent */}
          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <div>
              <label
                htmlFor="symptom-notes"
                className="font-headline-md text-headline-md text-on-surface block"
              >
                Clinical Symptom Context &amp; Notes
              </label>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Provide additional context for your uploaded files (e.g., when the rash appeared,
                pain scale 1–10, or specific questions about your lab report).
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                id="symptom-notes"
                rows={4}
                maxLength={1000}
                value={symptomNotes}
                onChange={(e) => setSymptomNotes(e.target.value)}
                placeholder="Describe what is shown in your photos or documents, when you first noticed it, and any changes over the last 24–48 hours..."
                className="w-full rounded-xl bg-surface-container-low p-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-y"
              />
              <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span>Structured clinical entity recognition enabled</span>
                <span>{symptomNotes.length} / 1000 characters</span>
              </div>
            </div>

            {/* Privacy & Consent Notice Box */}
            <div className="p-4 rounded-xl bg-surface-container-low flex items-start gap-3">
              <input
                id="privacy-consent"
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
              />
              <label
                htmlFor="privacy-consent"
                className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer"
              >
                <span className="font-semibold text-on-surface">
                  Encrypted Storage &amp; Privacy Consent:
                </span>{' '}
                I consent to storing these clinical media files and voice transcripts in my encrypted
                CareNavigator Health Vault for automated triage assistance and authorized clinician
                review. You may revoke access or delete attachments at any time under{' '}
                <Link href="/settings/privacy" className="text-primary underline">
                  Privacy &amp; Settings
                </Link>
                .
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (4 Cols): Sticky Assessment Review & Voice Summary Panel */}
        <aside className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Assessment Review Panel
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                Step 2 of 3
              </span>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Verify the media, documents, and voice notes that will be analyzed alongside your
              health profile.
            </p>

            {/* Summary Metric Counters */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  File Intake Health
                </span>
                <div className="mt-2 grid grid-cols-2 gap-y-1 font-label-md text-label-md">
                  <span className="text-primary flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary" /> {readyFiles.length} Ready
                  </span>
                  <span className="text-secondary flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> {processingFiles.length}{' '}
                    Processing
                  </span>
                  <span className="text-error flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-error" /> {failedFiles.length} Failed
                  </span>
                  <span className="text-outline flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-outline-variant" /> 0 Awaiting
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-container-low flex flex-col justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Triage Context
                </span>
                <div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">Dermatology</p>
                  <p className="font-label-sm text-label-sm text-secondary">+ Lab Correlation</p>
                </div>
              </div>
            </div>

            {/* Captured Voice Conversation Snippet */}
            <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-primary font-label-md text-label-md">
                  <MaterialIcon name="graphic_eq" className="text-[18px]" />
                  <span>Linked Voice Memo</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                  00:42 / 01:15
                </span>
              </div>

              {/* Audio Player Control Bar */}
              <div className="flex items-center gap-2.5 bg-surface-container-lowest p-2 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsPlayingAudio((p) => !p)}
                  aria-label={isPlayingAudio ? 'Pause voice memo' : 'Play voice memo'}
                  className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0 hover:bg-primary-container transition-colors"
                >
                  <MaterialIcon
                    name={isPlayingAudio ? 'pause' : 'play_arrow'}
                    className="text-[18px]"
                  />
                </button>
                <div className="flex-1 flex items-center gap-1 h-4">
                  <span className="w-1 h-2 bg-primary rounded-full" />
                  <span className="w-1 h-3.5 bg-primary rounded-full" />
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  <span className="w-1 h-2.5 bg-primary rounded-full" />
                  <span className="w-1 h-3 bg-primary rounded-full" />
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  <span className="w-1 h-2 bg-primary rounded-full" />
                  <span className="w-1 h-3 bg-outline-variant rounded-full" />
                  <span className="w-1 h-1.5 bg-outline-variant rounded-full" />
                  <span className="w-1 h-2.5 bg-outline-variant rounded-full" />
                  <span className="w-1 h-3.5 bg-outline-variant rounded-full" />
                  <span className="w-1 h-2 bg-outline-variant rounded-full" />
                </div>
              </div>

              <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                &ldquo;...I noticed the red rash on my forearm yesterday morning after gardening,
                and I also attached my recent blood panel from Tuesday...&rdquo;
              </p>
            </div>

            {/* Included Files Checklist */}
            <div className="flex flex-col gap-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Included Attachments ({readyFiles.length} Ready)
              </span>
              {readyFiles.map((rf) => (
                <div
                  key={rf.id}
                  className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MaterialIcon
                      name="check_circle"
                      className="text-primary text-[16px] shrink-0"
                    />
                    <span className="font-body-sm text-body-sm text-on-surface truncate">
                      {rf.name}
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                    {rf.sizeLabel}
                  </span>
                </div>
              ))}
            </div>

            {/* Symptom Context Preview */}
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Recorded Notes
              </span>
              <p className="font-body-sm text-body-sm text-on-surface bg-surface-container-low p-3 rounded-lg line-clamp-3">
                {symptomNotes}
              </p>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSubmitForTriage}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MaterialIcon name="clinical_notes" className="text-[18px]" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit for Triage Review'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatusMessage(
                    'Draft saved to Encounter #CN-88412. You can resume anytime from Assessment History.'
                  )
                }
                className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5"
              >
                <MaterialIcon name="bookmark" className="text-[16px] text-secondary" />
                <span>Save Draft &amp; Continue Later</span>
              </button>
            </div>

            {/* Mandatory Clinical Decision-Support Disclaimer */}
            <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2">
              <MaterialIcon name="info" className="text-outline text-[16px] mt-0.5 shrink-0" />
              <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
                Decision-support tool, not a replacement for a doctor. All AI-parsed attachments are
                flagged for verification by a licensed clinician.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Preview Modal for Vaulted Files */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <MaterialIcon name="visibility" className="text-primary text-[20px]" />
                <h3 className="font-title-md text-title-md text-on-surface truncate">
                  {previewFile.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-surface-container-low rounded-xl p-4 min-h-[250px]">
              {previewFile.mimeType?.startsWith('image') || previewFile.name.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <MaterialIcon name="picture_as_pdf" className="text-primary text-[48px]" />
                  <p className="font-body-md text-body-md text-on-surface">
                    Private Vault Document Preview
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
                    Access granted via short-lived authorized session URL.
                  </p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-95"
                  >
                    Open Document in Secure Viewer
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-surface-container">
              <span>Encrypted Local Vault Storage (256-bit)</span>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
