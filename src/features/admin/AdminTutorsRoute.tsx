import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextInput } from '../../components/ui/FormField';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatCurrency } from '../../lib/utils/format';
import type { RecordStatus, Tutor } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';
import { createTutorRecord, updateTutorRecord } from './rosterMutations';

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
  const [authUserId, setAuthUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState('');
  const [grades, setGrades] = useState('');
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
      await createTutorRecord({ authUserId, fullName, email, phone, subjects, grades, hourlyRate, status });
      setAuthUserId('');
      setFullName('');
      setEmail('');
      setPhone('');
      setSubjects('');
      setGrades('');
      setHourlyRate('');
      setStatus('pending');
      setMessage('Tutor added to the roster.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tutor record.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Link tutor</h2>
          <p className="mt-1 text-sm text-slate-600">Create a tutor profile for an existing account.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Account user ID"><TextInput required value={authUserId} onChange={(event) => setAuthUserId(event.target.value)} placeholder="Account user ID" /></FormField>
        <FormField label="Full name"><TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
        <FormField label="Email"><TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField label="Phone"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
        <FormField label="Subjects" hint="Comma separated."><TextInput value={subjects} onChange={(event) => setSubjects(event.target.value)} placeholder="Mathematics, Physical Sciences" /></FormField>
        <FormField label="Grades" hint="Comma separated."><TextInput value={grades} onChange={(event) => setGrades(event.target.value)} placeholder="Grade 10, Grade 11" /></FormField>
        <FormField label="Hourly rate"><TextInput type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /></FormField>
        <FormField label="Status"><StatusSelect value={status} onChange={setStatus} /></FormField>
        <SubmitRow busy={busy} label="Create tutor" message={message} error={error} />
      </form>
    </Card>
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
    </article>
  );
}

function StatusSelect({ value, onChange }: { value: RecordStatus; onChange: (status: RecordStatus) => void }) {
  return (
    <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={value} onChange={(event) => onChange(event.target.value as RecordStatus)}>
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
    <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
      <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {busy ? 'Saving...' : label}
      </button>
      {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function normalizeStatus(value: string): RecordStatus {
  return value === 'active' || value === 'inactive' || value === 'approved' || value === 'suspended' ? value : 'pending';
}

