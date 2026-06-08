import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { ErrorState, InlineFeedback, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { captureAppError } from '../../lib/monitoring/errorReporting';
import { formatDate } from '../../lib/utils/format';
import type { DashboardMetric } from '../../types/lms';
import { markSubmission } from '../assignments/assignmentMutations';
import type { AdminMarkbookRow } from './adminMarkbookRepository';
import { loadAdminMarkbook, summarizeRows } from './adminMarkbookRepository';

export function AdminResultsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminMarkbook, []);
  const [classId, setClassId] = useState('all');
  const [assignmentId, setAssignmentId] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [selected, setSelected] = useState<AdminMarkbookRow | null>(null);

  const rows = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return (data?.rows || []).filter((row) => {
      const matchesClass = classId === 'all' || row.class_ids.includes(classId);
      const matchesAssignment = assignmentId === 'all' || row.assignment_id === assignmentId;
      const matchesStudent = !query || [row.student_name, row.student_grade, row.student_school].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesClass && matchesAssignment && matchesStudent;
    });
  }, [assignmentId, classId, data?.rows, studentSearch]);
  const summary = summarizeRows(rows);

  return (
    <DashboardShell title="Admin Markbook" subtitle="Review results by learner, class, assignment, and subject using Supabase-secured mark writes." section="admin">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics(summary).map((metric) => <StatCard key={metric.label} metric={metric} />)}
      </section>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Results filters</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Filter by cohort/class, assignment, or learner before editing marks.</p>
          </div>
          <StatusBadge value="rpc_secured" />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <FormField label="Class or cohort">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="all">All classes</option>
              {(data?.classes || []).map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>)}
            </select>
          </FormField>
          <FormField label="Assignment">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              <option value="all">All assignments</option>
              {(data?.assignments || []).map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}
            </select>
          </FormField>
          <FormField label="Learner search">
            <TextInput value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name, grade, or school" />
          </FormField>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Markbook table</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Rows represent submitted learner work. Use the edit panel to update marks through the secured RPC.</p>
          {loading ? <LoadingState title="Loading markbook" description="Fetching submitted work and release status..." /> : null}
          {error ? <ErrorState title="Markbook unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
          {data ? (
            <div className="mt-5">
              <DataTable<AdminMarkbookRow>
                rows={rows}
                empty="No submissions match these filters."
                columns={[
                  { key: 'student', label: 'Student', render: (row) => <StudentCell row={row} /> },
                  { key: 'assignment', label: 'Assignment', render: (row) => <AssignmentCell row={row} /> },
                  { key: 'class', label: 'Class', render: (row) => row.class_names.join(', ') || 'Unassigned' },
                  { key: 'mark', label: 'Mark', render: (row) => row.marks_awarded == null ? 'Pending' : `${row.marks_awarded}%` },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                  { key: 'action', label: 'Action', render: (row) => <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800" onClick={() => setSelected(row)}>Edit</button> },
                ]}
              />
            </div>
          ) : null}
        </Card>

        <MarkEditPanel row={selected} onSaved={async () => {
          setSelected(null);
          await reload();
        }} />
      </section>
    </DashboardShell>
  );
}

