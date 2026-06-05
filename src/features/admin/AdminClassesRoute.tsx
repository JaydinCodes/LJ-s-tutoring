import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { RecordStatus } from '../../types/lms';
import type { AdminClassManagementView, AdminClassRecord } from './classManagementRepository';
import { loadAdminClassManagement } from './classManagementRepository';
import { archiveClassRecord, assignStudentToClass, createClassRecord, removeStudentFromClass, updateClassRecord, type ClassInput } from './classManagementMutations';

export function AdminClassesRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminClassManagement, []);

  return (
    <DashboardShell title="Classes" subtitle="Create cohorts, link tutors, and manage student enrolments without deleting historical records." section="admin">
      <CreateClassForm data={data ?? undefined} onSaved={reload} />
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading classes...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="space-y-5">
            <DataTable<AdminClassRecord>
              rows={data.classes}
              empty="No classes or cohorts have been created yet."
              columns={[
                { key: 'name', label: 'Class', render: (row) => <span className="font-semibold text-slate-950">{row.name}</span> },
                { key: 'tutor', label: 'Tutor', render: (row) => row.tutor_name || row.tutor_id },
                { key: 'subject', label: 'Subject', render: (row) => row.subject_name || 'Pending' },
                { key: 'schedule', label: 'Schedule', render: (row) => [row.day_of_week, row.start_time, row.end_time].filter(Boolean).join(' | ') || 'Pending' },
                { key: 'students', label: 'Students', render: (row) => String(row.enrolled_students.filter((student) => student.enrollment_status === 'active').length) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              ]}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.classes.map((classRecord) => (
                <ClassCard key={classRecord.id} classRecord={classRecord} data={data} onSaved={reload} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

function CreateClassForm({ data, onSaved }: { data?: AdminClassManagementView; onSaved: () => Promise<void> }) {
  const empty = emptyClassInput();
  const [input, setInput] = useState<ClassInput>(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createClassRecord(input);
      setInput(emptyClassInput());
      setMessage('Class created.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create class.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Create class or cohort</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Classes group learners, tutors, subjects, locations, and NGO rollout context.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <ClassFields data={data} input={input} onChange={setInput} onSubmit={submit} busy={busy} submitLabel="Create class" message={message} error={error} />
    </Card>
  );
}

function ClassCard({ classRecord, data, onSaved }: { classRecord: AdminClassRecord; data: AdminClassManagementView; onSaved: () => Promise<void> }) {
  const [input, setInput] = useState<ClassInput>(classInputFromRecord(classRecord));
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await updateClassRecord(classRecord.id, input);
      setMessage('Class updated.');
    });
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await action();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Class update failed.');
    } finally {
      setBusy(false);
    }
  }

  const activeStudents = classRecord.enrolled_students.filter((student) => student.enrollment_status === 'active');

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{classRecord.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{[classRecord.tutor_name, classRecord.subject_name, classRecord.grade].filter(Boolean).join(' | ') || 'Setup pending'}</p>
        </div>
        <StatusBadge value={classRecord.status} />
      </div>
      <ClassFields data={data} input={input} onChange={setInput} onSubmit={submit} busy={busy} submitLabel="Save class" message={message} error={error} />
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-950">Students</h4>
        {activeStudents.length ? (
          <div className="mt-3 grid gap-2">
            {activeStudents.map((student) => (
              <div key={student.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{student.full_name || student.email || student.id}</span>
                <button disabled={busy} className="text-xs font-semibold text-red-700 underline" type="button" onClick={() => void runAction(async () => {
                  await removeStudentFromClass(classRecord.id, student.id);
                  setMessage('Student removed from class.');
                })}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">No active students assigned.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Choose student</option>
            {data.students.map((student) => <option key={student.id} value={student.id}>{student.full_name || student.email || student.id}</option>)}
          </select>
          <button disabled={busy || !studentId} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void runAction(async () => {
            await assignStudentToClass(classRecord.id, studentId);
            setStudentId('');
            setMessage('Student assigned.');
          })}>
            Assign
          </button>
          <button disabled={busy || classRecord.status === 'inactive'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void runAction(async () => {
            await archiveClassRecord(classRecord.id);
            setMessage('Class archived.');
          })}>
            Archive
          </button>
        </div>
      </div>
    </article>
  );
}

function ClassFields({
  data,
  input,
  onChange,
  onSubmit,
  busy,
  submitLabel,
  message,
  error,
}: {
  data?: AdminClassManagementView;
  input: ClassInput;
  onChange: (input: ClassInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  submitLabel: string;
  message: string | null;
  error: string | null;
}) {
  const update = (patch: Partial<ClassInput>) => onChange({ ...input, ...patch });
  return (
    <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={onSubmit}>
      <FormField label="Class name"><TextInput required value={input.name} onChange={(event) => update({ name: event.target.value })} /></FormField>
      <FormField label="Tutor">
        <select required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={input.tutorId} onChange={(event) => update({ tutorId: event.target.value })}>
          <option value="">Choose tutor</option>
          {(data?.tutors || []).map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.full_name || tutor.email || tutor.id}</option>)}
        </select>
      </FormField>
      <FormField label="Subject">
        <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={input.subjectId || ''} onChange={(event) => update({ subjectId: event.target.value })}>
          <option value="">No subject</option>
          {(data?.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{[subject.name, subject.grade].filter(Boolean).join(' | ')}</option>)}
        </select>
      </FormField>
      <FormField label="Grade"><TextInput value={input.grade || ''} onChange={(event) => update({ grade: event.target.value })} placeholder="Grade 11" /></FormField>
      <FormField label="Location"><TextInput value={input.location || ''} onChange={(event) => update({ location: event.target.value })} /></FormField>
      <FormField label="Day of week"><TextInput value={input.dayOfWeek || ''} onChange={(event) => update({ dayOfWeek: event.target.value })} placeholder="Tuesday" /></FormField>
      <FormField label="Start time"><TextInput type="time" value={input.startTime || ''} onChange={(event) => update({ startTime: event.target.value })} /></FormField>
      <FormField label="End time"><TextInput type="time" value={input.endTime || ''} onChange={(event) => update({ endTime: event.target.value })} /></FormField>
      <FormField label="NGO partner">
        <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={input.ngoPartnerId || ''} onChange={(event) => update({ ngoPartnerId: event.target.value })}>
          <option value="">Direct / none</option>
          {(data?.ngoPartners || []).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
      </FormField>
      <FormField label="Status"><StatusSelect value={input.status} onChange={(status) => update({ status })} /></FormField>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
          {busy ? 'Saving...' : submitLabel}
        </button>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}

function StatusSelect({ value, onChange }: { value: RecordStatus; onChange: (status: RecordStatus) => void }) {
  return (
    <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={value} onChange={(event) => onChange(event.target.value as RecordStatus)}>
      <option value="active">Active</option>
      <option value="pending">Pending</option>
      <option value="inactive">Archived / inactive</option>
      <option value="suspended">Suspended</option>
    </select>
  );
}

function emptyClassInput(): ClassInput {
  return {
    name: '',
    tutorId: '',
    subjectId: '',
    grade: '',
    location: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    ngoPartnerId: '',
    status: 'active',
  };
}

function classInputFromRecord(classRecord: AdminClassRecord): ClassInput {
  return {
    name: classRecord.name,
    tutorId: classRecord.tutor_id,
    subjectId: classRecord.subject_id || '',
    grade: classRecord.grade || '',
    location: classRecord.location || '',
    dayOfWeek: classRecord.day_of_week || '',
    startTime: classRecord.start_time || '',
    endTime: classRecord.end_time || '',
    ngoPartnerId: classRecord.ngo_partner_id || '',
    status: classRecord.status,
  };
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Classes unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
