import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isGeminiConfigured, env } from '@/lib/env';
import { getAiAssessmentProvider } from '@/server/triage/ai/provider-adapter';

/**
 * GET /api/health
 * Returns system health, database status, and transparent AI credential configuration status.
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const guidelineCount = await prisma.clinicalGuideline.count();
    const provider = getAiAssessmentProvider();
    const isLocalOllama = provider.providerName === 'ollama-medgemma';
    const isGemini = provider.providerName === 'google-gemini';
    const isMock = provider.providerName === 'mock-triage-adapter';
    const geminiConfigured = isGemini && isGeminiConfigured();
    let ollamaReachable = false;
    let ollamaModelAvailable = false;

    if (isLocalOllama) {
      try {
        const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/tags`, {
          signal: AbortSignal.timeout(2000),
          cache: 'no-store',
        });
        if (response.ok) {
          ollamaReachable = true;
          const payload: unknown = await response.json();
          if (typeof payload === 'object' && payload !== null && 'models' in payload && Array.isArray(payload.models)) {
            ollamaModelAvailable = payload.models.some((model: unknown) =>
              typeof model === 'object' && model !== null && 'name' in model &&
              typeof model.name === 'string' &&
              (model.name === provider.modelName || model.name.startsWith(`${provider.modelName}:`))
            );
          }
        }
      } catch {
        // The health response reports local inference as unavailable below.
      }
    }
    const ollamaConfigured = isLocalOllama && ollamaReachable && ollamaModelAvailable;

    return NextResponse.json({
      status: 'healthy',
      database: {
        connected: true,
        seededUsers: userCount,
        clinicalGuidelinesCount: guidelineCount,
      },
      aiService: {
        provider: provider.providerName,
        model: provider.modelName,
        configured: ollamaConfigured || geminiConfigured || isMock,
        mode: isLocalOllama
          ? ollamaConfigured
            ? 'LOCAL_OLLAMA_CONFIGURED'
            : ollamaReachable
              ? 'OLLAMA_MODEL_MISSING'
              : 'OLLAMA_UNAVAILABLE'
          : geminiConfigured
            ? 'LIVE_GEMINI_API'
            : isMock
              ? 'MOCK_TEST_MODE'
              : 'DETERMINISTIC_FALLBACK_MODE',
        ...(isLocalOllama ? { serviceReachable: ollamaReachable, modelAvailable: ollamaModelAvailable } : {}),
      },
      storageVault: {
        mode: process.env.VERCEL === '1' ? 'UNAVAILABLE_PERSISTENT_STORAGE_NOT_CONFIGURED' : 'LOCAL_PRIVATE_VAULT',
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        database: { connected: false },
      },
      { status: 503 }
    );
  }
}
