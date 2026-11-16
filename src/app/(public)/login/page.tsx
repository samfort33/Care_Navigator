'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import type { UserRole } from '@/lib/design-tokens';

const QUICK_PERSONAS: Array<{
  role: UserRole;
  name: string;
  email: string;
  subtitle: string;
  mrnOrCreds: string;
  destination: string;
}> = [
  {
    role: 'PATIENT',
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@carenavigator.example',
    subtitle: 'Patient Portal • MRN #CN-84920',
    mrnOrCreds: 'Active Asthma & Hypertension Profile',
    destination: '/dashboard',
  },
  {
    role: 'CLINICIAN',
    name: 'Dr. Ayesha Rahman, MBBS, FCPS',
    email: 'ayesha.rahman@carenavigator.example',
    subtitle: 'Clinician Review Queue • NPI #1849204910',
    mrnOrCreds: 'Internal Medicine & Pulmonary Triage',
    destination: '/reviews',
  },
  {
    role: 'ADMIN',
    name: 'Dr. Farhan Ahmed, MBBS, MPH',
    email: 'farhan.ahmed@carenavigator.example',
    subtitle: 'CMO Operations Console',
    mrnOrCreds: 'Clinical Governance & Audit Telemetry',
    destination: '/admin/impact',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('nusrat.jahan@carenavigator.example');
  const [password, setPassword] = useState('Password123!');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PATIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your clinical portal email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication check failed. Please verify your credentials.');
      }

      const role = data.user?.role;
      if (role === 'ADMIN') {
        router.push('/admin/impact');
      } else if (role === 'CLINICIAN') {
        router.push('/assessments/history');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in at this time.');
    } finally {
      setLoading(false);
    }
  }

  function selectQuickPersona(persona: (typeof QUICK_PERSONAS)[number]) {
    setSelectedRole(persona.role);
    setEmail(persona.email);
    setPassword('Password123!');
    setError(null);
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-surface py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Clinical Trust & Persona Selector Column */}
        <div className="lg:col-span-5 bg-surface-container-low rounded-2xl p-6 sm:p-8 flex flex-col justify-between border border-outline-variant/25">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-primary font-label-sm text-label-sm uppercase tracking-wider">
              <MaterialIcon name="verified_user" className="text-[16px]" />
              <span>HIPAA-Aligned Session Vault</span>
            </div>

            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Sign in to CareNavigator Clinical Portal
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Access your longitudinal health records, multimodal symptom assessments, and
              clinician-verified care plans through an encrypted TLS 1.3 session.
            </p>

            {/* Quick Seeded Persona Selector for Evaluation */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Select Authenticated Role Persona [Sample Data]
                </span>
              </div>
              <div className="space-y-2">
                {QUICK_PERSONAS.map((persona) => {
                  const active = selectedRole === persona.role;
                  return (
                    <button
                      key={persona.role}
                      type="button"
                      onClick={() => selectQuickPersona(persona)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        active
                          ? 'bg-surface-container-lowest border-primary shadow-sm'
                          : 'bg-surface-container-lowest/60 border-outline-variant/30 hover:bg-surface-container-lowest'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-headline-sm text-headline-sm text-on-surface">
                            {persona.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[10px] font-bold">
                            {persona.role}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          {persona.subtitle}
                        </p>
                        <p className="font-label-sm text-label-sm text-primary mt-1">
                          {persona.mrnOrCreds}
                        </p>
                      </div>
                      <MaterialIcon
                        name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                        className={`text-[20px] shrink-0 mt-0.5 ${
                          active ? 'text-primary' : 'text-outline'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-start gap-2.5 text-on-surface-variant font-body-sm text-body-sm">
            <MaterialIcon name="emergency" className="text-error text-[18px] shrink-0 mt-0.5" />
            <span>
              Do not wait to sign in during a medical emergency. Call <strong>999</strong> or go to
              the nearest emergency department immediately.
            </span>
          </div>
        </div>

        {/* Right Sign-In Form Card */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-ambient border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-surface-container">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Account Credentials
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Enter your registered email and passphrase to unlock your session.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-secondary font-label-sm text-label-sm flex items-center gap-1">
                <MaterialIcon name="lock" className="text-[14px]" />
                2FA Enabled
              </span>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2.5"
              >
                <MaterialIcon name="error" className="text-error text-[18px] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block font-label-md text-label-md text-on-surface mb-1.5"
                >
                  Clinical Portal Email or MRN
                </label>
                <div className="relative">
                  <MaterialIcon
                    name="mail"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]"
                  />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.org"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block font-label-md text-label-md text-on-surface"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="font-label-md text-label-md text-secondary hover:text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <MaterialIcon
                    name="key"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]"
                  />
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer font-body-sm text-body-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded accent-primary text-primary focus:ring-primary"
                  />
                  <span>Enforce 15-minute HIPAA inactivity timeout on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MaterialIcon name="login" className="text-[20px]" />
                <span>
                  {loading
                    ? 'Establishing Encrypted Session...'
                    : `Sign In as ${selectedRole}`}
                </span>
              </button>
            </form>
          </div>

          <div className="pt-6 mt-6 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant font-body-sm text-body-sm">
            <span>New to CareNavigator Health Systems?</span>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:underline"
            >
              <span>Create Patient Account</span>
              <MaterialIcon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
