import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import { submitAssignment } from '../assignments/assignmentMutations';
import { loadStudentDashboard } from './studentDashboardRepository';

export function StudentAssignmentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadStudentDashboard, []);
  const submitted = new Set((data?.submissions || []).map((item) => item.assignment_id));
  const submissionByAssignment = new Map((data?.submissions || []).map((item) => [item.assignment_id, item]));

  return (
    <DashboardShell
      title="Student Assignments"
      subtitle="Learner assignment status from Supabase first, with the current LMS API as a migration fallback."
      section="student"
    >
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading assignments...</p> : null}
        {error ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Assignments unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
        {data ? (
          <DataTable<Assignment>
            rows={data.assignments}
            empty="No assignments are currently assigned."
            columns={[
              { key: 'title', label: 'Assignment', render: (row) => <span className="font-semibold text-slate-950">{row.title}</span> },
              { key: 'subject', label: 'Subject', render: (row) => row.subject || 'Subject pending' },
              { key: 'grade', label: 'Grade', render: (row) => row.grade || data.profile.grade || 'Pending' },
              { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
              { key: 'submission', label: 'Submission', render: (row) => <StatusBadge value={submitted.has(row.id) ? 'submitted' : 'not_submitted'} /> },
            ]}
          />
        ) : null}
      </Card>
      {data?.assignments.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {data.assignments.map((assignment) => (
            <AssignmentSubmissionPanel
              key={assignment.id}
              assignment={assignment}
              submitted={submitted.has(assignment.id)}
              submission={submissionByAssignment.get(assignment.id)}
              onSubmitted={reload}
            />
          ))}
        </section>
      ) : null}
    </DashboardShell>
  );
}

function AssignmentSubmissionPanel({
  assignment,
  submitted,
  submission,
  onSubmitted,
}: {
  assignment: Assignment;
  submitted: boolean;
  submission?: AssignmentSubmission;
  onSubmitted: () => Promise<void>;
}) {
  const [textAnswer, setTextAnswer] = useState(submission?.text_answer || '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isClosed = assignment.status === 'closed' || assignment.status === 'archived';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await submitAssignment({ assignmentId: assignment.id, textAnswer, file });
      setTextAnswer('');
      setFile(null);
      setMessage('Submission saved to Supabase.');
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit assignment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{assignment.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {[assignment.subject || assignment.subject_id || 'Subject pending', assignment.grade, `Due ${formatDate(assignment.due_date)}`].filter(Boolean).join(' | ')}
          </p>
        </div>
        <StatusBadge value={submission?.status || (submitted ? 'submitted' : 'not_submitted')} />
      </div>
      {assignment.description ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{assignment.description}</p> : null}
      {assignment.attachment_url ? <p className="mt-3 text-sm text-slate-600">Attachment path: <span className="font-mono">{assignment.attachment_url}</span></p> : null}
      {isClosed ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">This assignment is closed and no longer accepts submissions.</p> : null}
      {submission ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-950">Submitted:</span> {formatDate(submission.submitted_at)}</p>
          {submission.file_url ? <p className="mt-1 break-all"><span className="font-semibold text-slate-950">File:</span> <span className="font-mono text-xs">{submission.file_url}</span></p> : null}
          {submission.marks_awarded != null ? <p className="mt-1"><span className="font-semibold text-slate-950">Marks:</span> {submission.marks_awarded}</p> : null}
          {submission.feedback ? <p className="mt-2 rounded bg-white p-3"><span className="font-semibold text-slate-950">Feedback:</span> {submission.feedback}</p> : null}
        </div>
      ) : null}
      <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
        <FormField label="Written answer" hint="Use this for short answers, links, or notes to your tutor.">
          <TextArea disabled={isClosed} value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} placeholder="Type your answer or submission note..." />
        </FormField>
        <FormField label="Upload file" hint="Optional. Stored in the private assignment-submissions bucket.">
          <TextInput disabled={isClosed} type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy || isClosed} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Submitting...' : submitted ? 'Update submission' : 'Submit assignment'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </Card>
  );
}
