import { Link, useParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import {
  calculateAssignmentStatus,
  daysUntil,
  getAssignmentStatusLabel,
} from '../assignments/assignmentStatus';
import { parseLearningAction } from '../assignments/learningEvidence';
import { AssignmentUploadPanel } from './StudentDashboardComponents';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentAssignmentDetailRoute() {
  const { assignmentId } = useParams();
  const { data, loading, error, reload } = useStudentDashboardQuery();
  const studentData = data ? normalizeStudentData(data) : null;
  const assignment = assignmentId ? studentData?.assignmentsById.get(assignmentId) : null;
  const submission = assignmentId ? studentData?.submissionsByAssignmentId.get(assignmentId) : undefined;
  const submissionHistory = assignmentId
    ? [...(data?.submissions || [])]
      .filter((item) => item.assignment_id === assignmentId)
      .sort(compareSubmissionVersions)
    : [];

  return (
    <PageShell
      title="Assignment Details"
      subtitle="Instructions, submission status and tutor feedback."
      section="student"
    >
      <Link className="mb-5 inline-flex min-h-10 items-center text-sm font-semibold text-academy-aegean underline underline-offset-2 hover:text-academy-navy dark:text-sky-300" to="/dashboard/student/assignments">
        Back to assignment list
      </Link>
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Assignment unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data && !assignment ? (
        <div className="border-t border-[#d9d2c5] py-8 dark:border-white/20">
          <h2 className="text-lg font-semibold text-academy-navy dark:text-white">Assignment not found</h2>
          <p className="mt-2 text-sm text-academy-muted">This assignment may have been removed or may not be assigned to you.</p>
        </div>
      ) : null}
      {assignment ? <AssignmentDetailWorkspace assignment={assignment} submission={submission} submissionHistory={submissionHistory} /> : null}
    </PageShell>
  );
}

