/**
 * Canonical CareNavigator Design System Tokens ("The Sanctuary of Clinical Clarity")
 * Single source of truth for colors, semantic clinical acuity levels, navigation structure,
 * and role definitions across all 11 screens (AGENTS.md Section 1.2 & 1.3).
 */

export const CANONICAL_COLORS = {
  primary: {
    DEFAULT: '#00646f',
    container: '#087f8c',
    onPrimary: '#ffffff',
    fixed: '#9df0fb',
    onFixed: '#001f24',
  },
  secondary: {
    DEFAULT: '#2060a3',
    container: '#d4e3ff',
    onContainer: '#001c3a',
  },
  tertiary: {
    DEFAULT: '#006970',
    container: '#74f5ff',
    onContainer: '#002022',
  },
  surface: {
    DEFAULT: '#f6f9ff',
    bright: '#f8f9ff',
    lowest: '#ffffff',
    low: '#ecf5ff',
    container: '#e5eeff',
    high: '#dde9ff',
    highest: '#d6e3ff',
    inverse: '#16324f',
    inverseOnSurface: '#eef4ff',
  },
  typography: {
    onSurface: '#091d2b',
    onSurfaceVariant: '#3f484a',
    outline: '#6f797b',
    outlineVariant: '#bec8ca',
  },
  acuity: {
    SELF_CARE: {
      accent: '#21865b',
      bg: '#dcfce7',
      text: '#14532d',
      border: '#86efac',
      label: 'Self-Care & Monitoring',
      icon: 'check_circle',
    },
    ROUTINE: {
      accent: '#2060a3',
      bg: '#dbeafe',
      text: '#1e3a8a',
      border: '#93c5fd',
      label: 'Routine Consultation',
      icon: 'event_available',
    },
    URGENT: {
      accent: '#b7791f',
      bg: '#fef3c7',
      text: '#78350f',
      border: '#fcd34d',
      label: 'Urgent Care (<24h)',
      icon: 'warning',
    },
    EMERGENCY: {
      accent: '#ba1a1a',
      bg: '#fee2e2',
      text: '#7f1d1d',
      border: '#fca5a5',
      label: 'Emergency ER / Call 999',
      icon: 'emergency',
    },
  },
} as const;

export type AcuityLevel = keyof typeof CANONICAL_COLORS.acuity;

export type UserRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badgeKey?: 'unreadNotifications' | 'pendingReviews';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Standardized w-64 Patient Workspace Sidebar Navigation (AGENTS.md Section 1.3 & PROJECT_PLAN.md 4.1)
 */
export const PATIENT_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Clinical Workspace',
    items: [
      { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
      { label: 'AI Health Assessment', href: '/assessments/new', icon: 'vital_signs' },
      { label: 'Media & Voice Intake', href: '/assessments/media-voice', icon: 'mic' },
      { label: 'Assessment History', href: '/assessments/history', icon: 'history' },
      { label: 'Medical Records & Labs', href: '/records', icon: 'folder_shared' },
      { label: 'Find Care & Doctors', href: '/care-directory', icon: 'stethoscope' },
    ],
  },
  {
    title: 'Account & Governance',
    items: [
      {
        label: 'Notifications',
        href: '/notifications',
        icon: 'notifications',
        badgeKey: 'unreadNotifications',
      },
      { label: 'Privacy & Settings', href: '/settings/privacy', icon: 'shield_lock' },
    ],
  },
];

/**
 * Standardized w-64 Clinician & Admin Portal Sidebar Navigation (PROJECT_PLAN.md 4.1)
 */
export const CLINICAL_ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Clinical Operations',
    items: [
      { label: 'Impact & Metrics', href: '/admin/impact', icon: 'monitoring' },
      {
        label: 'Clinician Review Queue',
        href: '/reviews',
        icon: 'assignment_ind',
        badgeKey: 'pendingReviews',
      },
      { label: 'Sample Triage Results', href: '/assessments/CN-2026-8841/results', icon: 'fact_check' },
      { label: 'Provider Directory', href: '/care-directory', icon: 'person_search' },
    ],
  },
];

export const CLINICIAN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Clinical Workspace',
    items: [
      {
        label: 'Clinician Review Queue',
        href: '/reviews',
        icon: 'assignment_ind',
        badgeKey: 'pendingReviews',
      },
      { label: 'Review History', href: '/assessments/history', icon: 'history' },
      { label: 'Provider Directory', href: '/care-directory', icon: 'person_search' },
    ],
  },
];
