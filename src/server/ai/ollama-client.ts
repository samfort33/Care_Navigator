import { env } from '@/lib/env';
import {
  AiProviderExecutionError,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
} from '@/server/triage/ai/types';

interface OllamaMessage {
  role: 'system' | 'user';
  content: string;
  images?: string[];
}

interface CallOllamaChatOptions {
  model: string;
  system: string;
  prompt: string;
  images?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Calls Ollama's local chat API. No tools are sent because MedGemma doesn't support them. */
export async function callOllamaChat({
  model,
  system,
  prompt,
  images,
  timeoutMs = env.OLLAMA_TIMEOUT_MS,
  signal,
}: CallOllamaChatOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();
  signal?.addEventListener('abort', abortFromParent, { once: true });

  if (signal?.aborted) controller.abort();

  try {
    const messages: OllamaMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: prompt, ...(images?.length ? { images } : {}) },
    ];
    const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        format: 'json',
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new AiProviderUnavailableError(
        `Ollama could not find model "${model}". Install Ollama, then run: ollama pull ${model}`
      );
    }
    if (!response.ok) {
      throw new AiProviderExecutionError(`Ollama returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('message' in payload) ||
      typeof payload.message !== 'object' ||
      payload.message === null ||
      !('content' in payload.message) ||
      typeof payload.message.content !== 'string' ||
      payload.message.content.trim().length === 0
    ) {
      throw new AiProviderExecutionError('Ollama returned an empty or malformed chat response.');
    }
    return payload.message.content.trim();
  } catch (error) {
    if (error instanceof AiProviderExecutionError || error instanceof AiProviderUnavailableError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new AiProviderTimeoutError(timeoutMs);
    }
    throw new AiProviderUnavailableError(
      'Could not connect to the local Ollama service. Start Ollama and confirm it is listening on the configured URL.'
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
}
