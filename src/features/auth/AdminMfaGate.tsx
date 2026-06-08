import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import { useAuth } from './AuthProvider';
import { challengeAdminMfa, enrollAdminMfa, verifyAdminMfa, type AdminMfaEnrollment } from './authService';

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null);
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

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const nextEnrollment = await enrollAdminMfa();
      setEnrollment(nextEnrollment);
      setCode('');
      setMessage('Scan the QR code, then enter the current six-digit authenticator code.');
    } catch (enrollmentError) {
      setError(enrollmentError instanceof Error ? enrollmentError.message : 'MFA enrollment failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitEnrollmentVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment?.factorId || !code.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const challenge = await challengeAdminMfa(enrollment.factorId);
      await verifyAdminMfa({ factorId: enrollment.factorId, challengeId: challenge.challengeId, code: code.trim() });
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
        description="Set up an authenticator app before using production admin routes."
      >
        {!enrollment ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-brand-marble bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p>
                Use Google Authenticator, 1Password, Authy, Microsoft Authenticator, or another TOTP app.
                Email OTP is not used for this admin second factor because the Supabase admin gate requires an authenticator assurance session.
              </p>
            </div>
            {error ? <p className="text-sm font-semibold text-red-700">MFA setup failed. {error}</p> : null}
            <Button disabled={busy} type="button" onClick={() => void startEnrollment()}>
              {busy ? 'Starting setup...' : 'Start MFA setup'}
            </Button>
          </div>
        ) : (
          <form className="mt-6 grid gap-5" onSubmit={(event) => void submitEnrollmentVerification(event)}>
            <div className="grid gap-4 rounded-2xl border border-brand-marble bg-slate-50 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <img className="h-auto w-full" src={enrollment.qrCode} alt="Project Odysseus admin MFA QR code" />
              </div>
              <div className="min-w-0 text-sm leading-6 text-slate-600">
                <h2 className="font-semibold text-slate-950">Scan this QR code</h2>
                <p className="mt-1">Add it to your authenticator app, then enter the current six-digit code below.</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Manual setup secret</p>
                <code className="mt-2 block break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
                  {enrollment.secret}
                </code>
              </div>
            </div>
            <FormField label="Authenticator code" hint="Enter the current six-digit code from the app you just configured.">
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
              {busy ? 'Verifying...' : 'Verify and unlock admin'}
            </Button>
          </form>
        )}
      </AdminMfaShell>
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
