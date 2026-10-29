import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
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
import type { Assignment, AssignmentStatus, AssignmentSubmission, DashboardMetric, TutorAllocatedStudentSummary } from '../../types/lms';
import { getAiGradingPrefill } from '../assignments/aiGradingPrefill';
import { createAssignment, markSubmission, updateAssignment } from '../assignments/assignmentMutations';
import { loadAdminDashboard } from './adminDashboardRepository';

export function AdminAssignmentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<'all' | AssignmentStatus>('all');
  const [submissionStatus, setSubmissionStatus] = useState<'all' | 'submitted' | 'marked' | 'returned'>('all');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const selectedAssignment = data?.assignments.find((assignment) => assignment.id === selectedAssignmentId) || null;
  const selectedSubmission = data?.submissions.find((submission) => submission.id === selectedSubmissionId) || null;
  const assignments = useMemo(() => filterAssignments(data?.assignments || [], assignmentStatus, assignmentSearch), [assignmentSearch, assignmentStatus, data?.assignments]);
  const submissions = useMemo(() => filterSubmissions(data?.submissions || [], submissionStatus, assignmentSearch), [assignmentSearch, data?.submissions, submissionStatus]);
  const metrics = useMemo(() => assignmentMetrics(data?.assignments || [], data?.submissions || []), [data?.assignments, data?.submissions]);

  return (
    <DashboardShell title="Assignment Management" subtitle="Create, prepare, publish and manage learner assignments." section="admin">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
      </section>
      <CreateAssignmentForm onCreated={reload} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_31rem]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Assignment library</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Find work by title, subject, grade, or lifecycle state, then open it in the editor.</p>
            </div>
            <StatusBadge value="supabase_required" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FormField label="Search assignments">
              <TextInput value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Title, subject, or grade" />
            </FormField>
            <FormField label="Lifecycle">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value as 'all' | AssignmentStatus)}>
                <option value="all">All assignments</option>
                <option value="draft">Drafts</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </FormField>
          </div>
          {loading ? <LoadingState title="Loading assignments" description="Fetching current assignment records and submission counts..." /> : null}
          {error ? <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
          {data ? (
            <div className="mt-5">
            <DataTable<Assignment>
              rows={assignments}
              empty={data.assignments.length ? 'No assignments match these filters.' : 'No assignments are available yet.'}
              columns={[
                { key: 'title', label: 'Assignment', render: (row) => <AssignmentCell assignment={row} /> },
                { key: 'subject', label: 'Subject', render: (row) => row.subject || row.subject_id || 'Pending' },
                { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'draft'} /> },
                { key: 'action', label: 'Action', render: (row) => <ManageButton label={selectedAssignmentId === row.id ? 'Managing' : 'Manage'} onClick={() => setSelectedAssignmentId(row.id)} /> },
              ]}
            />
            </div>
          ) : null}
        </Card>
        {selectedAssignment ? <AssignmentLifecycleCard key={selectedAssignment.id} assignment={selectedAssignment} onSaved={reload} onClose={() => setSelectedAssignmentId(null)} /> : <WorkspaceHint title="No assignment selected" description="Choose an assignment from the library to edit its instructions, due date, attachment, or lifecycle." />}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_31rem]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Submission queue</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Triage learner work first, then mark and release from the focused review panel.</p>
            </div>
          </div>
          <div className="mt-5 max-w-xs">
            <FormField label="Review state">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={submissionStatus} onChange={(event) => setSubmissionStatus(event.target.value as 'all' | 'submitted' | 'marked' | 'returned')}>
                <option value="all">All submissions</option>
                <option value="submitted">Needs review</option>
                <option value="marked">Marked</option>
                <option value="returned">Returned for correction</option>
              </select>
            </FormField>
          </div>
          {data ? (
            <div className="mt-5">
              <DataTable<AssignmentSubmission & { assignment_title?: string; student_name?: string }>
                rows={submissions}
                empty={data.submissions.length ? 'No submissions match this review state.' : 'No submissions yet.'}
                columns={[
                  { key: 'learner', label: 'Learner', render: (row) => <span className="font-semibold text-slate-950">{row.student_name || row.student_id}</span> },
                  { key: 'assignment', label: 'Assignment', render: (row) => row.assignment_title || row.assignment_id },
                  { key: 'submitted', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge value={reviewStatusLabel(row.status)} /> },
                  { key: 'action', label: 'Action', render: (row) => <ManageButton label={selectedSubmissionId === row.id ? 'Reviewing' : 'Review'} onClick={() => setSelectedSubmissionId(row.id)} /> },
                ]}
              />
            </div>
          ) : null}
        </Card>
        {selectedSubmission ? <SubmissionReviewCard key={selectedSubmission.id} submission={selectedSubmission} onSaved={reload} /> : <WorkspaceHint title="No submission selected" description="Select learner work from the queue to mark it, return it for correction, or control what is released." />}
      </section>
    </DashboardShell>
  );
}

