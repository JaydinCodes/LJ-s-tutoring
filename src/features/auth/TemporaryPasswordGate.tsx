import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { FormField, TextInput } from '../../components/ui/FormField';
import { requireSupabase } from '../../lib/supabase/client';
import { useAuth } from './AuthProvider';

export function TemporaryPasswordGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.mustChangeTemporaryPassword) return <>{children}</>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requireSupabase().functions.invoke<{ ok: boolean }>('complete-temporary-password', { body: { password } });
      if (result.error || !result.data?.ok) throw result.error || new Error('Could not update your password.');
      await requireSupabase().auth.refreshSession();
      await auth.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-950">
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-aegean">First sign-in</p>
        <h1 className="mt-2 text-2xl font-semibold">Choose your own password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your temporary password has worked. Set a private password to continue to your learner portal.</p>
        <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
          <FormField label="New password" hint="Use at least 10 characters."><TextInput autoComplete="new-password" required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
          <FormField label="Confirm new password"><TextInput autoComplete="new-password" required minLength={10} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></FormField>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Updating password...' : 'Save password and continue'}</button>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
