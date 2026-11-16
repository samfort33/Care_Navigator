import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PATIENT_NAV_SECTIONS,
  CLINICAL_ADMIN_NAV_SECTIONS,
  CANONICAL_COLORS,
} from '@/lib/design-tokens';
import { translate } from '@/lib/language';

const APP_DIR = path.resolve(process.cwd(), 'src/app');

describe('CareNavigator Frontend Routes & Design System Fidelity Suite', () => {
  it('implements all 14 required public, patient, and clinical/admin route files', () => {
    const expectedRoutes = [
      '(public)/page.tsx',
      '(public)/login/page.tsx',
      '(public)/register/page.tsx',
      '(public)/forgot-password/page.tsx',
      'care-directory/page.tsx',
      'care-directory/layout.tsx',
      'care-directory/[id]/page.tsx',
      '(patient)/dashboard/page.tsx',
      '(patient)/assessments/new/page.tsx',
      '(patient)/assessments/media-voice/page.tsx',
      '(patient)/assessments/voice/page.tsx',
      '(patient)/assessments/[id]/results/page.tsx',
      '(patient)/assessments/history/page.tsx',
      '(patient)/records/page.tsx',
      '(patient)/notifications/page.tsx',
      '(patient)/settings/privacy/page.tsx',
      '(clinical)/admin/impact/page.tsx',
    ];

    for (const relPath of expectedRoutes) {
      const fullPath = path.join(APP_DIR, relPath);
      expect(fs.existsSync(fullPath), `Expected route file to exist: ${relPath}`).toBe(true);
    }
  });

  it('preserves canonical navigation links and Material Symbols icon mappings across patient and clinical workspaces', () => {
    const patientHrefs = PATIENT_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.href)
    );
    expect(patientHrefs).toContain('/dashboard');
    expect(patientHrefs).toContain('/assessments/new');
    expect(patientHrefs).toContain('/assessments/media-voice');
    expect(patientHrefs).toContain('/records');
    expect(patientHrefs).toContain('/care-directory');
    expect(patientHrefs).toContain('/assessments/history');
    expect(patientHrefs).toContain('/notifications');
    expect(patientHrefs).toContain('/settings/privacy');

    const clinicalHrefs = CLINICAL_ADMIN_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.href)
    );
    expect(clinicalHrefs).toContain('/admin/impact');
  });

  it('enforces non-diagnostic framing and seed fixture labeling on AI triage and workspace components', () => {
    const resultsComponentPath = path.resolve(
      process.cwd(),
      'src/components/triage/AssessmentResultsView.tsx'
    );
    const resultsSource = fs.readFileSync(resultsComponentPath, 'utf-8');
    expect(resultsSource).toContain('Decision-support tool, not a replacement for a doctor');
    expect(resultsSource).toContain('SeedFixtureBadge');

    const mediaVoicePath = path.resolve(
      process.cwd(),
      'src/components/triage/MediaVoiceWorkspace.tsx'
    );
    const mediaVoiceSource = fs.readFileSync(mediaVoicePath, 'utf-8');
    expect(mediaVoiceSource).toContain('Media Upload');
    expect(mediaVoiceSource).toContain('Voice Conversation');
    expect(mediaVoiceSource).toContain('Decision-support tool, not a replacement for a doctor');
  });

  it('provides a direct Bangladesh emergency call action in the emergency guidance dialog', () => {
    const emergencyModalPath = path.resolve(
      process.cwd(),
      'src/components/layout/Emergency911Modal.tsx'
    );
    const emergencyModalSource = fs.readFileSync(emergencyModalPath, 'utf-8');
    expect(emergencyModalSource).toContain('href="tel:999"');
    expect(emergencyModalSource).toContain('aria-label="Call Bangladesh emergency services on 999"');
    expect(emergencyModalSource).toContain('Call 999');
  });

  it('translates shared English/Bangla UI labels and retains the selected-language cookie', () => {
    expect(translate('bn', 'Find Care & Doctors')).toBe('চিকিৎসা ও ডাক্তার খুঁজুন');
    expect(translate('bn', 'Emergency Help')).toBe('জরুরি সহায়তা');

    const rootLayout = fs.readFileSync(path.resolve(APP_DIR, 'layout.tsx'), 'utf-8');
    expect(rootLayout).toContain("cookieStore.get('cn_language')");
    const languageProvider = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/language.tsx'),
      'utf-8'
    );
    expect(languageProvider).toContain('cn_language=${nextLanguage}');
  });

  it('submits patient-entered symptoms to triage without demo vitals or a 15-second model cutoff', () => {
    const assessmentPath = path.resolve(APP_DIR, '(patient)/assessments/new/page.tsx');
    const source = fs.readFileSync(assessmentPath, 'utf-8');
    expect(source).toContain('const chiefComplaint = notesInput.trim()');
    expect(source).toContain('answerValue: finalPleuriticDetails');
    expect(source).toContain('}, 130000);');
    expect(source).not.toContain('Resting HR 78 BPM');
    expect(source).not.toContain('Temperature 99.4°F');
  });

  it('maintains Canonical CareNavigator Theme color tokens ("The Sanctuary of Clinical Clarity")', () => {
    expect(CANONICAL_COLORS.primary.DEFAULT).toBe('#00646f');
    expect(CANONICAL_COLORS.primary.container).toBe('#087f8c');
    expect(CANONICAL_COLORS.secondary.DEFAULT).toBe('#2060a3');
    expect(CANONICAL_COLORS.tertiary.DEFAULT).toBe('#006970');
    expect(CANONICAL_COLORS.surface.DEFAULT).toBe('#f6f9ff');
  });
});
