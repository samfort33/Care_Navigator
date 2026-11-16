import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/server/auth/password';
import { SESSION_COOKIE_NAME, signSessionToken, type SessionUser } from '@/server/auth/session';
import { recordAuditLog } from '@/server/audit/audit-logger';
import { logger } from '@/lib/logger';

const registerSchema = z.object({
  email: z.string().trim().email({ message: 'Valid email is required.' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
  name: z.string().trim().min(2, { message: 'Full legal name is required.' }),
  role: z.enum(['PATIENT', 'CLINICIAN', 'ADMIN']).default('PATIENT'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'DOB must be YYYY-MM-DD format.' }).default('1990-01-01'),
  sex: z.string().default('Unspecified'),
  bloodType: z.string().default('Unknown'),
  primaryCarePhysician: z.string().default('Unassigned'),
  insuranceProvider: z.string().default('Self-Pay / In Progress'),
  insuranceMemberId: z.string().default('PENDING-001'),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

import { checkRateLimit, createRateLimitResponse } from '@/server/security/rate-limiter';
import { getServerSession } from '@/server/auth/session';

function calculateAge(dobString: string): number {
  const birthDate = new Date(dobString);
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting: Max 10 registration attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'auth_register',
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      name,
      role,
      dateOfBirth,
      sex,
      bloodType,
      primaryCarePhysician,
      insuranceProvider,
      insuranceMemberId,
      emergencyContactName,
      emergencyContactPhone,
    } = parsed.data;

    // 2. Prevent Privilege Escalation: Public registrations cannot assign CLINICIAN or ADMIN
    if (role === 'CLINICIAN' || role === 'ADMIN') {
      const callerSession = await getServerSession({ req: request, strictCookieOnly: true });
      if (!callerSession || callerSession.role !== 'ADMIN') {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'Self-registration as CLINICIAN or ADMIN is prohibited. Administrative authorization required.',
          },
          { status: 403 }
        );
      }
    }

    const normalizedEmail = email.toLowerCase();

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const mrn = `#CN-${Math.floor(10000 + Math.random() * 90000)}`;
    const age = calculateAge(dateOfBirth);

    // Create user and profile in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          role,
          mrn,
          title: role === 'PATIENT' ? 'Verified Patient' : 'Clinical Staff',
          passwordHash: hashedPassword,
          isSeedFixture: false,
        },
      });

      if (role === 'PATIENT') {
        await tx.patientProfile.create({
          data: {
            userId: user.id,
            dateOfBirth,
            age,
            sex,
            bloodType,
            primaryCarePhysician,
            insuranceProvider,
            insuranceMemberId,
            emergencyContactName: emergencyContactName || null,
            emergencyContactPhone: emergencyContactPhone || null,
            isSeedFixture: false,
          },
        });
      }

      await tx.consentPreference.create({
        data: {
          userId: user.id,
          includeEhrContext: true,
          storeVoiceTranscripts: true,
          deidentifiedModelImprovement: false,
          automatedHieSync: true,
        },
      });

      return user;
    });

    const sessionUser: SessionUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as SessionUser['role'],
      mrn: newUser.mrn,
      title: newUser.title,
      specialty: newUser.specialty,
      isSeedFixture: false,
    };

    const token = await signSessionToken(sessionUser);

    await recordAuditLog({
      actorUserId: newUser.id,
      actorRole: newUser.role,
      actionType: 'AUTH_REGISTER',
      targetEntityType: 'User',
      targetEntityId: newUser.id,
      metadata: { role: newUser.role, email: '[REDACTED_EMAIL]' },
    });

    const response = NextResponse.json(
      {
        success: true,
        user: sessionUser,
        token,
      },
      { status: 201 }
    );

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
    logger.error('AUTH_REGISTER_ERROR', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration.' },
      { status: 500 }
    );
  }
}
