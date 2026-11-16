import { GoogleGenAI } from '@google/genai';
import { isGeminiConfigured, env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  type SpeechToTextProvider,
  type SpeechTranscriptionResult,
  type SpeechToTextOptions,
  SpeechToTextError,
  SilenceDetectedError,
  SpeechProviderUnavailableError,
} from './types';

/**
 * Production Gemini Audio Speech-to-Text adapter.
 */
export class GeminiSpeechToTextProvider implements SpeechToTextProvider {
  public readonly providerName = 'google-gemini-audio';
  public readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName?: string, apiKey?: string) {
    this.modelName = modelName || env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.apiKey = apiKey ?? env.GEMINI_API_KEY;
  }

  isAvailable(): boolean {
    return isGeminiConfigured({
      ...process.env,
      GEMINI_API_KEY: this.apiKey,
    });
  }

  async transcribe(audioBuffer: Buffer, options?: SpeechToTextOptions): Promise<SpeechTranscriptionResult> {
    if (!this.isAvailable()) {
      throw new SpeechProviderUnavailableError(
        'Speech-to-text service requires GEMINI_API_KEY to be configured in server environment.'
      );
    }

    const mimeType = options?.mimeType || 'audio/webm';
    const base64Audio = audioBuffer.toString('base64');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: `You are CareNavigator Clinical Speech-to-Text Transcriber.
Transcribe the spoken patient symptoms accurately, verbatim, without alteration.
If the audio contains no discernible speech, or is pure background silence or static, return {"isSilence": true, "transcript": "", "extractedEntities": [], "confidence": 0}.
Otherwise, transcribe the audio and extract 2-4 key clinical symptom entities.
Return strictly JSON with this schema:
{
  "transcript": string,
  "isSilence": boolean,
  "extractedEntities": string[],
  "confidence": number
}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      if (parsed.isSilence || !parsed.transcript || parsed.transcript.trim().length === 0) {
        throw new SilenceDetectedError('No clear speech was detected in the audio recording.');
      }

      return {
        transcript: parsed.transcript.trim(),
        durationSeconds: options?.durationSeconds || 5,
        extractedEntities: Array.isArray(parsed.extractedEntities) ? parsed.extractedEntities : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 92,
        provider: this.providerName,
        modelName: this.modelName,
        isSilence: false,
      };
    } catch (error) {
      if (error instanceof SilenceDetectedError) throw error;
      logger.error('GEMINI_STT_ERROR', error);
      throw new SpeechToTextError(
        `Speech-to-text transcription failed: ${error instanceof Error ? error.message : 'Unknown provider error'}`,
        'STT_EXECUTION_ERROR',
        502
      );
    }
  }
}

export type MockSttScenario = 'SUCCESS' | 'SILENCE' | 'ERROR' | 'UNAVAILABLE';

/**
 * Mock Speech-to-Text adapter for predictable offline automated testing.
 */
export class MockSpeechToTextProvider implements SpeechToTextProvider {
  public readonly providerName = 'mock-stt-adapter';
  public readonly modelName = 'mock-stt-v1';

  constructor(
    private scenario: MockSttScenario = 'SUCCESS',
    private customTranscript?: string
  ) {}

  isAvailable(): boolean {
    return this.scenario !== 'UNAVAILABLE';
  }

  async transcribe(audioBuffer: Buffer, options?: SpeechToTextOptions): Promise<SpeechTranscriptionResult> {
    if (this.scenario === 'UNAVAILABLE') {
      throw new SpeechProviderUnavailableError('Mock STT provider is unavailable.');
    }

    if (this.scenario === 'ERROR') {
      throw new SpeechToTextError('Simulated audio transcription processing failure.', 'SIMULATED_STT_ERROR', 500);
    }

    if (this.scenario === 'SILENCE' || audioBuffer.length < 50) {
      throw new SilenceDetectedError('No clear audible patient speech detected in the recording.');
    }

    const transcript =
      this.customTranscript ||
      'I have noticed a raised erythematous rash on my right lateral forearm since yesterday after gardening. It is warm and mildly itchy, about four out of ten, but I have no trouble breathing or fever.';

    return {
      transcript,
      durationSeconds: options?.durationSeconds || 12,
      extractedEntities: [
        'Erythematous rash (Right forearm)',
        'Onset: Yesterday',
        'Pruritus (4/10)',
        'Afebrile / No dyspnea',
      ],
      confidence: 96,
      provider: this.providerName,
      modelName: this.modelName,
      isSilence: false,
    };
  }
}

let activeSttOverride: SpeechToTextProvider | null = null;

export function setSpeechToTextProviderOverride(provider: SpeechToTextProvider | null): void {
  activeSttOverride = provider;
}

export function getSpeechToTextProvider(): SpeechToTextProvider {
  if (activeSttOverride) {
    return activeSttOverride;
  }

  const configuredProvider = process.env.AI_ASSESSMENT_PROVIDER?.toLowerCase();
  if (configuredProvider === 'mock') {
    return new MockSpeechToTextProvider('SUCCESS');
  }

  return new GeminiSpeechToTextProvider();
}
