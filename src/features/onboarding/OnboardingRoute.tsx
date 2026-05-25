import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import type { UserRole } from '../../types/lms';
import { useAuth } from '../auth/AuthProvider';
import { getDashboardPath } from '../auth/authService';
import { completeStudentOnboarding, completeTutorOnboarding } from './onboardingMutations';

export function OnboardingRoute({ role }: { role: Extract<UserRole, 'student' | 'tutor'> }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [subjects, setSubjects] = useState('');
  const [grades, setGrades] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.session?.user;
    if (!email && user?.email) {
      setEmail(user.email);
    }
    if (!fullName && user?.user_metadata?.full_name && typeof user.user_metadata.full_name === 'string') {
      setFullName(user.user_metadata.full_name);
    }
  }, [auth.session, email, fullName]);

  if (auth.loading) {
    return <OnboardingShell role={role}><Card>Checking your session...</Card></OnboardingShell>;
  }

  if (!auth.configured) {
    return <OnboardingShell role={role}><SetupRequired /></OnboardingShell>;
  }

  if (!auth.session) {
    return <Navigate to="/dashboard/login" replace state={{ from: `/onboarding/${role}` }} />;
  }

  if (auth.profile) {
    return <Navigate to={getDashboardPath(auth.profile.role)} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (role === 'student') {
        await completeStudentOnboarding({ fullName, email, phone, grade, school, parentName, parentContact });
      } else {
        await completeTutorOnboarding({ fullName, email, phone, subjects, grades, hourlyRate });
      }
      await auth.refresh();
      navigate(getDashboardPath(role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete onboarding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell role={role}>
      <Card>
        <h2 className="text-2xl font-semibold tracking-tight">{role === 'student' ? 'Student onboarding' : 'Tutor onboarding'}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This creates your `profiles` row and linked {role === 'student' ? '`students`' : '`tutors`'} row in Supabase.
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <FormField label="Full name">
            <TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </FormField>
          <FormField label="Email">
            <TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label="Phone">
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
          </FormField>

          {role === 'student' ? (
            <>
              <FormField label="Grade">
                <TextInput required value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 11" />
              </FormField>
              <FormField label="School">
                <TextInput value={school} onChange={(event) => setSchool(event.target.value)} />
              </FormField>
              <FormField label="Parent or guardian">
                <TextInput value={parentName} onChange={(event) => setParentName(event.target.value)} />
              </FormField>
              <FormField label="Parent contact">
                <TextInput value={parentContact} onChange={(event) => setParentContact(event.target.value)} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Subjects" hint="Comma-separated list, for example: Mathematics, Physical Sciences">
                <TextInput required value={subjects} onChange={(event) => setSubjects(event.target.value)} />
              </FormField>
              <FormField label="Grades" hint="Comma-separated list, for example: Grade 10, Grade 11, Grade 12">
                <TextInput required value={grades} onChange={(event) => setGrades(event.target.value)} />
              </FormField>
              <FormField label="Hourly rate">
                <TextInput type="number" min="0" step="1" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              </FormField>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
              {busy ? 'Saving...' : 'Complete onboarding'}
            </button>
            {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          </div>
        </form>
      </Card>
    </OnboardingShell>
  );
}

function OnboardingShell({ role, children }: { role: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-slate-600 underline" to="/dashboard/login/">Back to sign in</Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Set up your {role} profile.</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function SetupRequired() {
  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Supabase setup required</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before onboarding can create records.
      </p>
    </Card>
  );
}
