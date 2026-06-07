import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { Guardian, NgoPartner, RecordStatus, Student, StudentGuardian } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';
import { createGuardianRecord, deactivateGuardianLink, linkGuardianToStudent, updateGuardianRecord } from './guardianMutations';
import { createStudentRecord, updateStudentRecord } from './rosterMutations';

export function AdminStudentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Students" subtitle="Operational learner list for onboarding, support status, and NGO rollout visibility." section="admin">
      <CreateStudentForm ngoPartners={data?.ngoPartners || []} onCreated={reload} />
      <CreateGuardianForm onCreated={reload} />
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading students...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="space-y-5">
            <DataTable<Student & { full_name?: string; email?: string; ngo_partner?: string }>
              rows={data.students}
              empty="No student records are available yet."
              columns={[
                { key: 'name', label: 'Student', render: (row) => <span className="font-semibold text-slate-950">{row.full_name || row.id}</span> },
                { key: 'email', label: 'Email', render: (row) => row.email || 'Pending' },
                { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                { key: 'school', label: 'School', render: (row) => row.school || 'Pending' },
                { key: 'parent', label: 'Parent', render: (row) => row.parent_name || 'Pending' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'pending'} /> },
              ]}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.students.map((student) => (
                <StudentRecordCard key={student.id} student={student} guardians={data.guardians} ngoPartners={data.ngoPartners} onSaved={reload} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Guardians</h2>
        <p className="mt-1 text-sm text-slate-600">Manage parent and guardian records separately from learner rows so reports and communication permissions stay auditable.</p>
        {data ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {data.guardians.map((guardian) => <GuardianRecordCard key={guardian.id} guardian={guardian} onSaved={reload} />)}
            {!data.guardians.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No guardian records are available yet.</p> : null}
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

function CreateGuardianForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [input, setInput] = useState(emptyGuardianInput());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createGuardianRecord(input);
      setInput(emptyGuardianInput());
      setMessage('Guardian added.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create guardian.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Add guardian</h2>
          <p className="mt-1 text-sm text-slate-600">Create parent or guardian contact records before linking them to learners.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <GuardianFields input={input} setInput={setInput} onSubmit={submit} busy={busy} submitLabel="Create guardian" message={message} error={error} />
    </Card>
  );
}

function CreateStudentForm({ ngoPartners, onCreated }: { ngoPartners: NgoPartner[]; onCreated: () => Promise<void> }) {
  const [authUserId, setAuthUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [ngoPartnerId, setNgoPartnerId] = useState('');
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
      await createStudentRecord({ authUserId, fullName, email, phone, grade, school, parentName, parentContact, ngoPartnerId, status });
      setAuthUserId('');
      setFullName('');
      setEmail('');
      setPhone('');
      setGrade('');
      setSchool('');
      setParentName('');
      setParentContact('');
      setNgoPartnerId('');
      setStatus('pending');
      setMessage('Student added to the roster.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create student record.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Link student</h2>
          <p className="mt-1 text-sm text-slate-600">Create a learner profile for an existing account.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Account user ID"><TextInput required value={authUserId} onChange={(event) => setAuthUserId(event.target.value)} placeholder="Account user ID" /></FormField>
        <FormField label="Full name"><TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
        <FormField label="Email"><TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
        <FormField label="Phone"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
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
        <FormField label="Status"><StatusSelect value={status} onChange={setStatus} /></FormField>
        <SubmitRow busy={busy} label="Create student" message={message} error={error} />
      </form>
    </Card>
  );
}

function StudentRecordCard({
  student,
  guardians,
  ngoPartners,
  onSaved,
}: {
  student: Student & { full_name?: string; email?: string; phone?: string | null; ngo_partner?: string };
  guardians: Array<Guardian & { linked_students?: Array<StudentGuardian & { student_name?: string }> }>;
  ngoPartners: NgoPartner[];
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(student.full_name || '');
  const [email, setEmail] = useState(student.email || '');
  const [phone, setPhone] = useState(student.phone || '');
  const [grade, setGrade] = useState(student.grade || '');
  const [school, setSchool] = useState(student.school || '');
  const [parentName, setParentName] = useState(student.parent_name || '');
  const [parentContact, setParentContact] = useState(student.parent_contact || '');
  const [ngoPartnerId, setNgoPartnerId] = useState(student.ngo_partner_id || '');
  const [status, setStatus] = useState<RecordStatus>(normalizeStatus(student.status));
  const [guardianId, setGuardianId] = useState('');
  const [relationshipType, setRelationshipType] = useState('guardian');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canReceiveReports, setCanReceiveReports] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateStudentRecord({ studentId: student.id, profileId: student.profile_id, fullName, email, phone, grade, school, parentName, parentContact, ngoPartnerId, status });
      setMessage('Student record updated.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update student record.');
    } finally {
      setBusy(false);
    }
  }

  const linkedGuardians = guardians.flatMap((guardian) => (guardian.linked_students || [])
    .filter((link) => link.student_id === student.id && link.status === 'active')
    .map((link) => ({ guardian, link })));

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{student.full_name || student.id}</h3>
          <p className="mt-1 text-sm text-slate-600">{student.email || 'Email pending'}</p>
        </div>
        <StatusBadge value={status} />
      </div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Full name"><TextInput required value={fullName} onChange={(event) => setFullName(event.target.value)} /></FormField>
          <FormField label="Email"><TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
          <FormField label="Phone"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
          <FormField label="Grade"><TextInput value={grade} onChange={(event) => setGrade(event.target.value)} /></FormField>
          <FormField label="School"><TextInput value={school} onChange={(event) => setSchool(event.target.value)} /></FormField>
          <FormField label="Parent name"><TextInput value={parentName} onChange={(event) => setParentName(event.target.value)} /></FormField>
          <FormField label="Parent contact"><TextInput value={parentContact} onChange={(event) => setParentContact(event.target.value)} /></FormField>
          <FormField label="NGO partner">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={ngoPartnerId} onChange={(event) => setNgoPartnerId(event.target.value)}>
              <option value="">Direct / none</option>
              {ngoPartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            </select>
          </FormField>
          <FormField label="Status"><StatusSelect value={status} onChange={setStatus} /></FormField>
        </div>
        <SubmitRow busy={busy} label="Save student" message={message} error={error} />
      </form>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-950">Linked guardians</h4>
        <div className="mt-3 grid gap-2">
          {linkedGuardians.map(({ guardian, link }) => (
            <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>{guardian.full_name} | {link.relationship_type} | {link.can_receive_reports ? 'Reports allowed' : 'No reports'}</span>
              <button className="text-xs font-semibold text-red-700 underline" disabled={busy} type="button" onClick={() => void runGuardianLinkAction(async () => deactivateGuardianLink(link.id), 'Guardian link removed.')}>Remove</button>
            </div>
          ))}
          {!linkedGuardians.length ? <p className="text-sm text-slate-600">No guardians linked.</p> : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={guardianId} onChange={(event) => setGuardianId(event.target.value)}>
            <option value="">Choose guardian</option>
            {guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.full_name}</option>)}
          </select>
          <TextInput value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} placeholder="mother, father, guardian" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /> Primary contact</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={canReceiveReports} onChange={(event) => setCanReceiveReports(event.target.checked)} /> Can receive reports</label>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !guardianId} type="button" onClick={() => void runGuardianLinkAction(async () => {
            await linkGuardianToStudent({ studentId: student.id, guardianId, relationshipType, isPrimary, canReceiveReports, status: 'active' });
            setGuardianId('');
            setRelationshipType('guardian');
            setIsPrimary(false);
            setCanReceiveReports(true);
          }, 'Guardian linked.')}>
            Link guardian
          </button>
        </div>
      </div>
    </article>
  );

  async function runGuardianLinkAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(success);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guardian link update failed.');
    } finally {
      setBusy(false);
    }
  }
}

