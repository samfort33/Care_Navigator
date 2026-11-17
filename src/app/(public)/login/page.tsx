'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not sign you in. Check your details and try again.');

      const destination = data.user?.role === 'ADMIN'
        ? '/admin/impact'
        : data.user?.role === 'CLINICIAN'
          ? '/assessments/history'
          : '/dashboard';
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-outline-variant/40 bg-white shadow-ambient-lg lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between bg-primary px-7 py-8 text-on-primary sm:px-10 sm:py-10">
          <div>
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <MaterialIcon name="health_and_safety" filled className="text-3xl" />
            </div>
            <h1 className="max-w-sm text-3xl font-bold leading-tight sm:text-4xl">Care that starts with you.</h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-on-primary/85">
              Sign in to continue to your personal care workspace, or create an account to get started.
            </p>
          </div>
          <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm leading-6">
            <p className="flex items-center gap-2 font-semibold"><MaterialIcon name="info" className="text-lg" /> Care guidance, not a diagnosis</p>
            <p className="mt-1 text-on-primary/85">For a medical emergency in Bangladesh, call 999 or go to the nearest emergency department.</p>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-md">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">Use the email and password connected to your account.</p>

            {error && <div role="alert" className="mt-6 rounded-xl border border-error/30 bg-error-container/50 p-3 text-sm text-on-error-container">{error}</div>}

            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-on-surface">Email address</label>
                <input id="login-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-outline-variant/60 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="you@example.com" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="text-sm font-semibold text-on-surface">Password</label>
                  <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Forgot password?</Link>
                </div>
                <input id="login-password" name="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-outline-variant/60 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Enter your password" />
              </div>
              <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:bg-primary-container disabled:cursor-wait disabled:opacity-60">
                <MaterialIcon name={loading ? 'progress_activity' : 'login'} className="text-xl" />
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-7 border-t border-outline-variant/30 pt-6 text-center text-sm text-on-surface-variant">
              New to CareNavigator?{' '}
              <Link href="/register" className="font-bold text-primary hover:underline">Create an account</Link>
            </p>
            <p className="mt-4 text-center text-xs leading-5 text-on-surface-variant">
              Clinician access is provisioned by your healthcare organization after verification. Sign in with your organization-issued account.
            </p>
            <p className="mt-5 text-center text-xs text-on-surface-variant">
              <Link href="/about" className="hover:text-primary hover:underline">Learn how CareNavigator works</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
