import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  signSessionToken,
  verifySessionToken,
  getServerSession,
  SESSION_COOKIE_NAME,
  DEMO_PERSONAS,
} from '@/server/auth/session';
import {
  checkRateLimit,
  createRateLimitResponse,
  resetRateLimit,
} from '@/server/security/rate-limiter';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { redactSensitiveData } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

describe('CareNavigator Production-Readiness & Security Audit Suite', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  describe('1. Session Expiration & Cookie Security', () => {
    it('rejects expired JWT session tokens and returns null', async () => {
      // Sign token that expires immediately in the past (-1s)
      const expiredToken = await signSessionToken(DEMO_PERSONAS.PATIENT, '-1s');
      const verified = await verifySessionToken(expiredToken);
      expect(verified).toBeNull();
    });

    it('rejects expired session cookies in getServerSession without falling back to demo persona', async () => {
      const expiredToken = await signSessionToken(DEMO_PERSONAS.PATIENT, '-5s');
      const req = new NextRequest('http://localhost:3000/api/patient/profile', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(expiredToken)}`,
        },
      });

      const session = await getServerSession({ req });
      expect(session).toBeNull();
    });

    it('denies unauthenticated access in production mode without fabricating demo personas', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      const req = new NextRequest('http://localhost:3000/api/patient/profile');
      const session = await getServerSession({ req });
      expect(session).toBeNull();
    });

    it('clears session cookie on logout with explicit path and zero maxAge', async () => {
      const validToken = await signSessionToken(DEMO_PERSONAS.PATIENT, '1h');
      const req = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
      });

      const res = await logoutPost(req);
      expect(res.status).toBe(200);

      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('');
      expect(cookie?.maxAge).toBe(0);
      expect(cookie?.path).toBe('/');
    });
  });

  describe('2. Privilege Escalation Defense in Registration', () => {
    beforeEach(async () => {
      // Clean up test user if left over
      await prisma.user.deleteMany({
        where: { email: { in: ['hacker_admin@example.com', 'hacker_clinician@example.com', 'valid_patient@example.com'] } },
      });
    });

    it('rejects unauthorized public registration requesting ADMIN role with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hacker_admin@example.com',
          password: 'Password123!',
          name: 'Malicious Actor',
          role: 'ADMIN',
        }),
      });

      const res = await registerPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
      expect(json.message).toContain('Administrative authorization required');

      // Verify user was NOT created
      const user = await prisma.user.findUnique({
        where: { email: 'hacker_admin@example.com' },
      });
      expect(user).toBeNull();
    });

    it('rejects unauthorized public registration requesting CLINICIAN role with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hacker_clinician@example.com',
          password: 'Password123!',
          name: 'Fake Clinician',
          role: 'CLINICIAN',
        }),
      });

      const res = await registerPost(req);
      expect(res.status).toBe(403);
    });

    it('permits legitimate PATIENT registration and creates associated patient profile', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'valid_patient@example.com',
          password: 'ValidPassword123!',
          name: 'Jane Verified Doe',
          role: 'PATIENT',
          dateOfBirth: '1992-05-15',
          sex: 'Female',
        }),
      });

      const res = await registerPost(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.user.role).toBe('PATIENT');
      expect(json.user.email).toBe('valid_patient@example.com');

      const profile = await prisma.patientProfile.findFirst({
        where: { user: { email: 'valid_patient@example.com' } },
      });
      expect(profile).not.toBeNull();
      expect(profile?.sex).toBe('Female');
    });
  });

  describe('3. Sliding-Window Rate Limiting Defense', () => {
    it('allows requests within limit and tracks remaining quota', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '198.51.100.42' },
      });
      resetRateLimit(req, 'test_quota');

      const res1 = checkRateLimit(req, { keyPrefix: 'test_quota', limit: 3, windowMs: 60000 });
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = checkRateLimit(req, { keyPrefix: 'test_quota', limit: 3, windowMs: 60000 });
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = checkRateLimit(req, { keyPrefix: 'test_quota', limit: 3, windowMs: 60000 });
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // 4th request must be blocked
      const res4 = checkRateLimit(req, { keyPrefix: 'test_quota', limit: 3, windowMs: 60000 });
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);

      const response429 = createRateLimitResponse(res4);
      expect(response429.status).toBe(429);
      expect(response429.headers.get('Retry-After')).toBeTruthy();
      expect(response429.headers.get('X-RateLimit-Limit')).toBe('3');
    });

    it('enforces rate limiting on /api/auth/login when threshold is exceeded', async () => {
      const testIp = '203.0.113.195';
      const dummyReq = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'x-forwarded-for': testIp },
      });
      resetRateLimit(dummyReq, 'auth_login');

      // Make 15 requests to reach limit
      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'x-forwarded-for': testIp,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrong' }),
        });
        await loginPost(req);
      }

      // 16th request must trigger 429
      const reqBlocked = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': testIp,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrong' }),
      });

      const res = await loginPost(reqBlocked);
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('4. Secret Protection & PHI Redaction', () => {
    it('verifies .env.example contains placeholders and zero actual secrets', () => {
      const envExamplePath = path.resolve(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf8');
      expect(content).not.toContain('AIzaSy'); // Google API key prefix
      expect(content).not.toContain('sk-'); // OpenAI secret prefix
      expect(content).toContain('AUTH_SECRET=');
      expect(content).toContain('DATABASE_URL=');
    });

    it('redacts sensitive clinical biomarkers, narratives, and passwords from logs', () => {
      const sensitivePayload = {
        password: 'SuperSecretPassword123!',
        token: 'secret-token-value',
        chiefComplaint: 'Severe chest tightness and dyspnea',
        biomarkerValue: 'Troponin-I 0.45 ng/mL',
        dateOfBirth: '1985-04-12',
        safeMetadata: 'Audit Code AUD-001',
      };

      const redacted = redactSensitiveData(sensitivePayload) as Record<string, string>;
      expect(redacted.password).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.token).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.chiefComplaint).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.dateOfBirth).toBe('[REDACTED_PHI_OR_SECRET]');
      expect(redacted.safeMetadata).toBe('Audit Code AUD-001');
    });
  });
});
