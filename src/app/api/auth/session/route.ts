import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DEMO_PERSONAS,
  SESSION_COOKIE_NAME,
  getServerSession,
  signSessionToken,
} from '@/server/auth/session';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const switchRoleSchema = z.object({
  role: z.enum(['PATIENT', 'CLINICIAN', 'ADMIN']),
});

/**
 * GET /api/auth/session
 * Returns the active authenticated session user.
 */
export async function GET() {
  const user = await getServerSession();
  return NextResponse.json({
    authenticated: Boolean(user),
    user,
  });
}

/**
 * POST /api/auth/session
 * Switches active role persona (or authenticates into one of the 3 clinical roles),
 * mints a signed HTTP-only JWT cookie, and records an immutable audit log entry.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = switchRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid role selection payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const targetPersona = DEMO_PERSONAS[parsed.data.role];
    const token = await signSessionToken(targetPersona);

    await recordAuditLog({
      actorUserId: targetPersona.id,
      actorRole: targetPersona.role,
      actionType: 'AUTH_ROLE_SWITCH',
      targetEntityType: 'UserSession',
      targetEntityId: targetPersona.id,
      metadata: {
        switchedToRole: targetPersona.role,
        personaName: targetPersona.name,
      },
    });

    const response = NextResponse.json({
      authenticated: true,
      user: targetPersona,
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
    logger.error('AUTH_SESSION_POST_ERROR', error);
    return NextResponse.json(
      { error: 'Failed to update session authentication state.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false, user: null });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
