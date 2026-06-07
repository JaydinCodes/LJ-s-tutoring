import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { ErrorState, InlineFeedback, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentStatus, AssignmentSubmission } from '../../types/lms';
import { createAssignment, markSubmission, updateAssignment } from '../assignments/assignmentMutations';
import { loadAdminDashboard } from './adminDashboardRepository';

export function AdminAssignmentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Assignment Management" subtitle="Admin view for published work, due dates, status, and future creation workflows." section="admin">
      <CreateAssignmentForm onCreated={reload} />
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Assignments</h2>
        <p className="mt-1 text-sm text-slate-600">Edit assignment details, close submissions, or archive old work without touching legacy static pages.</p>
        {loading ? <LoadingState title="Loading assignments" description="Fetching current assignment records and submission counts..." /> : null}
        {error ? <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
        {data ? (
          <div className="mt-5 space-y-5">
            <DataTable<Assignment>
              rows={data.assignments}
              empty="No assignments are available yet."
              columns={[
                { key: 'title', label: 'Title', render: (row) => <span className="font-semibold text-slate-950">{row.title || row.id}</span> },
                { key: 'subject', label: 'Subject', render: (row) => row.subject || row.subject_id || 'Pending' },
                { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'draft'} /> },
              ]}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.assignments.map((assignment) => (
                <AssignmentLifecycleCard key={assignment.id} assignment={assignment} onSaved={reload} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Review submissions</h2>
        <p className="mt-1 text-sm text-slate-600">Mark submitted work, return it for revision, and write feedback visible to learners.</p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data?.submissions.length ? data.submissions.map((submission) => (
            <SubmissionReviewCard key={submission.id} submission={submission} onSaved={reload} />
          )) : <EmptyState title="No submissions yet" description="Learner submissions will appear here after students submit published assignments." />}
        </div>
      </Card>
    </DashboardShell>
  );
}

function AssignmentLifecycleCard({ assignment, onSaved }: { assignment: Assignment; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [subjectName, setSubjectName] = useState('');
  const [grade, setGrade] = useState(assignment.grade || '');
  const [curriculum, setCurriculum] = useState('CAPS');
  const [dueDate, setDueDate] = useState(toDateInputValue(assignment.due_date));
  const [status, setStatus] = useState<AssignmentStatus>(normalizeAssignmentStatus(assignment.status));
  const [rubricJson, setRubricJson] = useState(JSON.stringify(assignment.rubric_json || [], null, 2));
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveAssignment(nextStatus = status) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateAssignment({ assignmentId: assignment.id, title, description, subjectName, grade, curriculum, dueDate, status: nextStatus, attachment, rubricJson });
      setAttachment(null);
      setStatus(nextStatus);
      setMessage('Assignment updated.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update assignment.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAssignment();
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{assignment.title || assignment.id}</h3>
          <p className="mt-1 text-sm text-slate-600">{[assignment.grade, `Due ${formatDate(assignment.due_date)}`].filter(Boolean).join(' | ')}</p>
        </div>
        <StatusBadge value={status} />
      </div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <FormField label="Title">
          <TextInput required value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="New subject" hint={assignment.subject_id ? `Current: ${assignment.subject || assignment.subject_id}` : 'Leave blank to keep subject pending.'}>
            <TextInput value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Mathematics" />
          </FormField>
          <FormField label="Curriculum">
            <TextInput value={curriculum} onChange={(event) => setCurriculum(event.target.value)} />
          </FormField>
          <FormField label="Grade">
            <TextInput value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 11" />
          </FormField>
          <FormField label="Due date">
            <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as AssignmentStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>
          <FormField label="Replace attachment" hint={assignment.attachment_url ? `Current: ${assignment.attachment_url}` : 'Optional worksheet or supporting file.'}>
            <TextInput type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
          </FormField>
        </div>
        <FormField label="Description">
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </FormField>
        <FormField label="Rubric JSON">
          <TextArea value={rubricJson} onChange={(event) => setRubricJson(event.target.value)} placeholder='[{"id":"method","label":"Method","maxMarks":40}]' />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save assignment'}
          </button>
          <button disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveAssignment('closed')}>
            Close
          </button>
          <button disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveAssignment('archived')}>
            Archive
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>{error}</InlineFeedback> : null}
        </div>
      </form>
    </article>
  );
}

