import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, hashToken } from '@/server/auth/password';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const resetPasswordSchema = z
  .object({
    token: z.string().min(10, { message: 'A valid recovery token is required.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long.' })
      .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
      .optional(),
    newPassword: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long.' })
      .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
      .optional(),
  })
  .refine((data) => Boolean(data.password || data.newPassword), {
    message: 'Password must be at least 8 characters long with letters and numbers.',
    path: ['newPassword'],
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const { token } = parsed.data;
    const targetPassword = (parsed.data.newPassword || parsed.data.password)!;
    const tokenHash = hashToken(token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Invalid or unrecognized recovery token.' },
        { status: 400 }
      );
    }

    if (resetRecord.usedAt) {
      return NextResponse.json(
        { error: 'This recovery token has already been used. Please request a new one.' },
        { status: 400 }
      );
    }

    if (new Date() > resetRecord.expiresAt) {
      return NextResponse.json(
        { error: 'This recovery token has expired. Please request a fresh reset link.' },
        { status: 400 }
      );
    }

    const newHashedPassword = await hashPassword(targetPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newHashedPassword },
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
    });

    await recordAuditLog({
      actorUserId: resetRecord.userId,
      actorRole: resetRecord.user.role,
      actionType: 'AUTH_PASSWORD_RESET',
      targetEntityType: 'User',
      targetEntityId: resetRecord.userId,
      metadata: { action: 'PASSWORD_UPDATED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Password successfully updated. You may now sign in with your new credentials.',
    });
  } catch (error) {
    logger.error('AUTH_RESET_PASSWORD_ERROR', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while resetting password.' },
      { status: 500 }
    );
  }
}
