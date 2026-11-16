import { prisma } from '@/lib/prisma';
import { logger, redactSensitiveData } from '@/lib/logger';
import type { UserRole, AcuityLevel } from '@/lib/design-tokens';

export type AuditActionType =
  | 'TRIAGE_CREATED'
  | 'HIGH_RISK_ESCALATION'
  | 'CLINICIAN_SIGN_OFF'
  | 'CLINICIAN_OVERRIDE'
  | 'CONSENT_UPDATED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_UPDATED'
  | 'ARCHIVE_EXPORTED'
  | 'ACCOUNT_PURGE_REQUESTED'
  | 'AUTH_ROLE_SWITCH'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'AUTH_PASSWORD_RESET'
  | 'PROFILE_UPDATED'
  | 'GUIDELINE_INGESTED'
  | 'GUIDELINE_RETIRED'
  | 'GUIDELINE_SUPERSEDED';

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  actorRole: UserRole | 'SYSTEM' | string;
  actionType: AuditActionType;
  targetEntityType: string;
  targetEntityId: string;
  anonymizedPatientRef?: string;
  aiAcuity?: AcuityLevel | string;
  finalAcuity?: AcuityLevel | string;
  latencySeconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an immutable audit trail entry to the database and emits a PHI-safe structured server log.
 */
export async function recordAuditLog(input: CreateAuditLogInput) {
  const safeMetadata = redactSensitiveData(input.metadata ?? {}) as Record<string, unknown>;
  const auditCode = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;

  logger.info('AUDIT_EVENT_RECORDED', {
    auditCode,
    actionType: input.actionType,
    actorRole: input.actorRole,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    aiAcuity: input.aiAcuity,
    finalAcuity: input.finalAcuity,
  });

  return await prisma.auditLog.create({
    data: {
      auditCode,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      actionType: input.actionType,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      anonymizedPatientRef: input.anonymizedPatientRef ?? null,
      aiAcuity: input.aiAcuity ?? null,
      finalAcuity: input.finalAcuity ?? null,
      latencySeconds: input.latencySeconds ?? null,
      metadataJson: JSON.stringify(safeMetadata),
      isSeedFixture: false,
    },
  });
}
