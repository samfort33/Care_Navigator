/**
 * PHI-Safe Structured Server Logger (AGENTS.md Rule 3.1)
 * Automatically redacts secrets, tokens, SSNs, DOBs, raw clinical narratives,
 * biomarker values, and PII before emitting structured log entries.
 */

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /ssn/i,
  /dateofbirth/i,
  /dob/i,
  /clinicalnotes/i,
  /symptomnarrative/i,
  /voicetranscript/i,
  /biomarker/i,
  /allergy/i,
  /allergies/i,
  /medication/i,
  /chiefcomplaint/i,
  /patientname/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactSensitiveData(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Redact Bearer tokens or inline API key patterns
    return input
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_GEMINI_KEY]');
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item));
  }

  if (typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        output[key] = '[REDACTED_PHI_OR_SECRET]';
      } else {
        output[key] = redactSensitiveData(value);
      }
    }
    return output;
  }

  return input;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: Record<string, unknown>;
}

function formatLog(level: LogLevel, event: string, context?: Record<string, unknown>): StructuredLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(context ? { context: redactSensitiveData(context) as Record<string, unknown> } : {}),
  };
}

export const logger = {
  info(event: string, context?: Record<string, unknown>): StructuredLogEntry {
    const entry = formatLog('info', event, context);
    if (process.env.NODE_ENV !== 'test') {
      console.info(JSON.stringify(entry));
    }
    return entry;
  },

  warn(event: string, context?: Record<string, unknown>): StructuredLogEntry {
    const entry = formatLog('warn', event, context);
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify(entry));
    }
    return entry;
  },

  error(event: string, error?: unknown, context?: Record<string, unknown>): StructuredLogEntry {
    const safeError =
      error instanceof Error
        ? { name: error.name, message: redactSensitiveData(error.message) }
        : redactSensitiveData(error);
    const entry = formatLog('error', event, {
      ...context,
      error: safeError,
    });
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify(entry));
    }
    return entry;
  },
};
