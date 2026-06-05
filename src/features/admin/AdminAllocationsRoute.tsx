import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { RecordStatus } from '../../types/lms';
import type { AdminAllocationManagementView, AdminTutorStudentAllocation } from './allocationManagementRepository';
import { loadAdminAllocationManagement } from './allocationManagementRepository';
import { assignTutorToStudent, deactivateTutorStudentAllocation, updateTutorStudentAllocation, type AllocationInput } from './allocationManagementMutations';

export function AdminAllocationsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminAllocationManagement, []);

  return (
    <DashboardShell title="Tutor Allocations" subtitle="Assign learners to tutors and preserve allocation history for operations and reporting." section="admin">
      <CreateAllocationForm data={data ?? undefined} onSaved={reload} />
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading tutor allocations...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="space-y-5">
            <DataTable<AdminTutorStudentAllocation>
              rows={data.allocations}
              empty="No tutor-student allocations have been created yet."
              columns={[
                { key: 'student', label: 'Student', render: (row) => <span className="font-semibold text-slate-950">{row.student_name || row.student_email || row.student_id}</span> },
                { key: 'tutor', label: 'Tutor', render: (row) => row.tutor_name || row.tutor_email || row.tutor_id },
                { key: 'grade', label: 'Grade', render: (row) => row.student_grade || 'Pending' },
                { key: 'dates', label: 'Dates', render: (row) => [row.start_date, row.end_date].filter(Boolean).join(' to ') || 'Open' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              ]}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.allocations.map((allocation) => (
                <AllocationCard key={allocation.id} allocation={allocation} data={data} onSaved={reload} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

function CreateAllocationForm({ data, onSaved }: { data?: AdminAllocationManagementView; onSaved: () => Promise<void> }) {
  const [input, setInput] = useState<AllocationInput>(emptyAllocationInput());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await assignTutorToStudent(input);
      setInput(emptyAllocationInput());
      setMessage('Tutor allocated to student.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create allocation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Assign student to tutor</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Allocations control which learners a tutor can see outside class-specific cohorts.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <AllocationFields data={data} input={input} onChange={setInput} onSubmit={submit} busy={busy} submitLabel="Assign tutor" message={message} error={error} />
    </Card>
  );
}

function AllocationCard({ allocation, data, onSaved }: { allocation: AdminTutorStudentAllocation; data: AdminAllocationManagementView; onSaved: () => Promise<void> }) {
  const [input, setInput] = useState<AllocationInput>(allocationInputFromRecord(allocation));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await action();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await updateTutorStudentAllocation(allocation.id, input);
      setMessage('Allocation updated.');
    });
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{allocation.student_name || allocation.student_email || allocation.student_id}</h3>
          <p className="mt-1 text-sm text-slate-600">{allocation.tutor_name || allocation.tutor_email || allocation.tutor_id}</p>
        </div>
        <StatusBadge value={allocation.status} />
      </div>
      <AllocationFields data={data} input={input} onChange={setInput} onSubmit={submit} busy={busy} submitLabel="Save allocation" message={message} error={error} />
      <button disabled={busy || allocation.status === 'inactive'} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void run(async () => {
        await deactivateTutorStudentAllocation(allocation.id);
        setMessage('Allocation deactivated.');
      })}>
        Deactivate allocation
      </button>
    </article>
  );
}

function AllocationFields({
  data,
  input,
  onChange,
  onSubmit,
  busy,
  submitLabel,
  message,
  error,
}: {
  data?: AdminAllocationManagementView;
  input: AllocationInput;
  onChange: (input: AllocationInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  submitLabel: string;
  message: string | null;
  error: string | null;
}) {
  const update = (patch: Partial<AllocationInput>) => onChange({ ...input, ...patch });
  return (
    <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={onSubmit}>
      <FormField label="Tutor">
        <select required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={input.tutorId} onChange={(event) => update({ tutorId: event.target.value })}>
          <option value="">Choose tutor</option>
          {(data?.tutors || []).map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.full_name || tutor.email || tutor.id}</option>)}
        </select>
      </FormField>
      <FormField label="Student">
        <select required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={input.studentId} onChange={(event) => update({ studentId: event.target.value })}>
          <option value="">Choose student</option>
          {(data?.students || []).map((student) => <option key={student.id} value={student.id}>{student.full_name || student.email || student.id}</option>)}
        </select>
      </FormField>
      <FormField label="Start date"><TextInput type="date" value={input.startDate || ''} onChange={(event) => update({ startDate: event.target.value })} /></FormField>
      <FormField label="End date"><TextInput type="date" value={input.endDate || ''} onChange={(event) => update({ endDate: event.target.value })} /></FormField>
      <FormField label="Status"><StatusSelect value={input.status} onChange={(status) => update({ status })} /></FormField>
      <div className="lg:col-span-2">
        <FormField label="Focus notes" hint="Internal operational notes for this allocation.">
          <TextArea value={input.focusNotes || ''} onChange={(event) => update({ focusNotes: event.target.value })} />
        </FormField>
      </div>
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
      <option value="inactive">Inactive</option>
      <option value="suspended">Suspended</option>
    </select>
  );
}

function emptyAllocationInput(): AllocationInput {
  return { tutorId: '', studentId: '', status: 'active', startDate: '', endDate: '', focusNotes: '' };
}

function allocationInputFromRecord(allocation: AdminTutorStudentAllocation): AllocationInput {
  return {
    tutorId: allocation.tutor_id,
    studentId: allocation.student_id,
    status: allocation.status,
    startDate: allocation.start_date || '',
    endDate: allocation.end_date || '',
    focusNotes: allocation.focus_notes || '',
  };
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Allocations unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
