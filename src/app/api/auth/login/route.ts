import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/server/auth/password';
import { SESSION_COOKIE_NAME, signSessionToken, type SessionUser } from '@/server/auth/session';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

import { checkRateLimit, createRateLimitResponse } from '@/server/security/rate-limiter';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Valid email is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting Check: Max 15 attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'auth_login',
      limit: 15,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid login credentials format',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as SessionUser['role'],
      mrn: user.mrn,
      title: user.title,
      specialty: user.specialty,
      isSeedFixture: user.isSeedFixture,
    };

    const token = await signSessionToken(sessionUser);

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'AUTH_LOGIN',
      targetEntityType: 'User',
      targetEntityId: user.id,
      metadata: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      token,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    logger.error('AUTH_LOGIN_ERROR', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during sign-in.' },
      { status: 500 }
    );
  }
}
