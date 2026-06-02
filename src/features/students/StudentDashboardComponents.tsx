import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { GreekHeroCard, InsightCard, MetricCard, PremiumButton, StaggerGrid, StaggerItem, TimelineCard } from '../../components/dashboard/DashboardDesignSystem';
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
import type { DailyInsight } from './studentDailyInsight';
import { useSubmitStudentAssignmentMutation } from './studentQueries';

export function StudentWelcomeCard({
  data,
  nextAssignment,
  completionRate,
  dailyInsight,
}: {
  data: StudentDashboardView;
  nextAssignment?: Assignment;
  completionRate: number;
  dailyInsight: DailyInsight;
}) {
  const dueDelta = daysUntil(nextAssignment?.due_date);
  const nextExam = data.examCalendar?.nextExam;
  const nextExamDelta = daysUntil(nextExam?.examDate);
  const academicStatus = data.dailyInsightContext?.currentAcademicStatus || data.supportStatus?.label || 'Awaiting results';

  return (
    <GreekHeroCard
      eyebrow="Learning voyage"
      title={`Welcome back, ${data.profile.name || 'Student'}`}
      description={dailyInsight.message}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <HeroMetric label="Learner" value={data.profile.name || 'Student'} helper="Your personal dashboard" />
          <HeroMetric label="Grade" value={data.profile.grade || 'Pending'} helper="Current academic level" />
          <HeroMetric label="School" value={data.profile.school || 'Pending'} helper="Learning context" />
          <HeroMetric label="Next task" value={nextAssignment?.title || 'Clear'} helper={formatTaskDue(nextAssignment?.due_date, dueDelta)} />
          <HeroMetric label="Next exam" value={nextExam?.subject || 'Not scheduled'} helper={formatExamDue(nextExam?.title, nextExam?.examDate, nextExamDelta)} />
          <HeroMetric label="Academic status" value={academicStatus} helper={data.supportStatus?.recommendedAction || "Use today's plan to keep moving."} />
        </div>

        <div className={`relative overflow-hidden rounded-3xl border p-5 text-sm leading-6 shadow-lg shadow-brand-navy/20 ${dailyInsightToneClasses[dailyInsight.tone]}`}>
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-gold/20 blur-xl" aria-hidden="true" />
          {/* Oracle Insight keeps the recommendation distinct from the raw status tiles. */}
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">Oracle Insight</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{dailyInsight.eyebrow}</h3>
            <p className="mt-2 text-brand-parchment">{dailyInsight.action}</p>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3 text-xs text-brand-parchment">
              <p>Completion: {completionRate}%</p>
              <p className="mt-1">Today's seed: {dailyInsight.seed}</p>
            </div>
          </div>
        </div>
      </div>
    </GreekHeroCard>
  );
}

const dailyInsightToneClasses: Record<DailyInsight['tone'], string> = {
  steady: 'border-white/20 bg-white/10 text-brand-parchment',
  momentum: 'border-brand-aegean/60 bg-brand-aegean/20 text-brand-parchment',
  focus: 'border-brand-gold/60 bg-brand-gold/15 text-brand-parchment',
  revision: 'border-brand-gold/70 bg-brand-gold/20 text-brand-parchment',
  urgent: 'border-red-300/70 bg-red-950/30 text-red-50',
};

function HeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-parchment">{helper}</p>
    </div>
  );
}