function GuardianRecordCard({ guardian, onSaved }: { guardian: Guardian & { linked_students?: Array<StudentGuardian & { student_name?: string }> }; onSaved: () => Promise<void> }) {
  const [input, setInput] = useState({
    profileId: guardian.profile_id || '',
    fullName: guardian.full_name || '',
    email: guardian.email || '',
    phone: guardian.phone || '',
    communicationPreference: guardian.communication_preference || 'email',
    notes: guardian.notes || '',
    status: normalizeStatus(guardian.status),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateGuardianRecord({ guardianId: guardian.id, ...input });
      setMessage('Guardian updated.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update guardian.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{guardian.full_name}</h3>
          <p className="mt-1 text-sm text-slate-600">{guardian.email || guardian.phone || 'Contact pending'}</p>
        </div>
        <StatusBadge value={guardian.status} />
      </div>
      <GuardianFields input={input} setInput={setInput} onSubmit={submit} busy={busy} submitLabel="Save guardian" message={message} error={error} />
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        {(guardian.linked_students || []).filter((link) => link.status === 'active').map((link) => (
          <p key={link.id}>{link.student_name || link.student_id} | {link.relationship_type}</p>
        ))}
        {!(guardian.linked_students || []).some((link) => link.status === 'active') ? <p>No active student links.</p> : null}
      </div>
    </article>
  );
}

function GuardianFields({
  input,
  setInput,
  onSubmit,
  busy,
  submitLabel,
  message,
  error,
}: {
  input: ReturnType<typeof emptyGuardianInput>;
  setInput: (input: ReturnType<typeof emptyGuardianInput>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  submitLabel: string;
  message: string | null;
  error: string | null;
}) {
  const update = (patch: Partial<ReturnType<typeof emptyGuardianInput>>) => setInput({ ...input, ...patch });
  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      <FormField label="Guardian name"><TextInput required value={input.fullName} onChange={(event) => update({ fullName: event.target.value })} /></FormField>
      <FormField label="Email"><TextInput type="email" value={input.email} onChange={(event) => update({ email: event.target.value })} /></FormField>
      <FormField label="Phone"><TextInput value={input.phone} onChange={(event) => update({ phone: event.target.value })} /></FormField>
      <FormField label="Communication preference"><TextInput value={input.communicationPreference} onChange={(event) => update({ communicationPreference: event.target.value })} placeholder="email, sms, whatsapp" /></FormField>
      <FormField label="Linked parent profile ID"><TextInput value={input.profileId} onChange={(event) => update({ profileId: event.target.value })} /></FormField>
      <FormField label="Status"><StatusSelect value={input.status} onChange={(status) => update({ status })} /></FormField>
      <div className="sm:col-span-2">
        <FormField label="Notes"><TextInput value={input.notes} onChange={(event) => update({ notes: event.target.value })} /></FormField>
      </div>
      <SubmitRow busy={busy} label={submitLabel} message={message} error={error} />
    </form>
  );
}

function emptyGuardianInput() {
  return {
    profileId: '',
    fullName: '',
    email: '',
    phone: '',
    communicationPreference: 'email',
    notes: '',
    status: 'active' as RecordStatus,
  };
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

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Data unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