function AssignmentDetailWorkspace({
  assignment,
  submission,
  submissionHistory,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  submissionHistory: AssignmentSubmission[];
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);
  const uploadDisabled = status === 'archived' || status === 'closed' || assignment.status === 'archived' || assignment.status === 'closed';
  const canShowMark = Boolean(submission?.marks_released) && submission?.marks_awarded != null;
  const canShowFeedback = Boolean(submission?.feedback_released) && Boolean(submission?.feedback);
  const learningAction = canShowFeedback ? parseLearningAction(submission?.rubric_scores_json) : null;
  const isReturned = status === 'marked';
  const stage = isReturned ? 4 : submission ? 3 : 1;
  const stages = ['Assigned', 'In progress', 'Submitted', 'Returned'];

  return (
    <article className="min-w-0 text-sm text-academy-ink dark:text-slate-100">
      <div className="border-b border-[#d9d2c5] pb-4 dark:border-white/20">
        <h2 className="text-2xl font-semibold text-academy-navy dark:text-white">
          {assignment.title} <span className="text-base font-medium text-academy-muted">— {getAssignmentStatusLabel(status)}</span>
        </h2>
        <p className="mt-1 text-academy-muted">{assignment.subject || 'Subject not listed'}</p>
      </div>

      <ol aria-label="Assignment progress" className="mt-3 grid grid-cols-4 gap-1 text-center text-[0.7rem] sm:text-xs">
        {stages.map((label, index) => (
          <li
            key={label}
            aria-current={index + 1 === stage ? 'step' : undefined}
            className={`border-b-[5px] pb-2 ${index + 1 <= stage ? 'border-academy-aegean text-academy-navy dark:text-sky-300' : 'border-[#ded8cb] text-academy-muted dark:border-white/20'}`}
          >{label}</li>
        ))}
      </ol>

      <dl className="mt-5 grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] gap-x-3 gap-y-2 leading-6">
        <dt className="font-semibold">Title</dt><dd>{assignment.title}</dd>
        <dt className="font-semibold">Subject</dt><dd>{assignment.subject || 'Subject not listed'}</dd>
        <dt className="font-semibold">Created</dt><dd>{formatDate(assignment.created_at)}</dd>
        <dt className="font-semibold">Due date</dt><dd>{formatDueDate(assignment.due_date, dueDelta)}</dd>
        <dt className="font-semibold">Status</dt><dd>{getAssignmentStatusLabel(status)}</dd>
        <dt className="font-semibold">Submitted Date</dt><dd>{submission?.submitted_at ? formatDate(submission.submitted_at) : 'Not submitted'}</dd>
        <dt className="font-semibold">Grade</dt><dd className="font-semibold">{canShowMark ? `${submission?.marks_awarded}%` : 'Not released'}</dd>
      </dl>

      <section aria-labelledby="instructions-heading" className="mt-7">
        <h3 id="instructions-heading" className="border-b border-[#d9d2c5] pb-2 text-base font-semibold text-academy-navy dark:border-white/20 dark:text-white">Instructions</h3>
        <p className="mt-3 whitespace-pre-wrap leading-7">
          {assignment.description || 'No additional instructions were provided.'}
        </p>
      </section>

      <section aria-labelledby="resources-heading" className="mt-7">
        <h3 id="resources-heading" className="border-b border-[#d9d2c5] pb-2 text-base font-semibold text-academy-navy dark:border-white/20 dark:text-white">Additional resources for assignment</h3>
        <div className="mt-3">
          {assignment.attachment_url ? (
            <a className="font-semibold text-academy-aegean underline hover:text-academy-navy dark:text-sky-300" href={assignment.attachment_url} target="_blank" rel="noreferrer">
              Open attached worksheet or instructions
            </a>
          ) : <p className="text-academy-muted">No additional resources attached.</p>}
        </div>
      </section>

      <section aria-labelledby="submitted-heading" className="mt-7">
        <h3 id="submitted-heading" className="border-b border-[#d9d2c5] pb-2 text-base font-semibold text-academy-navy dark:border-white/20 dark:text-white">Submitted Attachments</h3>
        {submission ? (
          <div className="mt-3 space-y-2">
            <p className="font-medium">Submission received {submission.submitted_at ? formatDate(submission.submitted_at) : ''}</p>
            {submission.file_url ? <a className="inline-block break-all font-semibold text-academy-aegean underline dark:text-sky-300" href={submission.file_url} target="_blank" rel="noreferrer">{submission.original_filename || 'Open submitted file'}</a> : null}
            {submission.text_answer ? <p className="whitespace-pre-wrap leading-6">{submission.text_answer}</p> : null}
          </div>
        ) : <p className="mt-3 text-academy-muted">No submission uploaded yet.</p>}
      </section>

      <section aria-labelledby="feedback-heading" className="mt-7">
        <h3 id="feedback-heading" className="border-b border-[#d9d2c5] pb-2 text-base font-semibold text-academy-navy dark:border-white/20 dark:text-white">Tutor's comments about your submission</h3>
        {canShowFeedback ? <p className="mt-3 whitespace-pre-wrap leading-7">{submission?.feedback}</p> :
          <p className="mt-3 text-academy-muted">No feedback released yet.</p>}
        {learningAction ? (
          <div className="mt-4 border-l-2 border-academy-aegean pl-4">
            <h4 className="font-semibold">Recommended next learning action</h4>
            {learningAction.strengths ? <p className="mt-2"><strong>What went well:</strong> {learningAction.strengths}</p> : null}
            {learningAction.fixNext ? <p className="mt-2"><strong>Improve next:</strong> {learningAction.fixNext}</p> : null}
            {learningAction.actionDetail ? <p className="mt-2">{learningAction.actionDetail}</p> : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="history-heading" className="mt-7">
        <h3 id="history-heading" className="border-b border-[#d9d2c5] pb-2 text-base font-semibold text-academy-navy dark:border-white/20 dark:text-white">Submission History</h3>
        {submissionHistory.length ? <SubmissionHistory submissions={submissionHistory} assignment={assignment} /> :
          <p className="mt-3 text-academy-muted">Your submission history will appear here after you submit work.</p>}
      </section>

      <section aria-labelledby="upload-heading" className="mt-7 border-t border-[#d9d2c5] pt-5 dark:border-white/20">
        <h3 id="upload-heading" className="text-base font-semibold text-academy-navy dark:text-white">Upload Work</h3>
        <p className="mt-1 text-academy-muted">Accepted files: PDF, JPG, PNG, or a written response. Maximum file size: 5 MiB.</p>
        {uploadDisabled ? <p className="mt-3 font-medium text-amber-800 dark:text-amber-300">This assignment is closed or archived, so uploads are disabled.</p> : null}
        <AssignmentUploadPanel assignment={assignment} submission={submission} disabled={uploadDisabled} />
      </section>
    </article>
  );
}

function SubmissionHistory({ submissions, assignment }: { submissions: AssignmentSubmission[]; assignment: Assignment }) {
  return (
    <ul className="mt-3 divide-y divide-[#e3ddd2] dark:divide-white/15">
      {submissions.map((item) => {
        const status = calculateAssignmentStatus({ assignment, submission: item });
        return (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div>
              <p className="font-medium">Version {item.version_number || 1} · {item.submitted_at ? formatDate(item.submitted_at) : 'Date unavailable'}{item.is_latest ? ' · Latest version' : ''}</p>
              <p className="mt-1 text-academy-muted">{item.original_filename || (item.text_answer ? 'Written response' : 'Submission')}</p>
              {item.file_url ? <a className="mt-1 inline-block font-medium text-academy-aegean underline dark:text-sky-300" href={item.file_url} target="_blank" rel="noreferrer">Open submitted file</a> : null}
            </div>
            <div className="text-right">
              <p>{getAssignmentStatusLabel(status)}</p>
              {item.marks_released && item.marks_awarded != null ? <p className="mt-1 font-semibold">{item.marks_awarded}%</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function compareSubmissionVersions(left: AssignmentSubmission, right: AssignmentSubmission) {
  if (left.is_latest && !right.is_latest) return -1;
  if (!left.is_latest && right.is_latest) return 1;
  const versionDelta = Number(right.version_number || 0) - Number(left.version_number || 0);
  if (versionDelta !== 0) return versionDelta;
  return new Date(right.submitted_at || 0).getTime() - new Date(left.submitted_at || 0).getTime();
}

function formatDueDate(value?: string | null, delta?: number | null) {
  if (!value) return 'Due date pending';
  if (delta === 0) return `Today, ${formatDate(value)}`;
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  if (typeof delta === 'number') return `${formatDate(value)} (${delta} day${delta === 1 ? '' : 's'} left)`;
  return formatDate(value);
}