function assignmentMetrics(assignments: Assignment[], submissions: AssignmentSubmission[]): DashboardMetric[] {
  const published = assignments.filter((assignment) => assignment.status === 'published').length;
  const awaitingReview = submissions.filter((submission) => submission.status === 'submitted').length;
  const released = submissions.filter((submission) => submission.marks_released || submission.feedback_released).length;
  return [
    { label: 'Assignments', value: String(assignments.length), helper: 'All assignment records.', tone: 'teal' },
    { label: 'Published', value: String(published), helper: 'Currently visible to learners.', tone: 'violet' },
    { label: 'Needs review', value: String(awaitingReview), helper: 'Submitted work awaiting action.', tone: 'amber' },
    { label: 'Released', value: String(released), helper: 'Submissions with learner-visible feedback or marks.', tone: 'blue' },
  ];
}

function filterAssignments(assignments: Assignment[], status: 'all' | AssignmentStatus, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return [...assignments]
    .filter((assignment) => status === 'all' || assignment.status === status)
    .filter((assignment) => !query || [assignment.title, assignment.subject, assignment.grade].some((value) => (value || '').toLocaleLowerCase().includes(query)))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime() || left.title.localeCompare(right.title));
}

function filterSubmissions(
  submissions: Array<AssignmentSubmission & { assignment_title?: string; student_name?: string }>,
  status: 'all' | 'submitted' | 'marked' | 'returned',
  search: string,
) {
  const query = search.trim().toLocaleLowerCase();
  return [...submissions]
    .filter((submission) => status === 'all' || submission.status === status)
    .filter((submission) => !query || [submission.assignment_title, submission.student_name].some((value) => (value || '').toLocaleLowerCase().includes(query)))
    .sort((left, right) => new Date(right.submitted_at || 0).getTime() - new Date(left.submitted_at || 0).getTime());
}

function reviewStatusLabel(status: string) {
  if (status === 'submitted') return 'under_review';
  if (status === 'returned') return 'returned_for_correction';
  return status;
}

function AssignmentCell({ assignment }: { assignment: Assignment }) {
  return (
    <div>
      <p className="font-semibold text-slate-950">{assignment.title || assignment.id}</p>
      <p className="mt-1 text-xs text-slate-500">Created {formatDate(assignment.created_at)}</p>
    </div>
  );
}

export function AssignmentLifecycleCard({ assignment, onSaved, onClose }: { assignment: Assignment; onSaved: () => Promise<void>; onClose?: () => void }) {
  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [subjectName, setSubjectName] = useState('');
  const [grade, setGrade] = useState(assignment.grade || '');
  const [curriculum, setCurriculum] = useState('CAPS');
  const [dueDate, setDueDate] = useState(toDateInputValue(assignment.due_date));
  const [status, setStatus] = useState<AssignmentStatus>(normalizeAssignmentStatus(assignment.status));
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveAssignment(nextStatus = status) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateAssignment({ assignmentId: assignment.id, expectedRevision: assignment.revision, title, description, subjectName, grade, curriculum, dueDate, status: nextStatus, attachment });
      setAttachment(null);
      setStatus(nextStatus);
      setMessage('Assignment updated.');
      await onSaved();
    } catch (err) {
      captureAppError(err, {
        featureArea: 'admin',
        action: 'admin_assignment.update_failed',
        role: 'admin',
        metadata: {
          assignment_id: assignment.id,
          status: nextStatus,
          has_attachment_replacement: Boolean(attachment),
        },
      });
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
    <article className="rounded-2xl border border-brand-aegean/30 bg-brand-aegean/[0.04] p-4 shadow-sm dark:border-brand-gold/30 dark:bg-brand-gold/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{assignment.title || assignment.id}</h3>
          <p className="mt-1 text-sm text-slate-600">{[assignment.grade, `Due ${formatDate(assignment.due_date)}`].filter(Boolean).join(' | ')}</p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge value={status} />{onClose ? <button className="text-sm font-semibold text-brand-aegean underline dark:text-brand-gold" type="button" onClick={onClose}>Close editor</button> : null}</div>
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

function ManageButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-brand-aegean hover:text-brand-aegean dark:border-white/20 dark:text-slate-200 dark:hover:border-brand-gold dark:hover:text-brand-gold" type="button" onClick={onClick}>{label}</button>;
}

function WorkspaceHint({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <EmptyState title={title} description={description} />
    </Card>
  );
}