function formatTaskDue(value?: string | null, delta?: number | null) {
  if (!value) return 'No due date on the next task.';
  if (delta === 0) return `Due today, ${formatDate(value)}.`;
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue.`;
  if (typeof delta === 'number') return `Due in ${delta} day${delta === 1 ? '' : 's'} on ${formatDate(value)}.`;
  return `Due ${formatDate(value)}.`;
}

function formatExamDue(title?: string | null, value?: string | null, delta?: number | null) {
  if (!value) return 'No exam date has been added yet.';
  const prefix = title ? `${title}: ` : '';
  if (delta === 0) return `${prefix}exam today.`;
  if (typeof delta === 'number' && delta > 0) return `${prefix}${delta} day${delta === 1 ? '' : 's'} to prepare.`;
  if (typeof delta === 'number' && delta < 0) return `${prefix}exam date has passed.`;
  return `${prefix}${formatDate(value)}.`;
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
    <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Completion rate" value={`${completionRate}%`} helper={`${studentData.submittedAssignmentIds.size} of ${studentData.assignmentsById.size} assignments submitted.`} tone="blue" />
      <SummaryCard label="Outstanding" value={String(studentData.dueTasks.size)} helper="Assignments still requiring learner action." tone="amber" />
      <SummaryCard label="Marked" value={String(marked)} helper="Submissions with marks or released feedback." tone="teal" />
      <SummaryCard label="Average score" value={averageScore == null ? '--' : `${averageScore}%`} helper="Average from available progress records." tone="slate" />
    </StaggerGrid>
  );
}

function SummaryCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: 'blue' | 'amber' | 'teal' | 'slate' }) {
  const metricTone = ({
    blue: 'navy',
    amber: 'gold',
    teal: 'aegean',
    slate: 'marble',
  } as const)[tone];

  return <StaggerItem><MetricCard label={label} value={value} helper={helper} tone={metricTone} /></StaggerItem>;
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
    <StaggerGrid className="space-y-4">
      {visible.map((task) => (
        <StaggerItem key={task.assignmentId}>
          <AssignmentDueCard
            assignment={task.assignment}
            submission={task.submission}
          />
        </StaggerItem>
      ))}
      {!visible.length ? (
        <EmptyState
          title="No assignments due right now"
          description="Published assignments will appear here automatically once tutors or admins create them."
        />
      ) : null}
    </StaggerGrid>
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
    <InsightCard
      title={assignment.title}
      description={[assignment.grade, dueText(assignment.due_date, dueDelta)].filter(Boolean).join(' | ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">{assignment.subject || assignment.subject_id || 'Subject pending'}</p>
        <StatusBadge value={status} />
      </div>
      {assignment.description ? (
        <p className="mt-4 rounded-2xl bg-brand-parchment/70 p-4 text-sm leading-6 text-slate-700 dark:bg-brand-navy/70 dark:text-brand-marble">{assignment.description}</p>
      ) : null}
      {submission ? <SubmissionPreview submission={submission} /> : null}
      <AssignmentUploadPanel assignment={assignment} submission={submission} disabled={isClosed} />
    </InsightCard>
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
    <TimelineCard title={`Submitted ${formatDate(submission.submitted_at)}`} meta={submission.feedback || 'Waiting for tutor feedback.'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge value={calculateAssignmentStatus({ assignment: { status: 'published', due_date: null }, submission })} />
      </div>
      {submission.file_url ? <p className="mt-2 break-all text-sm text-slate-600 dark:text-brand-marble"><span className="font-semibold">File:</span> <span className="font-mono text-xs">{submission.file_url}</span></p> : null}
      {submission.marks_awarded != null ? <p className="mt-2 text-sm font-semibold text-brand-aegean dark:text-brand-gold">Mark: {submission.marks_awarded}%</p> : null}
    </TimelineCard>
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
        <PremiumButton
          disabled={disabled || busy}
          type="submit"
        >
          {busy ? 'Uploading...' : submission ? 'Update submission' : 'Upload submission'}
        </PremiumButton>
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
      <StaggerGrid className="mt-5 space-y-3">
        {submissions.slice(0, 6).map((submission) => {
          const assignment = assignmentsById.get(submission.assignment_id);
          const status = calculateAssignmentStatus({ assignment: assignment || { status: 'published', due_date: null, id: '', title: '', created_at: '' }, submission });
          return (
            <StaggerItem key={submission.id}>
              <TimelineCard title={assignment?.title || submission.assignment_id} meta={`Submitted ${formatDate(submission.submitted_at)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StatusBadge value={status} />
                </div>
                {submission.marks_awarded != null ? <p className="mt-3 text-sm font-semibold text-teal-700">Mark: {submission.marks_awarded}%</p> : null}
                {submission.feedback ? <p className="mt-2 text-sm leading-6 text-slate-600">{submission.feedback}</p> : null}
              </TimelineCard>
            </StaggerItem>
          );
        })}
        {!submissions.length ? <EmptyState title="No submissions yet" description="Once you upload work, the confirmation and review status will appear here." /> : null}
      </StaggerGrid>
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
      <StaggerGrid className="mt-5 space-y-3">
        {marked.slice(0, 3).map((submission) => (
          <StaggerItem key={submission.id}>
            <TimelineCard title={assignmentsById.get(submission.assignment_id)?.title || submission.assignment_id} meta={submission.feedback || 'No written feedback supplied.'}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-semibold text-teal-700">{submission.marks_awarded == null ? '--' : `${submission.marks_awarded}%`}</p>
              </div>
            </TimelineCard>
          </StaggerItem>
        ))}
        {!marked.length ? <EmptyState title="No marked assignments yet" description="Results will appear here once feedback is released." /> : null}
      </StaggerGrid>
    </Card>
  );
}
