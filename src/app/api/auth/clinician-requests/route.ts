import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/server/auth/password';
import { checkRateLimit, createRateLimitResponse } from '@/server/security/rate-limiter';
import { logger } from '@/lib/logger';

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
  licenseNumber: z.string().trim().min(3).max(80),
  specialty: z.string().trim().min(2).max(100),
  organization: z.string().trim().min(2).max(160),
  consentToVerification: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'clinician_access_request',
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please complete all clinician details and agree to credential verification.' },
        { status: 400 }
      );
    }

    const { fullName, email, password, licenseNumber, specialty, organization } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Sign in or contact your organization administrator.' },
        { status: 409 }
      );
    }

    const pendingRequest = await prisma.clinicianAccessRequest.findFirst({
      where: { email: normalizedEmail, status: 'PENDING' },
    });
    if (pendingRequest) {
      return NextResponse.json(
        { error: 'A clinician access request for this email is already under review.' },
        { status: 409 }
      );
    }

    await prisma.clinicianAccessRequest.create({
      data: {
        fullName,
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        licenseNumber,
        specialty,
        organization,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Your request was received. Clinician access will be available after your organization verifies and approves your credentials.',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('CLINICIAN_ACCESS_REQUEST_ERROR', error);
    return NextResponse.json({ error: 'We could not submit your request. Please try again.' }, { status: 500 });
  }
}
