import type { FormEvent } from 'react';
import { useState } from 'react';
import { Check, Mail, Phone, Send, WalletCards } from 'lucide-react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextInput } from '../../components/ui/FormField';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { recordAuditEvent } from '../../lib/audit/auditLog';
import { requireSupabase } from '../../lib/supabase/client';
import { formatCurrency } from '../../lib/utils/format';
import type { RecordStatus, Tutor } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';
import { deleteTutorAccount, updateTutorRecord } from './rosterMutations';

const tutorSubjects = ['Mathematics', 'Mathematical Literacy', 'Physical Sciences'];
const tutorGrades = ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export function AdminTutorsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Tutors" subtitle="Tutor roster for subjects, grades, rates, status, and future payroll workflows." section="admin">
      <CreateTutorForm onCreated={reload} />
      <Card>
        {loading ? <LoadingState title="Loading tutors" description="Fetching tutor profiles, subjects, grades, and status..." /> : null}
        {error ? <ErrorState title="Tutor roster unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
        {data ? (
          <div className="space-y-5">
            <DataTable<Tutor & { full_name?: string; email?: string }>
              rows={data.tutors}
              empty="No tutor records are available yet."
              columns={[
                { key: 'name', label: 'Tutor', render: (row) => <span className="font-semibold text-slate-950">{row.full_name || row.id}</span> },
                { key: 'email', label: 'Email', render: (row) => row.email || 'Pending' },
                { key: 'subjects', label: 'Subjects', render: (row) => row.subjects?.join(', ') || 'Pending' },
                { key: 'grades', label: 'Grades', render: (row) => row.grades?.join(', ') || 'Pending' },
                { key: 'rate', label: 'Rate', render: (row) => row.hourly_rate ? formatCurrency(row.hourly_rate) : 'Pending' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'pending'} /> },
              ]}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.tutors.map((tutor) => (
                <TutorRecordCard key={tutor.id} tutor={tutor} onSaved={reload} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

function CreateTutorForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [status, setStatus] = useState<RecordStatus>('pending');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const client = requireSupabase();
      const result = await client.functions.invoke<{ ok: boolean; profileId: string; userId: string }>('admin-invite-user', {
        body: {
          mode: 'invite',
          role: 'tutor',
          fullName,
          email,
          phone: phone.trim() || undefined,
          tutor: {
            subjects,
            grades,
            hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
            status,
          },
        },
      });
      if (result.error || !result.data?.ok) throw result.error || new Error('Could not invite tutor.');
      await recordAuditEvent({
        action: 'user.invited',
        entityType: 'profile',
        entityId: result.data.profileId,
        metadata: { role: 'tutor', auth_user_id: result.data.userId },
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setSubjects([]);
      setGrades([]);
      setHourlyRate('');
      setStatus('pending');
      setMessage('Tutor invited and added to the roster.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tutor record.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">Tutor roster</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Invite a tutor</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Set up their account, teaching profile, and rate in one place. They'll receive an email invitation to get started.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <form className="mt-6" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <section className="space-y-4" aria-labelledby="tutor-contact-heading">
            <p id="tutor-contact-heading" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Contact details</p>
            <FormField label="Full name"><TextInput required autoComplete="name" placeholder="e.g. Nandi Mokoena" value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
            <FormField label="Email address"><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><TextInput required autoComplete="email" className="pl-10" type="email" placeholder="tutor@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div></FormField>
            <FormField label="Phone number" hint="Optional — useful for roster coordination."><div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><TextInput autoComplete="tel" className="pl-10" placeholder="e.g. 082 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></FormField>
          </section>
          <section className="space-y-4 lg:border-l lg:border-slate-200 lg:pl-8 dark:lg:border-white/10" aria-labelledby="tutor-teaching-heading">
            <p id="tutor-teaching-heading" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Teaching profile</p>
            <MultiSelect label="Subjects" options={tutorSubjects} value={subjects} onChange={setSubjects} />
            <MultiSelect label="Grades taught" options={tutorGrades} value={grades} onChange={setGrades} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Hourly rate" hint="Optional, in South African rand."><div className="relative"><WalletCards className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm text-slate-500">R</span><TextInput className="pl-14" type="number" min="0" step="0.01" placeholder="0.00" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /></div></FormField>
              <FormField label="Initial status"><StatusSelect value={status} onChange={setStatus} /></FormField>
            </div>
          </section>
        </div>
        <SubmitRow busy={busy} label="Send tutor invite" message={message} error={error} />
      </form>
    </Card>
  );
}

function MultiSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800 dark:text-brand-parchment">{label}</legend>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-brand-marble">Choose all that apply.</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              aria-pressed={selected}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean/50 ${selected ? 'border-brand-aegean bg-brand-aegean text-white shadow-sm dark:border-brand-gold dark:bg-brand-gold dark:text-brand-obsidian' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-brand-aegean/50 hover:bg-brand-aegean/5 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-brand-gold/60 dark:hover:bg-white/[0.08]'}`}
              type="button"
              onClick={() => onChange(selected ? value.filter((item) => item !== option) : [...value, option])}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? 'border-current bg-current text-brand-aegean dark:text-brand-gold' : 'border-current/50'}`} aria-hidden="true">{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
              {option}
            </button>
          );
        })}
      </div>
      <input required value={value.length ? 'selected' : ''} className="sr-only" aria-label={`${label} selection`} onChange={() => undefined} />
    </fieldset>
  );
}

function TutorRecordCard({ tutor, onSaved }: { tutor: Tutor & { full_name?: string; email?: string; phone?: string | null }; onSaved: () => Promise<void> }) {
  const [fullName, setFullName] = useState(tutor.full_name || '');
  const [email, setEmail] = useState(tutor.email || '');
  const [phone, setPhone] = useState(tutor.phone || '');
  const [subjects, setSubjects] = useState(tutor.subjects?.join(', ') || '');
  const [grades, setGrades] = useState(tutor.grades?.join(', ') || '');
  const [hourlyRate, setHourlyRate] = useState(tutor.hourly_rate == null ? '' : String(tutor.hourly_rate));
  const [status, setStatus] = useState<RecordStatus>(normalizeStatus(tutor.status));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateTutorRecord({ tutorId: tutor.id, profileId: tutor.profile_id, fullName, email, phone, subjects, grades, hourlyRate, status });
      setMessage('Tutor record updated.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update tutor record.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{tutor.full_name || tutor.id}</h3>
          <p className="mt-1 text-sm text-slate-600">{tutor.email || 'Email pending'}</p>
        </div>
        <StatusBadge value={status} />
      </div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Full name"><TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
          <FormField label="Email"><TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
          <FormField label="Phone"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
          <FormField label="Subjects"><TextInput value={subjects} onChange={(event) => setSubjects(event.target.value)} /></FormField>
          <FormField label="Grades"><TextInput value={grades} onChange={(event) => setGrades(event.target.value)} /></FormField>
          <FormField label="Hourly rate"><TextInput type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /></FormField>
          <FormField label="Status"><StatusSelect value={status} onChange={setStatus} /></FormField>
        </div>
        <SubmitRow busy={busy} label="Save tutor" message={message} error={error} />
      </form>
      {!isDeletedTutor(tutor) ? <TutorDeletionAction tutor={tutor} onDeleted={onSaved} /> : null}
    </article>
  );
}

function TutorDeletionAction({
  tutor,
  onDeleted,
}: {
  tutor: Tutor & { full_name?: string; email?: string };
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeTutor() {
    const tutorName = tutor.full_name || 'this tutor';
    const confirmed = window.confirm(
      `Permanently delete ${tutorName}'s account and personal data? Their access and documents will be removed. Finance and audit records are retained without personal details.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await deleteTutorAccount({ tutorId: tutor.id, reason: 'Deleted by platform administrator' });
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tutor account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 border-t border-red-200 pt-4">
      <h4 className="font-semibold text-red-800">Delete tutor account</h4>
      <p className="mt-1 text-sm text-slate-600">Removes access, documents, onboarding data, availability, and personal details. This cannot be undone.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void removeTutor()}
        className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Deleting tutor...' : 'Delete tutor account'}
      </button>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}

function StatusSelect({ value, onChange }: { value: RecordStatus; onChange: (status: RecordStatus) => void }) {
  return (
    <select className="w-full rounded-2xl border border-brand-marble bg-white px-3 py-2 text-sm text-brand-obsidian outline-none transition focus:border-brand-aegean focus:ring-2 focus:ring-brand-aegean/20 dark:border-brand-marble/30 dark:bg-brand-navy dark:text-brand-parchment dark:focus:border-brand-gold dark:focus:ring-brand-gold/20" value={value} onChange={(event) => onChange(event.target.value as RecordStatus)}>
      <option value="pending">Pending</option>
      <option value="active">Active</option>
      <option value="approved">Approved</option>
      <option value="inactive">Inactive</option>
      <option value="suspended">Suspended</option>
    </select>
  );
}

function SubmitRow({ busy, label, message, error }: { busy: boolean; label: string; message: string | null; error: string | null }) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-white/10">
      <p className="text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold text-slate-700 dark:text-slate-200">Ready to invite?</span> The tutor can complete their setup from the email.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-gold dark:text-brand-obsidian dark:hover:bg-yellow-300" type="submit">
          <Send className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Sending invitation...' : label}
        </button>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}

function normalizeStatus(value: string): RecordStatus {
  return value === 'active' || value === 'inactive' || value === 'approved' || value === 'suspended' ? value : 'pending';
}

function isDeletedTutor(tutor: { email?: string }) {
  return tutor.email?.endsWith('@removed.invalid') ?? false;
}

