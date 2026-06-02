import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission, StudentDashboardView, StudentProgress } from '../../types/lms';
import {
  calculateAssignmentStatus,
  daysUntil,
  getAssignmentStatusLabel,
} from '../assignments/assignmentStatus';
import { selectCompletionRate, selectDueTasks, type NormalizedStudentData } from './studentData';
import { useSubmitStudentAssignmentMutation } from './studentQueries';

export function StudentWelcomeCard({
  data,
  nextAssignment,
  completionRate,
}: {
  data: StudentDashboardView;
  nextAssignment?: Assignment;
  completionRate: number;
}) {
  const dueDelta = daysUntil(nextAssignment?.due_date);

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,_#081326_0%,_#0f4db8_54%,_#1697df_100%)] p-6 text-white shadow-2xl shadow-blue-900/20 sm:p-8">
      <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur md:block">
        <div className="grid h-full place-items-center text-4xl font-black text-amber-200">O</div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-100">Learning voyage</p>
      <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome back, {data.profile.name || 'Student'}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50">
        You have completed {completionRate}% of visible assignments. Keep the next due item in view and submit with confidence.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <HeroMetric label="Grade" value={data.profile.grade || 'Pending'} />
        <HeroMetric label="School" value={data.profile.school || 'Pending'} />
        <HeroMetric
          label="Next due"
          value={nextAssignment ? dueDelta === null ? 'Date pending' : dueDelta === 0 ? 'Today' : dueDelta > 0 ? `${dueDelta} days` : 'Overdue' : 'Clear'}
        />
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function ProgressSummaryCards({
  studentData,
  submissions,
  progress,
}: {
  studentData: NormalizedStudentData;
  submissions: AssignmentSubmission[];
  progress: StudentProgress[];
}) {
  const marked = submissions.filter((submission) => submission.status === 'marked' || submission.marks_awarded != null).length;
  const averageScore = progress.length
    ? Math.round(progress.reduce((total, item) => total + Number(item.score || 0), 0) / progress.length)
    : null;
  const completionRate = selectCompletionRate(studentData);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Completion rate" value={`${completionRate}%`} helper={`${studentData.submittedAssignmentIds.size} of ${studentData.assignmentsById.size} assignments submitted.`} tone="blue" />
      <SummaryCard label="Outstanding" value={String(studentData.dueTasks.size)} helper="Assignments still requiring learner action." tone="amber" />
      <SummaryCard label="Marked" value={String(marked)} helper="Submissions with marks or released feedback." tone="teal" />
      <SummaryCard label="Average score" value={averageScore == null ? '--' : `${averageScore}%`} helper="Average from available progress records." tone="slate" />
    </section>
  );
}

function SummaryCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: 'blue' | 'amber' | 'teal' | 'slate' }) {
  const toneClass = {
    blue: 'bg-blue-50 border-blue-100',
    amber: 'bg-amber-50 border-amber-100',
    teal: 'bg-teal-50 border-teal-100',
    slate: 'bg-white border-slate-100',
  }[tone];

  return (
    <article className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </article>
  );
}

export function AssignmentsDueSection({
  studentData,
  limit,
}: {
  studentData: NormalizedStudentData;
  limit?: number;
}) {
  const visible = useMemo(() => selectDueTasks(studentData, limit), [studentData, limit]);

  return (
    <div className="space-y-4">
      {visible.map((task) => (
        <AssignmentDueCard
          key={task.assignmentId}
          assignment={task.assignment}
          submission={task.submission}
        />
      ))}
      {!visible.length ? (
        <EmptyState
          title="No assignments due right now"
          description="Published assignments will appear here automatically once tutors or admins create them."
        />
      ) : null}
    </div>
  );
}

export function AssignmentDueCard({
  assignment,
  submission,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);
  const isClosed = assignment.status === 'closed' || assignment.status === 'archived';

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">{assignment.subject || assignment.subject_id || 'Subject pending'}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{assignment.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {[assignment.grade, dueText(assignment.due_date, dueDelta)].filter(Boolean).join(' | ')}
          </p>
        </div>
        <StatusBadge value={status} />
      </div>
      {assignment.description ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{assignment.description}</p>
      ) : null}
      {submission ? <SubmissionPreview submission={submission} /> : null}
      <AssignmentUploadPanel assignment={assignment} submission={submission} disabled={isClosed} />
    </article>
  );
}

function dueText(value?: string | null, delta?: number | null) {
  if (!value) {
    return 'Due date pending';
  }
  if (delta === 0) {
    return `Due today (${formatDate(value)})`;
  }
  if (typeof delta === 'number' && delta < 0) {
    return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  }
  if (typeof delta === 'number') {
    return `Due ${formatDate(value)} (${delta} day${delta === 1 ? '' : 's'} left)`;
  }
  return `Due ${formatDate(value)}`;
}

function SubmissionPreview({ submission }: { submission: AssignmentSubmission }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><span className="font-semibold text-slate-950">Submitted:</span> {formatDate(submission.submitted_at)}</p>
        <StatusBadge value={calculateAssignmentStatus({ assignment: { status: 'published', due_date: null }, submission })} />
      </div>
      {submission.file_url ? <p className="mt-2 break-all"><span className="font-semibold text-slate-950">File:</span> <span className="font-mono text-xs">{submission.file_url}</span></p> : null}
      {submission.marks_awarded != null ? <p className="mt-2"><span className="font-semibold text-slate-950">Mark:</span> {submission.marks_awarded}%</p> : null}
      {submission.feedback ? <p className="mt-3 rounded-xl bg-white p-3"><span className="font-semibold text-slate-950">Feedback:</span> {submission.feedback}</p> : null}
    </div>
  );
}

