import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window rate limit map: key -> timestamps
const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000); // 1 hour
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  keyPrefix?: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function getClientIp(request: Request | NextRequest): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

/**
 * Checks and records an access attempt using a sliding window algorithm.
 */
export function checkRateLimit(
  request: Request | NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(request);
  const prefix = options.keyPrefix || 'global';
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = rateLimitMap.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  // Remove timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.limit) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + options.windowMs - now);
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, options.limit - record.timestamps.length);

  return {
    allowed: true,
    limit: options.limit,
    remaining,
    resetMs: options.windowMs,
  };
}

/**
 * Helper to construct a 429 Too Many Requests response with standard retry headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.ceil(result.resetMs / 1000) || 1;
  return NextResponse.json(
    {
      error: 'TOO_MANY_REQUESTS',
      message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    }
  );
}

/**
 * Reset rate limit for a specific prefix and request (useful in tests).
 */
export function resetRateLimit(request: Request | NextRequest, keyPrefix: string): void {
  const ip = getClientIp(request);
  rateLimitMap.delete(`${keyPrefix}:${ip}`);
}
