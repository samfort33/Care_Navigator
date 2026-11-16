import { GoogleGenAI } from '@google/genai';
import { isGeminiConfigured, env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { callOllamaChat } from '@/server/ai/ollama-client';

export interface MediaAnalysisResult {
  status: 'ANALYZED' | 'FAILED' | 'UNSUPPORTED_FORMAT';
  extractedSummary: string;
  extractedData: Record<string, unknown>;
  errorMessage?: string;
  isAiGenerated: boolean;
  provider: string;
}

export interface MediaAnalysisProvider {
  readonly providerName: string;
  analyzeMedia(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    modality: 'CLINICAL_IMAGE' | 'LAB_DOCUMENT' | 'VOICE_RECORDING'
  ): Promise<MediaAnalysisResult>;
  isAvailable(): boolean;
}

/**
 * Production Gemini Multimodal Image & Document Analysis Adapter.
 */
export class GeminiMediaAnalysisProvider implements MediaAnalysisProvider {
  public readonly providerName = 'google-gemini-multimodal';
  private readonly apiKey: string;
  private readonly modelName: string;

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

  async analyzeMedia(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    modality: 'CLINICAL_IMAGE' | 'LAB_DOCUMENT' | 'VOICE_RECORDING'
  ): Promise<MediaAnalysisResult> {
    // 1. Check supported formats for Gemini multimodal (JPEG, PNG, WEBP, PDF)
    const SUPPORTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!SUPPORTED_MIMES.includes(mimeType)) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        extractedSummary: `Format "${mimeType}" is preserved in private vault for clinician review. Automated AI analysis is unsupported for this format.`,
        extractedData: { formatSupported: false, fileName, mimeType },
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    if (!this.isAvailable()) {
      return {
        status: 'FAILED',
        extractedSummary: 'File uploaded and secured in private vault. AI multimodal analysis is unavailable (credentials not configured).',
        extractedData: {},
        errorMessage: 'GEMINI_API_KEY not configured.',
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const prompt =
        modality === 'CLINICAL_IMAGE'
          ? `You are CareNavigator Clinical Image Observer.
Inspect the attached clinical photograph and provide objective visual observations for a reviewing clinician.
Do NOT make a definitive diagnosis.
Format your output as JSON:
{
  "summary": "Objective description of visible skin features, color, margin, and anatomical location",
  "observations": ["observation 1", "observation 2"],
  "qualityCheck": "ADEQUATE" | "SUBOPTIMAL",
  "recommendedAction": "e.g. In-person dermatology exam"
}`
          : `You are CareNavigator Lab Document Observer.
Inspect the attached medical/lab document and extract objective metadata.
Format your output as JSON:
{
  "summary": "Document overview",
  "detectedType": "e.g. Complete Blood Count (CBC) or Metabolic Panel",
  "keyFindings": ["finding 1", "finding 2"],
  "abnormalFlagsPresent": boolean
}`;

      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString('base64'),
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return {
        status: 'ANALYZED',
        extractedSummary: parsed.summary || `Multimodal analysis completed for ${fileName}.`,
        extractedData: parsed,
        isAiGenerated: true,
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('GEMINI_MEDIA_ANALYSIS_ERROR', error);
      return {
        status: 'FAILED',
        extractedSummary: `Automated analysis for ${fileName} failed. File remains securely vaulted for clinician inspection.`,
        extractedData: {},
        errorMessage: error instanceof Error ? error.message : 'Media analysis failed.',
        isAiGenerated: false,
        provider: this.providerName,
      };
    }
  }
}

/** Local MedGemma image observer for supported clinical photos; PDFs and audio stay unsupported. */
export class OllamaMedGemmaMediaProvider implements MediaAnalysisProvider {
  public readonly providerName = 'ollama-medgemma-vision';

  isAvailable(): boolean {
    return Boolean(env.OLLAMA_MODEL.trim() && env.OLLAMA_BASE_URL);
  }

  async analyzeMedia(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    modality: 'CLINICAL_IMAGE' | 'LAB_DOCUMENT' | 'VOICE_RECORDING'
  ): Promise<MediaAnalysisResult> {
    if (modality !== 'CLINICAL_IMAGE' || !['image/jpeg', 'image/png'].includes(mimeType)) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        extractedSummary: 'MedGemma local image analysis currently supports JPEG and PNG clinical photos only. The file remains securely stored for clinician review.',
        extractedData: { formatSupported: false, fileName, mimeType },
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    if (!this.isAvailable()) {
      return {
        status: 'FAILED',
        extractedSummary: 'File is secured in the private vault. Local MedGemma is not configured.',
        extractedData: {},
        errorMessage: 'Configure Ollama and the MedGemma model to analyze images.',
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    try {
      const content = await callOllamaChat({
        model: env.OLLAMA_MODEL,
        system: 'You are a clinical image observer providing non-diagnostic decision support for a licensed clinician. Describe only visible features. Do not identify a disease, prescribe treatment, or claim image quality can rule out urgent conditions. Return valid JSON only.',
        prompt: `Review this clinical photograph and return JSON with: summary (plain-language objective description), observations (array of visible features), qualityCheck (ADEQUATE or SUBOPTIMAL), and recommendedAction (cautious next step for clinician review). State limitations clearly.`,
        images: [buffer.toString('base64')],
        timeoutMs: env.OLLAMA_TIMEOUT_MS,
      });

      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null || !('summary' in parsed) || typeof parsed.summary !== 'string') {
        throw new Error('Model response did not include a valid summary.');
      }
      return {
        status: 'ANALYZED',
        extractedSummary: parsed.summary,
        extractedData: parsed as Record<string, unknown>,
        isAiGenerated: true,
        provider: this.providerName,
      };
    } catch (error) {
      logger.warn('OLLAMA_MEDIA_ANALYSIS_FAILED', {
        errorType: error instanceof Error ? error.name : 'Unknown local model error',
      });
      return {
        status: 'FAILED',
        extractedSummary: `Local MedGemma analysis for ${fileName} failed. The original file remains securely vaulted for clinician review.`,
        extractedData: {},
        errorMessage: error instanceof Error ? error.message : 'Local image analysis failed.',
        isAiGenerated: false,
        provider: this.providerName,
      };
    }
  }
}

export type MockMediaScenario = 'SUCCESS' | 'FAILED' | 'UNSUPPORTED';

/**
 * Mock Media Analysis Adapter for testing.
 */
export class MockMediaAnalysisProvider implements MediaAnalysisProvider {
  public readonly providerName = 'mock-media-adapter';

  constructor(private scenario: MockMediaScenario = 'SUCCESS') {}

  isAvailable(): boolean {
    return true;
  }

  async analyzeMedia(
    _buffer: Buffer,
    mimeType: string,
    fileName: string,
    modality: 'CLINICAL_IMAGE' | 'LAB_DOCUMENT' | 'VOICE_RECORDING'
  ): Promise<MediaAnalysisResult> {
    if (this.scenario === 'UNSUPPORTED' || mimeType.includes('dicom')) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        extractedSummary: 'File format preserved for clinician review. AI feature extraction not supported for DICOM.',
        extractedData: { supported: false },
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    if (this.scenario === 'FAILED') {
      return {
        status: 'FAILED',
        extractedSummary: `Processing failed for ${fileName}.`,
        extractedData: {},
        errorMessage: 'Simulated multimodal extraction failure.',
        isAiGenerated: false,
        provider: this.providerName,
      };
    }

    if (modality === 'CLINICAL_IMAGE') {
      return {
        status: 'ANALYZED',
        extractedSummary:
          'High-clarity image showing localized erythematous maculopapular rash with distinct margins on lateral forearm. No ulceration or necrotic tissue observed.',
        extractedData: {
          anatomicalSite: 'Lateral Forearm',
          lesionType: 'Maculopapular Erythema',
          marginDefinition: 'Distinct',
          imageClarity: 'High',
          nonDiagnosticDisclaimer:
            'Visual observation only. Clinician evaluation required for definitive dermatologic assessment.',
        },
        isAiGenerated: true,
        provider: this.providerName,
      };
    }

    return {
      status: 'ANALYZED',
      extractedSummary: 'Comprehensive Metabolic Panel (CMP) verified (2 pages). 14 biomarkers parsed.',
      extractedData: {
        documentType: 'Lab Results / CMP',
        pageCount: 2,
        verifiedBiomarkersCount: 14,
      },
      isAiGenerated: true,
      provider: this.providerName,
    };
  }
}

let activeMediaOverride: MediaAnalysisProvider | null = null;

export function setMediaAnalysisProviderOverride(provider: MediaAnalysisProvider | null): void {
  activeMediaOverride = provider;
}

export function getMediaAnalysisProvider(): MediaAnalysisProvider {
  if (activeMediaOverride) {
    return activeMediaOverride;
  }

  const configuredProvider = process.env.AI_ASSESSMENT_PROVIDER?.toLowerCase();
  if (configuredProvider === 'mock') {
    return new MockMediaAnalysisProvider('SUCCESS');
  }
  if (configuredProvider === 'ollama') {
    return new OllamaMedGemmaMediaProvider();
  }

  return new GeminiMediaAnalysisProvider();
}
