'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittedNotice(null);

    if (!fullName.trim() || !dob.trim() || !email.trim() || !password.trim()) {
      setError('Please complete all required patient demographic and security fields.');
      return;
    }
    if (!consentChecked) {
      setError(
        'You must acknowledge the non-diagnostic clinical decision support terms to register.'
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          password,
          dateOfBirth: dob,
          role: 'PATIENT',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed. Please check your details.');
      }

      setSubmittedNotice(
        `Account successfully registered for ${data.user?.name} (MRN: ${data.user?.mrn}). Redirecting to your personal health dashboard...`
      );
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-surface py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-ambient border border-outline-variant/20 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-surface-container">
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
              Patient Onboarding • HIPAA Protected
            </span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mt-0.5">
              Create Your CareNavigator Health Account
            </h1>
          </div>
          <Link
            href="/login"
            className="px-3.5 py-2 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md hover:bg-surface-container transition-colors"
          >
            Already have an account? Sign In
          </Link>
        </div>

        {/* Clinical Disclaimer */}
        <div className="p-4 rounded-xl bg-surface-container-low border-l-4 border-primary flex items-start gap-3">
          <MaterialIcon name="verified_user" className="text-primary text-[20px] shrink-0 mt-0.5" />
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            <strong className="text-on-surface">Clinical Decision Support Notice:</strong>{' '}
            CareNavigator provides structured symptom triage and care coordination. It does not
            replace a licensed physician or emergency medical services (999).
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2.5"
          >
            <MaterialIcon name="error" className="text-error text-[18px] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submittedNotice && (
          <div
            role="status"
            className="p-4 rounded-xl bg-surface-container-high text-on-surface font-body-sm text-body-sm space-y-3 border border-primary/30"
          >
            <div className="flex items-start gap-2.5">
              <MaterialIcon name="info" className="text-primary text-[20px] shrink-0 mt-0.5" />
              <p className="leading-relaxed">{submittedNotice}</p>
            </div>
            <div className="flex items-center gap-3 pl-7">
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                Continue to Sign In
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md hover:bg-surface-container-low transition-colors"
              >
                Open Patient Dashboard
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reg-name"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Legal Full Name *
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Nusrat Jahan"
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>

            <div>
              <label
                htmlFor="reg-dob"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Date of Birth *
              </label>
              <input
                id="reg-dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reg-email"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.org"
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Create Passphrase *
              </label>
              <input
                id="reg-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 12 characters"
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-primary text-primary focus:ring-primary"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                I understand that CareNavigator is a clinical decision-support tool and not a
                substitute for professional medical diagnosis, and I consent to HIPAA-aligned
                encrypted storage of my health intake records.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <Link
              href="/login"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md text-center hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MaterialIcon name="person_add" className="text-[18px]" />
              <span>{loading ? 'Registering Account...' : 'Validate Registration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