function SubmissionReviewCard({
  submission,
  onSaved,
}: {
  submission: AssignmentSubmission & { assignment_title?: string; student_name?: string };
  onSaved: () => Promise<void>;
}) {
  const [marksAwarded, setMarksAwarded] = useState(submission.marks_awarded == null ? '' : String(submission.marks_awarded));
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [rubricScoresJson, setRubricScoresJson] = useState(JSON.stringify(submission.rubric_scores_json || {}, null, 2));
  const [marksReleased, setMarksReleased] = useState(Boolean(submission.marks_released));
  const [feedbackReleased, setFeedbackReleased] = useState(Boolean(submission.feedback_released));
  const [status, setStatus] = useState<'submitted' | 'marked' | 'returned'>(
    submission.status === 'marked' || submission.status === 'returned' ? submission.status : 'marked',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await markSubmission({ submissionId: submission.id, marksAwarded, feedback, status, rubricScoresJson, marksReleased, feedbackReleased });
      setMessage('Submission updated.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update submission.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{submission.assignment_title || submission.assignment_id}</h3>
          <p className="mt-1 text-sm text-slate-600">{submission.student_name || submission.student_id}</p>
        </div>
        <StatusBadge value={submission.status === 'returned' ? 'returned_for_correction' : submission.status === 'submitted' ? 'under_review' : submission.status} />
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-600">
        <div><dt className="font-semibold text-slate-800">Submitted</dt><dd>{formatDate(submission.submitted_at)}</dd></div>
        {submission.file_url ? <div><dt className="font-semibold text-slate-800">File</dt><dd className="break-all font-mono text-xs">{submission.file_url}</dd></div> : null}
        {submission.text_answer ? <div><dt className="font-semibold text-slate-800">Answer</dt><dd className="rounded-lg bg-slate-50 p-3">{submission.text_answer}</dd></div> : null}
      </dl>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Marks awarded">
            <TextInput type="number" min="0" max="100" step="0.01" value={marksAwarded} onChange={(event) => setMarksAwarded(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'submitted' | 'marked' | 'returned')}>
              <option value="marked">Marked</option>
              <option value="returned">Returned for correction</option>
              <option value="submitted">Under review</option>
            </select>
          </FormField>
        </div>
        <FormField label="Feedback">
          <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback for the learner..." />
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
            {busy ? 'Saving...' : 'Save review'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>Marking or release failed. {error}</InlineFeedback> : null}
        </div>
      </form>
    </article>
  );
}

function CreateAssignmentForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [grade, setGrade] = useState('');
  const [curriculum, setCurriculum] = useState('CAPS');
  const [dueDate, setDueDate] = useState('');
  const [rubricJson, setRubricJson] = useState('[]');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createAssignment({ title, description, subjectName, grade, curriculum, dueDate, attachment, rubricJson });
      setTitle('');
      setDescription('');
      setSubjectName('');
      setGrade('');
      setCurriculum('CAPS');
      setDueDate('');
      setRubricJson('[]');
      setAttachment(null);
      setMessage('Assignment published.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create assignment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Create assignment</h2>
          <p className="mt-1 text-sm text-slate-600">Publish learner work with a subject, grade, due date, and optional supporting file.</p>
        </div>
        <StatusBadge value="supabase_required" />
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Title">
          <TextInput required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Algebra consolidation task" />
        </FormField>
        <FormField label="Subject">
          <TextInput required value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Mathematics" />
        </FormField>
        <FormField label="Grade">
          <TextInput required value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 11" />
        </FormField>
        <FormField label="Curriculum">
          <TextInput value={curriculum} onChange={(event) => setCurriculum(event.target.value)} placeholder="CAPS" />
        </FormField>
        <FormField label="Due date">
          <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </FormField>
        <FormField label="Attachment" hint="Optional worksheet, memo, or supporting file.">
          <TextInput type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
        </FormField>
        <div className="lg:col-span-2">
          <FormField label="Description">
            <TextArea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Instructions, expected work, submission notes..." />
          </FormField>
        </div>
        <div className="lg:col-span-2">
          <FormField label="Rubric JSON" hint="Define criteria as an array; keep IDs stable for marking.">
            <TextArea value={rubricJson} onChange={(event) => setRubricJson(event.target.value)} placeholder='[{"id":"method","label":"Method","maxMarks":40}]' />
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Publishing...' : 'Publish assignment'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>{error}</InlineFeedback> : null}
        </div>
      </form>
    </Card>
  );
}

function normalizeAssignmentStatus(value: string): AssignmentStatus {
  return value === 'draft' || value === 'closed' || value === 'archived' ? value : 'published';
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return '';
  }
  return new Date(value).toISOString().slice(0, 10);
}

