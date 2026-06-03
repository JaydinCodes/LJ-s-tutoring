import { useMemo, useState } from 'react';
import { Archive, CheckCircle2, ChevronRight, Clock, FileText, PanelRightClose, Trophy, UploadCloud, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import { calculateAssignmentStatus, daysUntil, getAssignmentStatusLabel } from '../assignments/assignmentStatus';
import { normalizeStudentData, type AssignmentStatusBucket, type NormalizedStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

const assignmentTabs: Array<{
  key: AssignmentStatusBucket;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction: string;
  icon: LucideIcon;
}> = [
  {
    key: 'due-now',
    label: 'Due Now',
    description: 'Work that still needs action, including overdue tasks and returned corrections.',
    emptyTitle: 'No assignments need action',
    emptyDescription: 'Your active assignment lane is clear. Use this time for revision or check progress for the next weak topic.',
    emptyAction: 'Open progress',
    icon: Clock,
  },
  {
    key: 'submitted',
    label: 'Submitted',
    description: 'Work sent in and waiting for review, feedback, or final marks.',
    emptyTitle: 'No submitted work waiting',
    emptyDescription: 'When you upload work, it will move here with its review status so you know it was received.',
    emptyAction: 'Go to due work',
    icon: UploadCloud,
  },
  {
    key: 'marked',
    label: 'Marked',
    description: 'Released feedback, marks, and completed assignment outcomes.',
    emptyTitle: 'No marked assignments yet',
    emptyDescription: 'Released feedback and marks will collect here so you can see what improved and what to fix next.',
    emptyAction: 'Open results',
    icon: Trophy,
  },
  {
    key: 'archived',
    label: 'Archived',
    description: 'Closed, draft, or archived assignments kept out of your active workflow.',
    emptyTitle: 'No archived assignments',
    emptyDescription: 'Older or closed assignments will collect here without cluttering your active work lane.',
    emptyAction: 'Back to due work',
    icon: Archive,
  },
];

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [activeBucket, setActiveBucket] = useState<AssignmentStatusBucket>('due-now');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const activeTab = assignmentTabs.find((tab) => tab.key === activeBucket) || assignmentTabs[0];
  const activeAssignments = studentData?.assignmentBuckets.get(activeBucket) || [];
  const selectedAssignment = selectedAssignmentId
    ? activeAssignments.find((assignment) => assignment.id === selectedAssignmentId) || studentData?.assignmentsById.get(selectedAssignmentId) || null
    : activeAssignments[0] || null;

  function selectBucket(bucket: AssignmentStatusBucket) {
    setActiveBucket(bucket);
    setSelectedAssignmentId(null);
  }

  return (
    <PageShell
      title="Assignments"
      subtitle="A focused task list for due work, submitted files, marked feedback, and archived assignments."
      section="student"
    >
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing assignments...</p> : null}
      {loading ? <AssignmentsSkeleton /> : null}
      {error ? (
        <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} />
      ) : null}
      {studentData ? (
        <section className="space-y-4" aria-labelledby="assignments-title">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Assignment desk</p>
            <h2 id="assignments-title" className="mt-1 text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment">
              Work sorted by status
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-academy-muted">
              Each assignment appears in one lane only, so the next task is easier to find.
            </p>
          </div>

          <AssignmentSegmentedControl
            activeBucket={activeBucket}
            buckets={studentData.assignmentBuckets}
            onChange={selectBucket}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <AssignmentList
              activeBucket={activeBucket}
              activeTab={activeTab}
              assignments={activeAssignments}
              selectedAssignmentId={selectedAssignment?.id}
              studentData={studentData}
              onSelect={setSelectedAssignmentId}
            />
            <AssignmentDetailDrawer
              assignment={selectedAssignment}
              submission={selectedAssignment ? studentData.submissionsByAssignmentId.get(selectedAssignment.id) : undefined}
            />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

export function AssignmentSegmentedControl({
  activeBucket,
  buckets,
  onChange,
}: {
  activeBucket: AssignmentStatusBucket;
  buckets: Map<string, Assignment[]>;
  onChange: (bucket: AssignmentStatusBucket) => void;
}) {
  return (
    <div className="academy-segmented grid-cols-4" role="tablist" aria-label="Assignment status buckets">
      {assignmentTabs.map((tab) => {
        const count = buckets.get(tab.key)?.length || 0;
        const isActive = tab.key === activeBucket;
        return (
          <button
            key={tab.key}
            aria-controls={`assignment-panel-${tab.key}`}
            aria-selected={isActive}
            className="academy-segment min-w-0"
            data-active={isActive}
            id={`assignment-tab-${tab.key}`}
            role="tab"
            type="button"
            onClick={() => onChange(tab.key)}
          >
            <span className="block truncate">{tab.label}</span>
            <span className="mt-0.5 block text-[0.68rem] opacity-75">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AssignmentList({
  activeBucket,
  activeTab,
  assignments,
  selectedAssignmentId,
  studentData,
  onSelect,
}: {
  activeBucket: AssignmentStatusBucket;
  activeTab: (typeof assignmentTabs)[number];
  assignments: Assignment[];
  selectedAssignmentId?: string;
  studentData: NormalizedStudentData;
  onSelect: (assignmentId: string) => void;
}) {
  const Icon = activeTab.icon;

  return (
    <section
      aria-labelledby={`assignment-tab-${activeBucket}`}
      className="rounded-ios-lg border border-white/70 bg-white/[0.48] shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]"
      id={`assignment-panel-${activeBucket}`}
      role="tabpanel"
    >
      <div className="flex items-start gap-3 border-b border-slate-950/5 p-4 dark:border-white/10">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ios border border-academy-aegean/10 bg-academy-aegean/[0.07] text-academy-aegean dark:border-academy-gold/20 dark:bg-academy-gold/10 dark:text-academy-gold">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-academy-ink dark:text-academy-parchment">{activeTab.label}</h3>
          <p className="mt-1 text-sm leading-6 text-academy-muted">{activeTab.description}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-950/5 px-2 dark:divide-white/10">
        {assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            selected={assignment.id === selectedAssignmentId}
            submission={studentData.submissionsByAssignmentId.get(assignment.id)}
            onSelect={() => onSelect(assignment.id)}
          />
        ))}
      </div>

      {!assignments.length ? (
        <div className="p-4">
          <EmptyState
            title={activeTab.emptyTitle}
            description={activeTab.emptyDescription}
            actionLabel={activeTab.emptyAction}
            actionHref={activeBucket === 'marked' ? '/dashboard/student/results' : activeBucket === 'due-now' ? '/dashboard/student/progress' : '/dashboard/student/assignments'}
            icon={activeTab.icon}
          />
        </div>
      ) : null}
    </section>
  );
}

export function AssignmentRow({
  assignment,
  submission,
  selected,
  onSelect,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  selected?: boolean;
  onSelect: () => void;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);
  const marks = submission?.marks_awarded;

  return (
    <article className={`group grid gap-3 rounded-ios px-2 py-3 transition duration-fluid ease-ios sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${selected ? 'bg-white/78 shadow-academy-soft dark:bg-white/[0.08]' : 'hover:bg-white/58 dark:hover:bg-white/[0.05]'}`}>
      <button className="min-w-0 text-left" type="button" onClick={onSelect}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-ios bg-slate-950/[0.04] text-academy-aegean dark:bg-white/[0.06] dark:text-academy-gold">
            {marks != null ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-academy-ink dark:text-academy-parchment">{assignment.title}</span>
            <span className="mt-1 block text-sm leading-6 text-academy-muted">
              {[assignment.subject || assignment.subject_id || 'Subject pending', formatAssignmentDue(assignment.due_date, dueDelta)].filter(Boolean).join(' • ')}
            </span>
          </span>
        </div>
      </button>
      <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={status} />
          {marks != null ? <span className="rounded-full bg-academy-gold/15 px-3 py-1 text-xs font-semibold text-academy-ink dark:text-academy-gold">{marks}%</span> : null}
        </div>
        <Link
          aria-label={`Open ${assignment.title}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-academy-muted transition duration-fluid ease-ios hover:bg-white hover:text-academy-navy dark:hover:bg-white/[0.08] dark:hover:text-white"
          to={`/student/assignments/${assignment.id}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function AssignmentDetailDrawer({
  assignment,
  submission,
}: {
  assignment: Assignment | null;
  submission?: AssignmentSubmission;
}) {
  if (!assignment) {
    return (
      <aside className="hidden rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035] lg:block">
        <EmptyState
          title="Select an assignment"
          description="Choose a row to preview due date, feedback, and the next action."
          icon={PanelRightClose}
        />
      </aside>
    );
  }

  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);

  return (
    <aside className="hidden rounded-ios-lg border border-white/70 bg-white/[0.62] p-5 shadow-academy backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] lg:block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Preview</p>
          <h3 className="mt-2 text-xl font-semibold text-academy-ink dark:text-academy-parchment">{assignment.title}</h3>
        </div>
        <StatusBadge value={status} />
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <DrawerFact label="Subject" value={assignment.subject || assignment.subject_id || 'Subject pending'} />
        <DrawerFact label="Due date" value={formatAssignmentDue(assignment.due_date, dueDelta)} />
        <DrawerFact label="Status" value={getAssignmentStatusLabel(status)} />
        {submission?.submitted_at ? <DrawerFact label="Submitted" value={formatDate(submission.submitted_at)} /> : null}
        {submission?.marks_awarded != null ? <DrawerFact label="Mark" value={`${submission.marks_awarded}%`} /> : null}
      </dl>

      {assignment.description ? (
        <p className="mt-5 line-clamp-5 rounded-ios border border-slate-950/5 bg-white/60 p-4 text-sm leading-6 text-academy-muted dark:border-white/10 dark:bg-white/[0.04]">
          {assignment.description}
        </p>
      ) : null}

      {submission?.feedback ? (
        <p className="mt-4 rounded-ios border border-academy-gold/20 bg-academy-gold/10 p-4 text-sm leading-6 text-academy-ink dark:text-academy-parchment">
          {submission.feedback}
        </p>
      ) : null}

      <Link className="academy-btn academy-btn-primary mt-5 w-full" to={`/student/assignments/${assignment.id}`}>
        Open assignment
      </Link>
    </aside>
  );
}

function DrawerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-950/5 pb-3 last:border-b-0 dark:border-white/10">
      <dt className="text-academy-muted">{label}</dt>
      <dd className="text-right font-semibold text-academy-ink dark:text-academy-parchment">{value}</dd>
    </div>
  );
}

function formatAssignmentDue(value?: string | null, delta?: number | null) {
  if (!value) return 'Due date pending';
  if (delta === 0) return `Due today`;
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  if (typeof delta === 'number') return `${delta} day${delta === 1 ? '' : 's'} left`;
  return formatDate(value);
}

function AssignmentsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonCard className="h-20" />
      <SkeletonCard className="h-96" />
    </div>
  );
}