function SubmissionReviewCard({
  submission,
  onSaved,
}: {
  submission: AssignmentSubmission & { assignment_title?: string; student_name?: string };
  onSaved: () => Promise<void>;
}) {
  const aiPrefill = getAiGradingPrefill(submission);
  const [marksAwarded, setMarksAwarded] = useState(aiPrefill.marksAwarded);
  const [feedback, setFeedback] = useState(aiPrefill.feedback);
  const [rubricScoresJson, setRubricScoresJson] = useState(aiPrefill.rubricScoresJson);
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
      await markSubmission({ submissionId: submission.id, expectedRevision: submission.revision, marksAwarded, feedback, status, rubricScoresJson, marksReleased, feedbackReleased });
      setMessage('Submission updated.');
      await onSaved();
    } catch (err) {
      captureAppError(err, {
        featureArea: 'admin',
        action: 'admin_submission_review.save_failed',
        role: 'admin',
        metadata: {
          submission_id: submission.id,
          status,
          marks_released: marksReleased,
          feedback_released: feedbackReleased,
        },
      });
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
        {submission.file_url ? <div><dt className="font-semibold text-slate-800">File</dt><dd><a className="break-all text-xs font-semibold text-brand-aegean hover:text-brand-gold" href={submission.file_url} rel="noreferrer" target="_blank">Open submitted file</a></dd></div> : null}
        {submission.text_answer ? <div><dt className="font-semibold text-slate-800">Answer</dt><dd className="rounded-lg bg-slate-50 p-3">{submission.text_answer}</dd></div> : null}
      </dl>
      {aiPrefill.isAiDraft ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          AI-suggested draft{aiPrefill.aiConfidence != null ? ` (confidence ${aiPrefill.aiConfidence}%)` : ''} -- review before releasing.
        </p>
      ) : null}
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
        <FormField label="Rubric scores JSON" hint="Legacy storage fields can still be reviewed here.">
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

export function CreateAssignmentForm({ onCreated, role = 'admin', targetStudents = [] }: { onCreated: () => Promise<void>; role?: 'admin' | 'tutor'; targetStudents?: TutorAllocatedStudentSummary[] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [grade, setGrade] = useState('');
  const [curriculum, setCurriculum] = useState('CAPS');
  const [dueDate, setDueDate] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedGrade = normalizeGrade(grade);
  const eligibleStudents = targetStudents.filter((student) => normalizeGrade(student.grade || '') === selectedGrade);

  async function submit(event: FormEvent<HTMLFormElement> | null, publish = true) {
    event?.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (role === 'tutor' && !studentIds.length) throw new Error('Select at least one allocated learner for this assignment.');
      await createAssignment({ title, description, subjectName, grade, curriculum, dueDate, attachment, studentIds, publish });
      setTitle('');
      setDescription('');
      setSubjectName('');
      setGrade('');
      setCurriculum('CAPS');
      setDueDate('');
      setAttachment(null);
      setStudentIds([]);
      setMessage(publish ? 'Assignment published to eligible learners.' : 'Assignment saved as a staff-only draft. Publish it from Manage when ready.');
      await onCreated();
    } catch (err) {
      captureAppError(err, {
        featureArea: role === 'tutor' ? 'tutors' : 'admin',
        action: role === 'tutor' ? 'tutor_assignment.create_failed' : 'admin_assignment.create_failed',
        role,
        metadata: {
          has_attachment: Boolean(attachment),
          due_date_set: Boolean(dueDate),
        },
      });
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
          <p className="mt-1 text-sm text-slate-600">Prepare drafts or publish learner work with a subject, grade, due date, and optional supporting file.</p>
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
        <FormField label="Grade" hint={role === 'tutor' ? 'Choose the grade, then select exactly which learners should receive this work.' : undefined}>
          {role === 'tutor' ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Assignment grade">
              {['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((option) => {
                const selected = grade === option;
                return (
                  <button
                    aria-checked={selected}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'}`}
                    key={option}
                    role="radio"
                    type="button"
                    onClick={() => { setGrade(option); setStudentIds([]); }}
                  >
                    <span className={`mr-2 inline-block h-3 w-3 rounded-full border ${selected ? 'border-white bg-white' : 'border-slate-400 bg-transparent'}`} aria-hidden="true" />
                    {option}
                  </button>
                );
              })}
            </div>
          ) : <TextInput required value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Grade 11" />}
        </FormField>
        {role !== 'tutor' ? <FormField label="Curriculum">
          <TextInput value={curriculum} onChange={(event) => setCurriculum(event.target.value)} placeholder="CAPS" />
        </FormField> : null}
        <FormField label="Due date">
          <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </FormField>
        <FormField label="Attachment" hint="Optional worksheet or supporting file, visible to students.">
          <TextInput type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
        </FormField>
        {role === 'tutor' ? (
          <FormField label="Assign to specific learners" hint={selectedGrade ? `Only your allocated ${grade.trim()} learners can receive this work. Select one or more learners.` : 'Choose a grade first.'}>
            <select multiple required disabled={!selectedGrade} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" value={studentIds} onChange={(event) => setStudentIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
              {eligibleStudents.map((student) => <option key={student.student_id} value={student.student_id}>{student.full_name}{student.grade ? ` — ${student.grade}` : ''}</option>)}
            </select>
            {selectedGrade && !eligibleStudents.length ? <p className="mt-2 text-sm text-slate-600">You do not have any actively allocated {grade.trim()} learners.</p> : null}
          </FormField>
        ) : null}
        <div className="lg:col-span-2">
          <FormField label="Description">
            <TextArea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Instructions, expected work, submission notes..." />
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Working...' : 'Publish assignment'}
          </button>
          <button disabled={busy || !title.trim() || !subjectName.trim() || !grade.trim()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" type="button" onClick={() => void submit(null, false)}>
            Save draft
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>{error}</InlineFeedback> : null}
        </div>
      </form>
    </Card>
  );
}

function normalizeGrade(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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

