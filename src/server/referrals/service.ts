import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'SCHEDULED' | 'COMPLETED' | 'DECLINED';

export interface CreateReferralInput {
  patientProfileId: string;
  doctorId: string;
  specialtyNeeded: string;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  clinicalSummary: string;
  triageSessionId?: string | null;
  isSeedFixture?: boolean;
}

export function generateReferralCode(): string {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REF-${hex}`;
}

/**
 * Sanitizes and formats the clinical summary to enforce non-diagnostic clinical guidance.
 */
function enforceNonDiagnosticSummary(summary: string, specialty: string): string {
  let cleaned = summary.trim();
  if (!cleaned.toLowerCase().includes('preliminary') && !cleaned.toLowerCase().includes('potential') && !cleaned.toLowerCase().includes('consideration')) {
    cleaned = `Preliminary care navigation suggestion: ${cleaned} Recommended clinical evaluation with ${specialty} for comprehensive assessment (non-diagnostic triage).`;
  }
  return cleaned;
}

export async function createReferral(input: CreateReferralInput) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorId },
  });

  if (!doctor) {
    throw new Error('DOCTOR_NOT_FOUND: The specified physician was not found.');
  }

  const referralCode = generateReferralCode();
  const safeSummary = enforceNonDiagnosticSummary(input.clinicalSummary, input.specialtyNeeded);

  return prisma.careReferral.create({
    data: {
      referralCode,
      patientProfileId: input.patientProfileId,
      doctorId: input.doctorId,
      triageSessionId: input.triageSessionId ?? null,
      specialtyNeeded: input.specialtyNeeded,
      urgency: input.urgency ?? 'ROUTINE',
      clinicalSummary: safeSummary,
      referralStatus: 'PENDING',
      isSeedFixture: input.isSeedFixture ?? false,
    },
    include: {
      doctor: true,
      triageSession: {
        select: {
          sessionCode: true,
          chiefComplaint: true,
          acuityLevel: true,
        },
      },
    },
  });
}

export async function getReferralsForPatient(patientProfileId: string) {
  return prisma.careReferral.findMany({
    where: { patientProfileId },
    include: {
      doctor: true,
      triageSession: {
        select: {
          sessionCode: true,
          chiefComplaint: true,
          acuityLevel: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getReferralById(referralId: string) {
  return prisma.careReferral.findUnique({
    where: { id: referralId },
    include: {
      doctor: true,
      triageSession: true,
      patientProfile: {
        include: { user: true },
      },
    },
  });
}

export async function updateReferralStatus(
  referralId: string,
  patientProfileId: string,
  newStatus: ReferralStatus
) {
  const existing = await prisma.careReferral.findUnique({
    where: { id: referralId },
  });

  if (!existing) {
    throw new Error('REFERRAL_NOT_FOUND: Referral record not found.');
  }

  // Strict ownership check: Only the owning patient profile can update their referral status
  if (existing.patientProfileId !== patientProfileId) {
    throw new Error('UNAUTHORIZED_ACCESS: You do not have permission to modify this referral.');
  }

  return prisma.careReferral.update({
    where: { id: referralId },
    data: { referralStatus: newStatus },
    include: {
      doctor: true,
    },
  });
}

/**
 * Finds matching doctors in the database for an assessment's recommended specialty
 * and automatically creates a pending referral if one doesn't exist yet.
 */
export async function suggestReferralsForAssessment(sessionId: string, patientProfileId: string) {
  const session = await prisma.triageSession.findUnique({
    where: { id: sessionId },
    include: { careReferrals: true },
  });

  if (!session || session.patientProfileId !== patientProfileId) {
    throw new Error('SESSION_NOT_FOUND: Triage session not found or unauthorized.');
  }

  if (session.careReferrals.length > 0) {
    return session.careReferrals;
  }

  // Determine specialty from recommendedCareSetting or chiefComplaint
  let targetSpecialty = 'Internal Medicine';
  const complaint = (session.chiefComplaint + ' ' + session.recommendedCareSetting).toLowerCase();
  if (complaint.includes('chest') || complaint.includes('heart') || complaint.includes('cardio')) {
    targetSpecialty = 'Cardiology';
  } else if (complaint.includes('breath') || complaint.includes('cough') || complaint.includes('lung') || complaint.includes('pulmon')) {
    targetSpecialty = 'Pulmonology';
  } else if (complaint.includes('headache') || complaint.includes('neuro') || complaint.includes('dizz')) {
    targetSpecialty = 'Neurology';
  } else if (complaint.includes('rash') || complaint.includes('skin') || complaint.includes('lesion') || complaint.includes('derm')) {
    targetSpecialty = 'Dermatology';
  } else if (complaint.includes('sugar') || complaint.includes('diabetes') || complaint.includes('endo') || complaint.includes('thyroid')) {
    targetSpecialty = 'Endocrinology';
  }

  // Find the top doctor in this specialty
  const matchedDoctor = await prisma.doctorProfile.findFirst({
    where: { specialty: { contains: targetSpecialty } },
    orderBy: [{ triageMatchPercent: 'desc' }, { rating: 'desc' }],
  }) || await prisma.doctorProfile.findFirst({
    orderBy: { rating: 'desc' },
  });

  if (!matchedDoctor) {
    return [];
  }

  const referral = await createReferral({
    patientProfileId,
    doctorId: matchedDoctor.id,
    specialtyNeeded: matchedDoctor.specialty,
    urgency: session.acuityLevel === 'EMERGENCY' ? 'EMERGENCY' : session.acuityLevel === 'URGENT' ? 'URGENT' : 'ROUTINE',
    clinicalSummary: `Preliminary referral suggestion based on triage profile #${session.sessionCode} (${session.chiefComplaint}). Non-diagnostic guidance for specialist consultation.`,
    triageSessionId: session.id,
    isSeedFixture: session.isSeedFixture,
  });

  return [referral];
}
