export class SpeechToTextError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'STT_ERROR', statusCode = 500) {
    super(message);
    this.name = 'SpeechToTextError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class SilenceDetectedError extends SpeechToTextError {
  constructor(message = 'No audible patient speech was detected in the recording.') {
    super(message, 'SILENCE_DETECTED', 422);
  }
}

export class SpeechProviderUnavailableError extends SpeechToTextError {
  constructor(message = 'Speech-to-text service is currently unconfigured or unavailable.') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}

export interface SpeechTranscriptionResult {
  transcript: string;
  durationSeconds: number;
  extractedEntities: string[];
  confidence: number;
  provider: string;
  modelName: string;
  isSilence: boolean;
}

export interface SpeechToTextOptions {
  mimeType?: string;
  durationSeconds?: number;
  patientContext?: string;
}

export interface SpeechToTextProvider {
  readonly providerName: string;
  readonly modelName: string;
  transcribe(audioBuffer: Buffer, options?: SpeechToTextOptions): Promise<SpeechTranscriptionResult>;
  isAvailable(): boolean;
}
