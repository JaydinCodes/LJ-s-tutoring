import { Link, useParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard, TimelineCard } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import {
  calculateAssignmentStatus,
  daysUntil,
  getAssignmentStatusLabel,
} from '../assignments/assignmentStatus';
import { AssignmentUploadPanel } from './StudentDashboardComponents';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentAssignmentDetailRoute() {
  const { assignmentId } = useParams();
  const { data, loading, error, reload } = useStudentDashboardQuery();
  const studentData = data ? normalizeStudentData(data) : null;
  const assignment = assignmentId ? studentData?.assignmentsById.get(assignmentId) : null;
  const submission = assignmentId ? studentData?.submissionsByAssignmentId.get(assignmentId) : undefined;

  return (
    <PageShell
      title="Assignment Detail"
      subtitle="Read the instructions, check feedback, and submit work from one focused page."
      section="student"
    >
      <div className="mb-4">
        <Link className="text-sm font-semibold text-brand-aegean hover:text-brand-gold dark:text-brand-gold" to="/dashboard/student/assignments">
          Back to assignment list
        </Link>
      </div>

      {loading ? <Card><SkeletonCard /></Card> : null}
      {error ? <Card><ErrorState title="Assignment unavailable" description={error} onRetry={() => void reload()} /></Card> : null}
      {data && !assignment ? (
        <Card>
          <EmptyState title="Assignment not found" description="This assignment may have been removed, archived, or assigned to a different learner." />
        </Card>
      ) : null}
      {assignment ? <AssignmentDetailWorkspace assignment={assignment} submission={submission} /> : null}
    </PageShell>
  );
}

function AssignmentDetailWorkspace({
  assignment,
  submission,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);
  const uploadDisabled = status === 'archived' || status === 'closed' || assignment.status === 'archived' || assignment.status === 'closed';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">Assignment workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{assignment.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">{assignment.subject || assignment.subject_id || 'Topic pending'}</p>
          </div>
          <StatusBadge value={status} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <DetailMetric label="Due date" value={formatDueDate(assignment.due_date, dueDelta)} />
          <DetailMetric label="Topic" value={assignment.subject || assignment.subject_id || 'Pending'} />
          <DetailMetric label="Status" value={getAssignmentStatusLabel(status)} />
        </div>

        <section className="mt-6 rounded-[1.5rem] border border-brand-marble bg-brand-parchment/60 p-5 dark:border-brand-marble/20 dark:bg-brand-navy/50">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Instructions</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-brand-marble">
            {assignment.description || 'Your tutor has not added written instructions yet. Use the file rules and due date, then ask for clarification before submitting if needed.'}
          </p>
          {assignment.attachment_url ? (
            <a className="mt-4 inline-flex rounded-full border border-brand-aegean/50 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-white dark:text-brand-parchment dark:hover:bg-brand-obsidian" href={assignment.attachment_url} rel="noreferrer" target="_blank">
              Open attached brief
            </a>
          ) : null}
        </section>
      </Card>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Submission Rules</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">
            <li>Accepted files: PDF, JPG, or PNG.</li>
            <li>Maximum file size: 10 MB.</li>
            <li>Add a note when the file needs context or when submitting a correction.</li>
          </ul>
          {uploadDisabled ? (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This assignment is closed or archived, so uploads are disabled.</p>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Upload Work</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Submit from the detail page so the assignment list stays easy to scan.</p>
          {/* Upload controls live here rather than inside list cards to keep the tab view lightweight. */}
          <AssignmentUploadPanel assignment={assignment} submission={submission} disabled={uploadDisabled} />
        </Card>
      </aside>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Feedback</h2>
        {submission?.feedback ? (
          <p className="mt-3 rounded-2xl bg-brand-parchment/70 p-4 text-sm leading-7 text-slate-700 dark:bg-brand-navy/70 dark:text-brand-marble">{submission.feedback}</p>
        ) : (
          <EmptyState title="No feedback yet" description="Feedback and marks will appear here after your tutor reviews the submission." />
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Submission History</h2>
        {submission ? <SubmissionHistory submission={submission} assignment={assignment} /> : (
          <EmptyState title="No submission history" description="Your first upload will create the submission record for this assignment." />
        )}
      </Card>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-marble bg-white/80 p-4 dark:border-brand-marble/20 dark:bg-brand-obsidian">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SubmissionHistory({
  submission,
  assignment,
}: {
  submission: AssignmentSubmission;
  assignment: Assignment;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });

  return (
    <TimelineCard title={`Submitted ${formatDate(submission.submitted_at)}`} meta={submission.file_url || submission.text_answer || 'Submission saved.'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge value={status} />
        {submission.marks_awarded != null ? <p className="text-sm font-semibold text-teal-700">Mark: {submission.marks_awarded}%</p> : null}
      </div>
      {submission.text_answer ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-brand-marble">{submission.text_answer}</p> : null}
      {submission.file_url ? (
        <a className="mt-3 inline-flex break-all text-sm font-semibold text-brand-aegean hover:text-brand-gold" href={submission.file_url} rel="noreferrer" target="_blank">
          Open submitted file
        </a>
      ) : null}
    </TimelineCard>
  );
}

function formatDueDate(value?: string | null, delta?: number | null) {
  if (!value) return 'Due date pending';
  if (delta === 0) return `Today, ${formatDate(value)}`;
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  if (typeof delta === 'number') return `${formatDate(value)} (${delta} day${delta === 1 ? '' : 's'} left)`;
  return formatDate(value);
}