function MarkEditPanel({ row, onSaved }: { row: AdminMarkbookRow | null; onSaved: () => Promise<void> }) {
  const [marksAwarded, setMarksAwarded] = useState(row?.marks_awarded == null ? '' : String(row.marks_awarded));
  const [feedback, setFeedback] = useState(row?.feedback || '');
  const [rubricScoresJson, setRubricScoresJson] = useState(JSON.stringify(row?.rubric_scores_json || {}, null, 2));
  const [marksReleased, setMarksReleased] = useState(Boolean(row?.marks_released));
  const [feedbackReleased, setFeedbackReleased] = useState(Boolean(row?.feedback_released));
  const [status, setStatus] = useState<'submitted' | 'marked' | 'returned'>(row?.status === 'returned' ? 'returned' : row?.status === 'submitted' ? 'submitted' : 'marked');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarksAwarded(row?.marks_awarded == null ? '' : String(row.marks_awarded));
    setFeedback(row?.feedback || '');
    setRubricScoresJson(JSON.stringify(row?.rubric_scores_json || {}, null, 2));
    setMarksReleased(Boolean(row?.marks_released));
    setFeedbackReleased(Boolean(row?.feedback_released));
    setStatus(row?.status === 'returned' ? 'returned' : row?.status === 'submitted' ? 'submitted' : 'marked');
    setMessage(null);
    setError(null);
  }, [row]);

  if (!row) {
    return (
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Edit mark</h2>
        <EmptyState title="No submission selected" description="Choose a markbook row to enter marks, feedback, or return work for correction." />
      </Card>
    );
  }
  const selectedRow = row;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await markSubmission({ submissionId: selectedRow.id, marksAwarded, feedback, status, rubricScoresJson, marksReleased, feedbackReleased });
      setMessage('Markbook row updated.');
      await onSaved();
    } catch (err) {
      captureAppError(err, {
        featureArea: 'admin',
        action: 'admin_result_release.save_failed',
        role: 'admin',
        metadata: {
          submission_id: selectedRow.id,
          status,
          marks_released: marksReleased,
          feedback_released: feedbackReleased,
        },
      });
      setError(err instanceof Error ? err.message : 'Could not update markbook row.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Edit mark</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{selectedRow.student_name} | {selectedRow.assignment_title}</p>
      <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
        <FormField label="Marks awarded" hint="Must be between 0 and 100.">
          <TextInput type="number" min="0" max="100" step="0.01" value={marksAwarded} onChange={(event) => setMarksAwarded(event.target.value)} />
        </FormField>
        <FormField label="Status">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'submitted' | 'marked' | 'returned')}>
            <option value="marked">Marked</option>
            <option value="returned">Returned for correction</option>
            <option value="submitted">Under review</option>
          </select>
        </FormField>
        <FormField label="Feedback">
          <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback visible to the learner after release rules permit it." />
        </FormField>
        <FormField label="Rubric scores JSON">
          <TextArea value={rubricScoresJson} onChange={(event) => setRubricScoresJson(event.target.value)} placeholder='{"method": 32, "accuracy": 18}' />
        </FormField>
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={marksReleased} onChange={(event) => setMarksReleased(event.target.checked)} /> Release marks to learner</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={feedbackReleased} onChange={(event) => setFeedbackReleased(event.target.checked)} /> Release feedback and rubric to learner</label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save mark'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>Marking or result release failed. {error}</InlineFeedback> : null}
        </div>
      </form>
    </Card>
  );
}

function metrics(summary: { totalSubmissions: number; markedSubmissions: number; pendingSubmissions: number; averageMark: number | null }): DashboardMetric[] {
  return [
    { label: 'Submissions', value: String(summary.totalSubmissions), helper: 'Rows in the current markbook filter.', tone: 'teal' },
    { label: 'Marked', value: String(summary.markedSubmissions), helper: 'Rows with marks captured.', tone: 'violet' },
    { label: 'Pending', value: String(summary.pendingSubmissions), helper: 'Rows still needing marks.', tone: 'amber' },
    { label: 'Average mark', value: summary.averageMark == null ? '--' : `${summary.averageMark}%`, helper: 'Average of marked rows in this view.', tone: 'blue' },
  ];
}

function StudentCell({ row }: { row: AdminMarkbookRow }) {
  return (
    <div>
      <p className="font-semibold text-slate-950">{row.student_name}</p>
      <p className="mt-1 text-xs text-slate-500">{[row.student_grade, row.student_school].filter(Boolean).join(' | ') || row.student_id}</p>
    </div>
  );
}

function AssignmentCell({ row }: { row: AdminMarkbookRow }) {
  return (
    <div>
      <p className="font-semibold text-slate-950">{row.assignment_title}</p>
      <p className="mt-1 text-xs text-slate-500">{[row.subject_name, row.assignment_grade, formatDate(row.submitted_at)].filter(Boolean).join(' | ')}</p>
    </div>
  );
}
