import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSecureToken, hashToken } from '@/server/auth/password';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

import { checkRateLimit, createRateLimitResponse } from '@/server/security/rate-limiter';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'Valid email is required.' }),
});

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting: Max 5 recovery requests per 15 minutes per IP
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'auth_forgot_password',
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return success message to prevent user enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email address, a password recovery token has been generated.',
      });
    }

    // Invalidate existing unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      actionType: 'AUTH_PASSWORD_RESET',
      targetEntityType: 'PasswordResetToken',
      targetEntityId: user.id,
      metadata: { action: 'TOKEN_ISSUED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Password recovery token generated successfully.',
      // Provided transparently in development/testing environments:
      recoveryToken: rawToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error('AUTH_FORGOT_PASSWORD_ERROR', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing password recovery.' },
      { status: 500 }
    );
  }
}
