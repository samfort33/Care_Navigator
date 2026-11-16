import { z } from 'zod';

/**
 * Server-side environment variable schema.
 * Enforces AGENTS.md Rule 3.1:
 * - Validates required server configuration.
 * - Never exposes DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY, or STORAGE_SECRET_ACCESS_KEY to client code.
 * - Detects and rejects accidental NEXT_PUBLIC_ secret leaks.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (e.g., "file:./dev.db" or PostgreSQL connection string)')
    .default('file:./dev.db'),
  AUTH_SECRET: z
    .string()
    .min(16, 'AUTH_SECRET must be at least 16 characters long')
    .default('dev-only-local-carenavigator-session-signing-secret-key-2026'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  AI_ASSESSMENT_PROVIDER: z.enum(['gemini', 'ollama', 'mock']).default('gemini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('medgemma'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  LOCAL_VAULT_DIR: z.string().min(1).default('.local-vault'),
  STORAGE_ENDPOINT: z.string().optional().default(''),
  STORAGE_REGION: z.string().optional().default('us-east-1'),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(''),
  STORAGE_BUCKET_NAME: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const FORBIDDEN_PUBLIC_PREFIXES = [
  'NEXT_PUBLIC_GEMINI_API_KEY',
  'NEXT_PUBLIC_DATABASE_URL',
  'NEXT_PUBLIC_AUTH_SECRET',
  'NEXT_PUBLIC_STORAGE_SECRET_ACCESS_KEY',
] as const;

/**
 * Validates raw environment variables against the CareNavigator server schema
 * and throws if any forbidden NEXT_PUBLIC_ secret leak is detected.
 */
export function validateServerEnv(rawEnv: Record<string, string | undefined> = process.env): ServerEnv {
  for (const forbiddenKey of FORBIDDEN_PUBLIC_PREFIXES) {
    if (rawEnv[forbiddenKey] && rawEnv[forbiddenKey]!.trim().length > 0) {
      throw new Error(
        `Security Violation (AGENTS.md 3.1): Secret variable "${forbiddenKey}" must never be prefixed with NEXT_PUBLIC_.`
      );
    }
  }

  // Ensure local storage vault is never pointed inside public/
  const vaultDir = rawEnv.LOCAL_VAULT_DIR ?? '.local-vault';
  if (vaultDir.startsWith('public') || vaultDir.includes('/public/') || vaultDir.includes('\\public\\')) {
    throw new Error(
      'Security Violation (AGENTS.md 3.1): LOCAL_VAULT_DIR must never reside inside the public/ web root.'
    );
  }

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: rawEnv.DATABASE_URL || 'file:./dev.db',
    AUTH_SECRET: rawEnv.AUTH_SECRET || 'dev-only-local-carenavigator-session-signing-secret-key-2026',
    NEXTAUTH_URL: rawEnv.NEXTAUTH_URL || 'http://localhost:3000',
    AI_ASSESSMENT_PROVIDER:
      rawEnv.AI_ASSESSMENT_PROVIDER && rawEnv.AI_ASSESSMENT_PROVIDER !== 'undefined'
        ? rawEnv.AI_ASSESSMENT_PROVIDER
        : 'gemini',
    AI_TIMEOUT_MS:
      rawEnv.AI_TIMEOUT_MS && rawEnv.AI_TIMEOUT_MS !== 'undefined' ? rawEnv.AI_TIMEOUT_MS : 15000,
    OLLAMA_BASE_URL: rawEnv.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    OLLAMA_MODEL: rawEnv.OLLAMA_MODEL || 'medgemma',
    OLLAMA_TIMEOUT_MS:
      rawEnv.OLLAMA_TIMEOUT_MS && rawEnv.OLLAMA_TIMEOUT_MS !== 'undefined'
        ? rawEnv.OLLAMA_TIMEOUT_MS
        : 120000,
    GEMINI_API_KEY: rawEnv.GEMINI_API_KEY ?? '',
    GEMINI_MODEL: rawEnv.GEMINI_MODEL || 'gemini-2.5-flash',
    LOCAL_VAULT_DIR: vaultDir,
    STORAGE_ENDPOINT: rawEnv.STORAGE_ENDPOINT ?? '',
    STORAGE_REGION: rawEnv.STORAGE_REGION || 'us-east-1',
    STORAGE_ACCESS_KEY_ID: rawEnv.STORAGE_ACCESS_KEY_ID ?? '',
    STORAGE_SECRET_ACCESS_KEY: rawEnv.STORAGE_SECRET_ACCESS_KEY ?? '',
    STORAGE_BUCKET_NAME: rawEnv.STORAGE_BUCKET_NAME ?? '',
    NODE_ENV: (rawEnv.NODE_ENV as 'development' | 'test' | 'production') || 'development',
  });

  if (!parsed.success) {
    const formattedErrors = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid CareNavigator environment configuration: ${formattedErrors}`);
  }

  return parsed.data;
}

/**
 * Returns whether live Gemini AI credentials are configured.
 * Per AGENTS.md 4.1, never fabricate AI outputs or claim an external API call succeeded if unconfigured.
 */
export function isGeminiConfigured(rawEnv: Record<string, string | undefined> = process.env): boolean {
  const env = validateServerEnv(rawEnv);
  return Boolean(
    env.GEMINI_API_KEY &&
      env.GEMINI_API_KEY.trim().length > 10 &&
      !env.GEMINI_API_KEY.includes('your-gemini-api-key') &&
      !env.GEMINI_API_KEY.includes('replace-with')
  );
}

export const env = validateServerEnv();
