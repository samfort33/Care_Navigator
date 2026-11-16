import type { UserRole } from '@/lib/design-tokens';
import type { SessionUser } from './session';

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN_ROLE' | 'FORBIDDEN_OWNERSHIP';

  constructor(
    message: string,
    code: 'UNAUTHENTICATED' | 'FORBIDDEN_ROLE' | 'FORBIDDEN_OWNERSHIP',
    statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * 1. Authentication Guard (AGENTS.md Rule 3.3)
 * Verifies a valid user session exists.
 */
export function requireAuthenticated(session: SessionUser | null): SessionUser {
  if (!session || !session.id) {
    throw new AuthError('Authentication required to access this clinical resource.', 'UNAUTHENTICATED', 401);
  }
  return session;
}

/**
 * 2. Role-Based Access Control (RBAC) Guard (AGENTS.md Rule 3.3)
 * Verifies the user holds one of the allowed roles (e.g., CLINICIAN or ADMIN for review sign-off;
 * ADMIN for /admin/impact and audit logs).
 */
export function requireRole(session: SessionUser | null, allowedRoles: UserRole[]): SessionUser {
  const user = requireAuthenticated(session);
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Role "${user.role}" is not authorized. Required role(s): ${allowedRoles.join(', ')}.`,
      'FORBIDDEN_ROLE',
      403
    );
  }
  return user;
}

/**
 * 3. Record Ownership Guard (AGENTS.md Rule 3.3)
 * A PATIENT can only view, modify, export, or delete their own records.
 * CLINICIAN or ADMIN roles may inspect clinical records when allowClinicalAccess is true.
 */
export function requireRecordOwnership(
  session: SessionUser | null,
  recordOwnerUserId: string,
  options?: { allowClinicalAccess?: boolean }
): SessionUser {
  const user = requireAuthenticated(session);

  if (user.id === recordOwnerUserId) {
    return user;
  }

  if (options?.allowClinicalAccess && (user.role === 'CLINICIAN' || user.role === 'ADMIN')) {
    return user;
  }

  throw new AuthError(
    'Forbidden: You do not have ownership permission to access or modify this patient record.',
    'FORBIDDEN_OWNERSHIP',
    403
  );
}

/**
 * 4. Longitudinal EHR Consent Guard (AGENTS.md Rule 3.3)
 * Enforces the patient's Longitudinal EHR Consent Toggle on the server before injecting
 * medical history, medications, or allergies into any AI prompt.
 */
export interface EhrContextPayload {
  age: number;
  sex: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

export function filterEhrContextByConsent(
  sessionConsentEnabled: boolean,
  profileConsentEnabled: boolean,
  ehrData: EhrContextPayload
): EhrContextPayload | null {
  if (!sessionConsentEnabled || !profileConsentEnabled) {
    return null;
  }
  return ehrData;
}
