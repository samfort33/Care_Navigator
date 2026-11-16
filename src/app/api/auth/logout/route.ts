import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getServerSession } from '@/server/auth/session';
import { recordAuditLog } from '@/server/audit/audit-logger';

export async function POST(request: NextRequest) {
  const session = await getServerSession({ strictCookieOnly: true, req: request });

  if (session) {
    await recordAuditLog({
      actorUserId: session.id,
      actorRole: session.role,
      actionType: 'AUTH_LOGOUT',
      targetEntityType: 'UserSession',
      targetEntityId: session.id,
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
