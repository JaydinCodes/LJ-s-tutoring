import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { recordAuditEvent } from '../../lib/audit/auditLog';
import { apiPost } from '../../lib/api/client';
import type { NgoPartner, RecordStatus, UserRole } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';

type ManagedRole = Extract<UserRole, 'student' | 'tutor' | 'admin'>;
type UserMode = 'invite' | 'create';

type AdminUserCreateResponse = {
  ok: boolean;
  mode: UserMode;
  role: ManagedRole;
  userId: string;
  profileId: string;
};

const roleOptions: ManagedRole[] = ['student', 'tutor', 'admin'];

export function AdminUsersRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell
      title="Users"
      subtitle="Invite Supabase Auth users and create the linked role profile in one controlled admin workflow."
      section="admin"
    >
      <AdminInviteUserForm ngoPartners={data?.ngoPartners || []} onCreated={reload} />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Current roster signal</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This panel confirms the invite workflow is connected to the active Supabase roster data.
            </p>
          </div>
          <StatusBadge value="supabase_first" />
        </div>
        {loading ? <LoadingState title="Loading roster summary" description="Checking current Supabase-linked users..." /> : null}
        {error ? <ErrorState title="Roster summary unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
        {data ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Students" value={data.students.length} />
            <SummaryTile label="Tutors" value={data.tutors.length} />
            <SummaryTile label="NGO partners" value={data.ngoPartners.length} />
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

function AdminInviteUserForm({ ngoPartners, onCreated }: { ngoPartners: NgoPartner[]; onCreated: () => Promise<void> }) {
  const [mode, setMode] = useState<UserMode>('invite');
  const [role, setRole] = useState<ManagedRole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [ngoPartnerId, setNgoPartnerId] = useState('');
  const [subjects, setSubjects] = useState('');
  const [grades, setGrades] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [status, setStatus] = useState<RecordStatus>('pending');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedSubjects = useMemo(() => csvList(subjects), [subjects]);
  const parsedGrades = useMemo(() => csvList(grades), [grades]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await apiPost<AdminUserCreateResponse>('/supabase/admin/users/invite', {
        mode,
        role,
        fullName: required(fullName, 'Full name'),
        email: required(email, 'Email'),
        phone: phone.trim() || undefined,
        password: mode === 'create' ? required(password, 'Temporary password') : undefined,
        student: role === 'student' ? {
          grade: grade.trim() || undefined,
          school: school.trim() || undefined,
          parentName: parentName.trim() || undefined,
          parentContact: parentContact.trim() || undefined,
          ngoPartnerId: ngoPartnerId || undefined,
          status,
        } : undefined,
        tutor: role === 'tutor' ? {
          subjects: parsedSubjects,
          grades: parsedGrades,
          hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
          status,
        } : undefined,
      });
      await recordAuditEvent({
        action: response.mode === 'invite' ? 'user.invited' : 'user.created',
        entityType: 'profile',
        entityId: response.profileId,
        metadata: {
          role: response.role,
          mode: response.mode,
          auth_user_id: response.userId,
        },
      });
      setMessage(`${titleCase(response.role)} ${response.mode === 'invite' ? 'invited' : 'created'} with profile ${response.profileId}.`);
      resetForm();
      await onCreated();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setMode('invite');
    setRole('student');
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setGrade('');
    setSchool('');
    setParentName('');
    setParentContact('');
    setNgoPartnerId('');
    setSubjects('');
    setGrades('');
    setHourlyRate('');
    setStatus('pending');
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Invite or create user</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This creates the Supabase Auth identity first, then writes the matching profile and role-specific roster row.
          </p>
        </div>
        <StatusBadge value="admin_mfa_required" />
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Mode">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={mode} onChange={(event) => setMode(event.target.value as UserMode)}>
            <option value="invite">Send invite email</option>
            <option value="create">Create with temporary password</option>
          </select>
        </FormField>
        <FormField label="Role">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}>
            {roleOptions.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </FormField>
        <FormField label="Full name"><TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
        <FormField label="Email"><TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField label="Phone"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
        {mode === 'create' ? (
          <FormField label="Temporary password" hint="Minimum 10 characters. The user should reset it after first sign-in.">
            <TextInput required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
        ) : null}

        {role === 'student' ? (
          <>
            <FormField label="Grade"><TextInput value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 11" /></FormField>
            <FormField label="School"><TextInput value={school} onChange={(event) => setSchool(event.target.value)} /></FormField>
            <FormField label="Parent name"><TextInput value={parentName} onChange={(event) => setParentName(event.target.value)} /></FormField>
            <FormField label="Parent contact"><TextInput value={parentContact} onChange={(event) => setParentContact(event.target.value)} /></FormField>
            <FormField label="NGO partner">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={ngoPartnerId} onChange={(event) => setNgoPartnerId(event.target.value)}>
                <option value="">Direct / none</option>
                {ngoPartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
            </FormField>
          </>
        ) : null}

        {role === 'tutor' ? (
          <>
            <FormField label="Subjects" hint="Comma separated."><TextInput value={subjects} onChange={(event) => setSubjects(event.target.value)} placeholder="Mathematics, Physical Sciences" /></FormField>
            <FormField label="Grades" hint="Comma separated."><TextInput value={grades} onChange={(event) => setGrades(event.target.value)} placeholder="Grade 10, Grade 11" /></FormField>
            <FormField label="Hourly rate"><TextInput min="0" step="0.01" type="number" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /></FormField>
          </>
        ) : null}

        {role !== 'admin' ? (
          <FormField label="Operational status"><StatusSelect value={status} onChange={setStatus} /></FormField>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : mode === 'invite' ? 'Send invite' : 'Create user'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </Card>
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

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function csvList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function required(value: string, label: string) {
  const next = value.trim();
  if (!next) {
    throw new Error(`${label} is required.`);
  }
  return next;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Could not create user.';
  if (raw.includes('duplicate_email')) {
    return 'A profile with this email already exists.';
  }
  if (raw.includes('admin_mfa_required')) {
    return 'Admin MFA is required before creating users.';
  }
  if (raw.includes('supabase_admin_not_configured')) {
    return 'The backend Supabase admin service is not configured.';
  }
  return raw;
}
