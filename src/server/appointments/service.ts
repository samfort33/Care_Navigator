import { prisma } from '@/lib/prisma';

export interface CreateAppointmentInput {
  patientProfileId: string;
  doctorId: string;
  slotId?: string | null;
  reason: string;
  modality?: 'TELEHEALTH' | 'IN_PERSON';
  triageSessionId?: string | null;
  preVisitNotes?: string | null;
  scheduledAt?: Date;
}

export async function createAppointment(input: CreateAppointmentInput) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorId },
  });

  if (!doctor) {
    throw new Error('DOCTOR_NOT_FOUND: The requested care provider does not exist.');
  }

  // If a specific availability slot was selected, ensure atomicity
  if (input.slotId) {
    return await prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: input.slotId! },
      });

      if (!slot || slot.doctorId !== input.doctorId) {
        throw new Error('SLOT_NOT_FOUND: The requested availability slot was not found for this provider.');
      }

      if (slot.isBooked) {
        throw new Error('SLOT_ALREADY_BOOKED: This appointment slot has already been reserved.');
      }

      // Mark slot as booked
      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      const appointment = await tx.appointment.create({
        data: {
          patientProfileId: input.patientProfileId,
          doctorId: input.doctorId,
          slotId: slot.id,
          triageSessionId: input.triageSessionId ?? null,
          reason: input.reason.trim(),
          modality: (input.modality ?? slot.modality) as 'TELEHEALTH' | 'IN_PERSON',
          status: 'UPCOMING',
          scheduledAt: slot.startsAt,
          preVisitNotes: input.preVisitNotes?.trim() ?? null,
          isSeedFixture: false,
        },
        include: {
          doctor: true,
          slot: true,
        },
      });

      // Also create an in-app notification for the patient
      const patientProfile = await tx.patientProfile.findUnique({
        where: { id: input.patientProfileId },
        select: { userId: true },
      });

      if (patientProfile?.userId) {
        await tx.notification.create({
          data: {
            userId: patientProfile.userId,
            category: 'appointment',
            title: `Appointment Confirmed with ${doctor.name}`,
            body: `Your consultation is scheduled for ${slot.label} (${slot.modality}).`,
            actionLabel: 'View Details',
            actionHref: `/care-directory/${doctor.id}`,
            isRead: false,
          },
        });
      }

      return appointment;
    });
  }

  // Without a specific slot: schedule for default upcoming date
  const scheduledTime = input.scheduledAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

  const appointment = await prisma.appointment.create({
    data: {
      patientProfileId: input.patientProfileId,
      doctorId: input.doctorId,
      triageSessionId: input.triageSessionId ?? null,
      reason: input.reason.trim(),
      modality: input.modality ?? 'TELEHEALTH',
      status: 'UPCOMING',
      scheduledAt: scheduledTime,
      preVisitNotes: input.preVisitNotes?.trim() ?? null,
      isSeedFixture: false,
    },
    include: {
      doctor: true,
      slot: true,
    },
  });

  return appointment;
}

export async function getAppointmentsForPatient(patientProfileId: string) {
  return prisma.appointment.findMany({
    where: { patientProfileId },
    include: {
      doctor: true,
      slot: true,
    },
    orderBy: { scheduledAt: 'desc' },
  });
}

export async function cancelAppointment(appointmentId: string, patientProfileId: string) {
  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { slot: true },
  });

  if (!existing || existing.patientProfileId !== patientProfileId) {
    throw new Error('APPOINTMENT_NOT_FOUND: Appointment does not exist or unauthorized.');
  }

  return await prisma.$transaction(async (tx) => {
    if (existing.slotId) {
      await tx.availabilitySlot.update({
        where: { id: existing.slotId },
        data: { isBooked: false },
      });
    }

    return await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
      include: { doctor: true, slot: true },
    });
  });
}
