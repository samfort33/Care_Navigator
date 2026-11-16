'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  // Reset password phase state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid clinical portal email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process password recovery request.');
      }
      setSubmitted(true);
      if (data.recoveryToken) {
        setRecoveryToken(data.recoveryToken);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recoveryToken) {
      setError('Missing recovery token.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: recoveryToken,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }
      setResetSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-surface py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-lg w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-ambient border border-outline-variant/20 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
            <MaterialIcon name="lock_reset" className="text-[24px]" />
          </div>
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
              Credential Recovery
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface">
              Reset Clinical Portal Password
            </h1>
          </div>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Enter the email address associated with your CareNavigator patient or clinician profile.
          For security, recovery tokens are cryptographically hashed and valid for 1 hour.
        </p>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2"
          >
            <MaterialIcon name="error" className="text-error text-[18px] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resetSuccess ? (
          <div
            role="status"
            className="p-4 rounded-xl bg-surface-container-low border border-primary/30 space-y-3"
          >
            <div className="flex items-center gap-2 text-primary font-headline-sm text-headline-sm">
              <MaterialIcon name="check_circle" className="text-[20px]" />
              <span>Password Successfully Reset</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Your password has been updated and hashed with scrypt. You may now sign in using your new credentials.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                <MaterialIcon name="login" className="text-[18px]" />
                <span>Go to Sign In</span>
              </Link>
            </div>
          </div>
        ) : submitted ? (
          <div className="space-y-4">
            <div
              role="status"
              className="p-4 rounded-xl bg-surface-container-low border border-primary/30 space-y-2"
            >
              <div className="flex items-center gap-2 text-primary font-headline-sm text-headline-sm">
                <MaterialIcon name="mark_email_read" className="text-[20px]" />
                <span>Password Recovery Initiated</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                If an account exists for <strong className="text-on-surface">{email}</strong>, a recovery token has been generated.
              </p>
            </div>

            {recoveryToken && (
              <form onSubmit={handleReset} className="space-y-4 pt-2">
                <div className="p-3 bg-secondary-container/40 rounded-xl text-xs text-on-secondary-container font-mono">
                  <div className="font-semibold text-secondary mb-1">Local Development Recovery Token:</div>
                  <div className="break-all select-all font-bold">{recoveryToken}</div>
                </div>

                <div>
                  <label
                    htmlFor="new-password"
                    className="block font-label-md text-label-md text-on-surface mb-1.5"
                  >
                    New Password (Min 8 Characters)
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block font-label-md text-label-md text-on-surface mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="w-full h-11 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <MaterialIcon name="key" className="text-[18px]" />
                  <span>{resetSubmitting ? 'Updating Password...' : 'Save New Password'}</span>
                </button>
              </form>
            )}

            {!recoveryToken && (
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
                >
                  <MaterialIcon name="arrow_back" className="text-[16px]" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="reset-email"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Registered Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nusrat.jahan@carenavigator.example"
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-primary-gradient text-on-primary font-label-lg text-label-lg shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MaterialIcon name="send" className="text-[18px]" />
              <span>{isSubmitting ? 'Generating Recovery Token...' : 'Request Password Reset'}</span>
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-surface-container flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline flex items-center gap-1">
            <MaterialIcon name="arrow_back" className="text-[16px]" />
            <span>Back to Sign In</span>
          </Link>
          <Link href="/register" className="text-secondary hover:underline">
            Create New Account
          </Link>
        </div>
      </div>
    </div>
  );
}
