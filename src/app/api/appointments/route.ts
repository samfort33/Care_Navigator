import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { createAppointment, getAppointmentsForPatient } from '@/server/appointments/service';
import { logger } from '@/lib/logger';

const CreateAppointmentSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  slotId: z.string().optional().nullable(),
  reason: z.string().min(3, 'Consultation reason must be at least 3 characters').max(500),
  modality: z.enum(['TELEHEALTH', 'IN_PERSON']).optional(),
  triageSessionId: z.string().optional().nullable(),
  preVisitNotes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/appointments
 * Retrieves the appointments for the authenticated patient.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: session.id },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'PATIENT_PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const appointments = await getAppointmentsForPatient(patientProfile.id);
    return NextResponse.json({ appointments });
  } catch (error: unknown) {
    logger.error('APPOINTMENTS_GET_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments
 * Reserves an appointment slot with atomic locking.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession({ req: request });
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: session.id },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'PATIENT_PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = CreateAppointmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: parseResult.error.format() },
        { status: 400 }
      );
    }

    const appointment = await createAppointment({
      patientProfileId: patientProfile.id,
      doctorId: parseResult.data.doctorId,
      slotId: parseResult.data.slotId,
      reason: parseResult.data.reason,
      modality: parseResult.data.modality,
      triageSessionId: parseResult.data.triageSessionId,
      preVisitNotes: parseResult.data.preVisitNotes,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error: unknown) {
    logger.error('APPOINTMENT_CREATE_FAILED', error);
    const message = error instanceof Error ? error.message : 'Failed to schedule appointment';

    if (message.startsWith('SLOT_ALREADY_BOOKED')) {
      return NextResponse.json({ error: 'SLOT_ALREADY_BOOKED', message }, { status: 409 });
    }
    if (message.startsWith('DOCTOR_NOT_FOUND') || message.startsWith('SLOT_NOT_FOUND')) {
      return NextResponse.json({ error: 'NOT_FOUND', message }, { status: 404 });
    }

    return NextResponse.json({ error: 'APPOINTMENT_ERROR', message }, { status: 500 });
  }
}
