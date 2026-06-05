import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import { useAuth } from './AuthProvider';
import { challengeAdminMfa, verifyAdminMfa } from './authService';

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (auth.adminMfa.status === 'verified' || auth.adminMfa.status === 'dev_bypass') {
    return <>{children}</>;
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.adminMfa.factorId || !code.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Supabase requires a fresh challenge before verifying the admin TOTP code.
      const challenge = await challengeAdminMfa(auth.adminMfa.factorId);
      await verifyAdminMfa({ factorId: auth.adminMfa.factorId, challengeId: challenge.challengeId, code: code.trim() });
      setMessage('MFA verified. Loading admin dashboard...');
      await auth.refresh();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'MFA verification failed.');
    } finally {
      setBusy(false);
    }
  }

  if (auth.adminMfa.status === 'required') {
    return (
      <AdminMfaShell
        title="MFA required"
        description="Enter the six-digit code from your authenticator app to continue to the admin dashboard."
      >
        <form className="mt-6 grid gap-4" onSubmit={(event) => void submitVerification(event)}>
          <FormField label="Authenticator code" hint="Use the current code from your verified Supabase TOTP factor.">
            <TextInput
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </FormField>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">MFA verification failed. {error}</p> : null}
          <Button disabled={busy || code.trim().length !== 6} type="submit">
            {busy ? 'Verifying...' : 'Verify MFA'}
          </Button>
        </form>
      </AdminMfaShell>
    );
  }

  if (auth.adminMfa.status === 'setup_required') {
    return (
      <AdminMfaShell
        title="MFA setup required"
        description="This admin account does not have a verified Supabase TOTP factor. Enroll and verify MFA before using production admin routes."
      />
    );
  }

  return (
    <AdminMfaShell
      title="MFA verification unavailable"
      description={auth.adminMfa.error ?? 'Supabase could not confirm admin MFA status. Admin access remains blocked.'}
    />
  );
}

function AdminMfaShell({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
      <div className="mx-auto mt-20 max-w-xl">
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin security</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          {children}
        </Card>
      </div>
    </main>
  );
}