export function AssignmentUploadPanel({
  assignment,
  submission,
  disabled,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  disabled?: boolean;
}) {
  const [textAnswer, setTextAnswer] = useState(submission?.text_answer || '');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resubmissionConfirmed, setResubmissionConfirmed] = useState(false);
  const submitAssignmentMutation = useSubmitStudentAssignmentMutation();
  const busy = submitAssignmentMutation.isPending;
  const needsConfirmation = Boolean(submission);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const validation = validateSubmissionInput({ file, textAnswer, hasSubmission: Boolean(submission), resubmissionConfirmed });
    if (validation) {
      setError(validation);
      return;
    }

    try {
      await submitAssignmentMutation.mutateAsync({ assignmentId: assignment.id, textAnswer, file });
      setFile(null);
      setResubmissionConfirmed(false);
      setMessage(submission ? 'Resubmission saved.' : 'Submission saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit assignment.');
    }
  }

  return (
    <form className="mt-5 grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4" onSubmit={(event) => void submit(event)}>
      {disabled ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This assignment is closed and no longer accepts submissions.</p>
      ) : null}
      <FormField label="Submission note" hint="Optional note, link, or short written answer for your tutor.">
        <TextArea
          disabled={disabled || busy}
          value={textAnswer}
          onChange={(event) => setTextAnswer(event.target.value)}
          placeholder="Type a note or answer..."
        />
      </FormField>
      <FormField label="Upload file" hint="PDF, JPG, or PNG up to 10 MB.">
        <TextInput
          disabled={disabled || busy}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </FormField>
      {needsConfirmation ? (
        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <input
            className="mt-1"
            checked={resubmissionConfirmed}
            disabled={disabled || busy}
            type="checkbox"
            onChange={(event) => setResubmissionConfirmed(event.target.checked)}
          />
          <span>I understand this will update my existing submission.</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={disabled || busy}
          className="rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
        >
          {busy ? 'Uploading...' : submission ? 'Update submission' : 'Upload submission'}
        </button>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}

function validateSubmissionInput({
  file,
  textAnswer,
  hasSubmission,
  resubmissionConfirmed,
}: {
  file: File | null;
  textAnswer: string;
  hasSubmission: boolean;
  resubmissionConfirmed: boolean;
}) {
  if (!file && !textAnswer.trim()) {
    return 'Add a file or written answer before submitting.';
  }
  if (hasSubmission && !resubmissionConfirmed) {
    return 'Confirm that you want to update the existing submission.';
  }
  if (!file) {
    return '';
  }
  const maxBytes = 10 * 1024 * 1024;
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > maxBytes) {
    return 'File must be 10 MB or smaller.';
  }
  if ((file.type && !allowedMime.includes(file.type)) || !allowedExt.includes(ext)) {
    return 'Upload PDF, JPG, or PNG files only.';
  }
  return '';
}

export function SubmittedAssignmentsList({
  assignmentsById,
  submissions,
}: {
  assignmentsById: Map<string, Assignment>;
  submissions: AssignmentSubmission[];
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Submitted assignments</h2>
          <p className="mt-1 text-sm text-slate-600">Status, timestamps, marks, and feedback for work already sent in.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {submissions.slice(0, 6).map((submission) => {
          const assignment = assignmentsById.get(submission.assignment_id);
          const status = calculateAssignmentStatus({ assignment: assignment || { status: 'published', due_date: null, id: '', title: '', created_at: '' }, submission });
          return (
            <div key={submission.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{assignment?.title || submission.assignment_id}</p>
                  <p className="mt-1 text-sm text-slate-600">Submitted {formatDate(submission.submitted_at)}</p>
                </div>
                <StatusBadge value={status} />
              </div>
              {submission.marks_awarded != null ? <p className="mt-3 text-sm font-semibold text-teal-700">Mark: {submission.marks_awarded}%</p> : null}
              {submission.feedback ? <p className="mt-2 text-sm leading-6 text-slate-600">{submission.feedback}</p> : null}
            </div>
          );
        })}
        {!submissions.length ? <EmptyState title="No submissions yet" description="Once you upload work, the confirmation and review status will appear here." /> : null}
      </div>
    </Card>
  );
}

export function LatestResultsCard({
  assignmentsById,
  submissions,
}: {
  assignmentsById: Map<string, Assignment>;
  submissions: AssignmentSubmission[];
}) {
  const marked = submissions.filter((submission) => submission.status === 'marked' || submission.marks_awarded != null);

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Latest results</h2>
      <p className="mt-1 text-sm text-slate-600">Marks and feedback released by tutors or admins.</p>
      <div className="mt-5 space-y-3">
        {marked.slice(0, 3).map((submission) => (
          <div key={submission.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{assignmentsById.get(submission.assignment_id)?.title || submission.assignment_id}</p>
                <p className="mt-1 text-sm text-slate-600">{submission.feedback || 'No written feedback supplied.'}</p>
              </div>
              <p className="text-lg font-semibold text-teal-700">{submission.marks_awarded == null ? '--' : `${submission.marks_awarded}%`}</p>
            </div>
          </div>
        ))}
        {!marked.length ? <EmptyState title="No marked assignments yet" description="Results will appear here once feedback is released." /> : null}
      </div>
    </Card>
  );
}
