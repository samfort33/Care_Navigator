import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { UserRole } from '@/lib/design-tokens';

export const SESSION_COOKIE_NAME = 'cn_session_token';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mrn?: string | null;
  title?: string | null;
  specialty?: string | null;
  isSeedFixture: boolean;
}

export const DEMO_PERSONAS: Record<UserRole, SessionUser> = {
  PATIENT: {
    id: 'user-patient-sarah-jenkins',
    email: 'nusrat.jahan@carenavigator.example',
    name: 'Nusrat Jahan',
    role: 'PATIENT',
    mrn: '#CN-84920',
    title: 'Verified Patient',
    specialty: null,
    isSeedFixture: true,
  },
  CLINICIAN: {
    id: 'user-clinician-aris-thorne',
    email: 'ayesha.rahman@carenavigator.example',
    name: 'Dr. Ayesha Rahman, MBBS, FCPS',
    role: 'CLINICIAN',
    mrn: 'BD-DEMO-CL-001',
    title: 'Attending Physician',
    specialty: 'Internal Medicine & Pulmonology',
    isSeedFixture: true,
  },
  ADMIN: {
    id: 'user-admin-clara-vance',
    email: 'farhan.ahmed@carenavigator.example',
    name: 'Dr. Farhan Ahmed, MBBS, MPH',
    role: 'ADMIN',
    mrn: 'CMO-001',
    title: 'Chief Medical Officer',
    specialty: 'Clinical Operations & Governance',
    isSeedFixture: true,
  },
};

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/**
 * Signs a session payload into a compact HMAC-SHA256 JWT.
 */
export async function signSessionToken(user: SessionUser, expiresIn: string = '7d'): Promise<string> {
  return await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mrn: user.mrn ?? null,
    title: user.title ?? null,
    specialty: user.specialty ?? null,
    isSeedFixture: user.isSeedFixture,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

/**
 * Verifies a signed JWT session token and returns the typed SessionUser or null.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.email || !payload.name || !payload.role) {
      return null;
    }
    const role = payload.role as UserRole;
    if (role !== 'PATIENT' && role !== 'CLINICIAN' && role !== 'ADMIN') {
      return null;
    }
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role,
      mrn: payload.mrn ? String(payload.mrn) : null,
      title: payload.title ? String(payload.title) : null,
      specialty: payload.specialty ? String(payload.specialty) : null,
      isSeedFixture: Boolean(payload.isSeedFixture),
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the active server session from the HTTP-only cookie or Authorization header,
 * falling back to the default Patient persona in local interactive workspace mode
 * unless `strictCookieOnly` is passed (for API auth tests).
 */
export async function getServerSession(options?: {
  strictCookieOnly?: boolean;
  req?: Request | { headers?: Headers | { get(name: string): string | null } };
}): Promise<SessionUser | null> {
  const allowLocalSeedSessions =
    process.env.NODE_ENV !== 'production' && process.env.CARE_NAVIGATOR_ENABLE_TEST_ACCOUNTS === 'true';
  const isRealAccount = (user: SessionUser | null) =>
    user && (!user.isSeedFixture || allowLocalSeedSessions) ? user : null;

  // 1. If options?.req is provided, inspect Authorization header or Cookie header
  if (options?.req) {
    const getHeader = (name: string): string | null => {
      if (options?.req && 'headers' in options.req && options.req.headers) {
        if (options.req.headers instanceof Headers) {
          return options.req.headers.get(name);
        }
        if (typeof options.req.headers.get === 'function') {
          return options.req.headers.get(name);
        }
      }
      return null;
    };

    const authHeader = getHeader('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const verified = await verifySessionToken(token);
      const account = isRealAccount(verified);
      if (account) return account;
    }

    const cookieHeader = getHeader('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        const verified = await verifySessionToken(decodeURIComponent(match[1]));
        // If an explicit token was sent, return the verification result (null if expired or invalid)
        return isRealAccount(verified);
      }
    }
  }

  // 2. Fall back to Next.js cookies() helper if available in request scope
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (tokenCookie?.value) {
      const verified = await verifySessionToken(tokenCookie.value);
      // If an explicit session cookie was found, return the verification result (null if expired or invalid)
      return isRealAccount(verified);
    }
  } catch {
    // cookies() called outside request context
  }

  // In production mode or when strictCookieOnly is set, never synthesize demo personas
  if (options?.strictCookieOnly || process.env.NODE_ENV === 'production') {
    return null;
  }

  return DEMO_PERSONAS.PATIENT;
}
