import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import { useAuth } from './AuthProvider';
import { getDashboardPath, sendMagicLink, signInWithPassword } from './authService';

export function LoginRoute() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestedPath = typeof location.state === 'object' && location.state && 'from' in location.state
    ? String(location.state.from)
    : null;

  useEffect(() => {
    if (auth.profile) {
      navigate(requestedPath || getDashboardPath(auth.profile.role), { replace: true });
    }
  }, [auth.profile, navigate, requestedPath]);

  if (auth.profile) {
    return <Navigate to={requestedPath || getDashboardPath(auth.profile.role)} replace />;
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await signInWithPassword(email.trim(), password);
      await auth.refresh();
      navigate(requestedPath || getDashboardPath(result.profile?.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMagicLink() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setMessage('Magic link sent. Check your email and return to this page after confirming.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl content-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section>
          <Link className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200" to="/">Project Odysseus</Link>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">Sign in to the React LMS.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
            Access your learner, tutor, or admin dashboard with your Project Odysseus account.
          </p>
        </section>
        <Card className="text-slate-950">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard access</h2>
          {!auth.configured ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              Sign-in is temporarily unavailable. Please contact support if you need urgent access.
            </p>
          ) : null}
          <form className="mt-5 grid gap-4" onSubmit={(event) => void submitPassword(event)}>
            <FormField label="Email">
              <TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </FormField>
            <FormField label="Password">
              <TextInput required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
            </FormField>
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={busy || !auth.configured} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
                {busy ? 'Signing in...' : 'Sign in'}
              </button>
              <button disabled={busy || !auth.configured || !email.trim()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void submitMagicLink()}>
                Send magic link
              </button>
            </div>
            {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error || auth.error ? <p className="text-sm font-semibold text-red-700">{error || auth.error}</p> : null}
          </form>
        </Card>
      </div>
    </main>
  );
}
