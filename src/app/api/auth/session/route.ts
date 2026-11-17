import { NextResponse } from 'next/server';
import { getServerSession, SESSION_COOKIE_NAME } from '@/server/auth/session';

/**
 * GET /api/auth/session
 * Returns the active authenticated session user.
 */
export async function GET() {
  const user = await getServerSession({ strictCookieOnly: true });
  return NextResponse.json({
    authenticated: Boolean(user),
    user,
  });
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
