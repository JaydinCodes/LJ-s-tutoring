import { useMemo } from 'react';
import {
  Archive,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission, StudentAssignedTutor } from '../../types/lms';
import {
  calculateAssignmentStatus,
  daysUntil,
  getAssignmentStatusLabel,
  type AssignmentLifecycleStatus,
} from '../assignments/assignmentStatus';
import {
  normalizeStudentData,
  selectNextActionableAssignment,
  type NormalizedStudentData,
  type SmartTaskQueueGroup,
  type SmartTaskQueueItem,
} from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

type QueueFilter = 'due' | 'submitted' | 'marked' | 'archived';

const filterConfig: Array<{
  key: Exclude<QueueFilter, 'archived'>;
  label: string;
  helper: string;
  icon: LucideIcon;
  iconClass: string;
}> = [
  { key: 'due', label: 'Due', helper: 'Needs learner action', icon: CalendarDays, iconClass: 'bg-academy-gold/20 text-[#8a6400]' },
  { key: 'submitted', label: 'Submitted', helper: 'Awaiting feedback', icon: UploadCloud, iconClass: 'bg-[#e5edf5] text-academy-aegean' },
  { key: 'marked', label: 'Marked', helper: 'Feedback available', icon: FileCheck2, iconClass: 'bg-emerald-100 text-emerald-700' },
];

const groupConfig: Record<SmartTaskQueueGroup, { title: string; description: string; tone: string }> = {
  'needs-attention': {
    title: 'Needs attention',
    description: 'Overdue, due soon, incomplete, or returned work that needs action now.',
    tone: 'text-red-700 dark:text-red-300',
  },
  upcoming: {
    title: 'Upcoming',
    description: 'Published work ordered by due date.',
    tone: 'text-academy-aegean dark:text-academy-gold',
  },
  'waiting-feedback': {
    title: 'Waiting for feedback',
    description: 'Successfully submitted work with no learner action required.',
    tone: 'text-academy-aegean dark:text-academy-gold',
  },
  'recently-marked': {
    title: 'Recently marked',
    description: 'Released results and feedback ready to review.',
    tone: 'text-emerald-700 dark:text-emerald-300',
  },
};

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = parseQueueFilter(searchParams.get('view'));
  const selectedAssignmentId = searchParams.get('task');
  const nextTask = studentData ? selectNextActionableAssignment(studentData) : null;
  const queueGroups = studentData ? groupsForFilter(studentData, activeFilter) : [];
  const visibleItems = queueGroups.flatMap((group) => group.items);
  const archivedAssignments = studentData?.assignmentBuckets.get('archived') || [];
  const selectedAssignment = selectedAssignmentId
    ? studentData?.assignmentsById.get(selectedAssignmentId) || null
    : activeFilter === 'archived'
      ? archivedAssignments[0] || null
      : visibleItems[0]?.assignment || null;
  const selectedSubmission = selectedAssignment
    ? studentData?.submissionsByAssignmentId.get(selectedAssignment.id)
    : undefined;

  function changeFilter(filter: QueueFilter) {
    setSearchParams(filter === 'due' ? {} : { view: filter });
  }

  function selectTask(assignmentId: string) {
    const next = new URLSearchParams();
    if (activeFilter !== 'due') next.set('view', activeFilter);
    next.set('task', assignmentId);
    setSearchParams(next);
  }

  return (
    <PageShell
      title="Tasks"
      subtitle="Know what to do next."
      section="student"
      identity={data ? { name: data.profile.name, meta: data.profile.grade || 'Student' } : undefined}
    >
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing tasks...</p> : null}
      {loading ? <SmartQueueSkeleton /> : null}
      {error ? <ErrorState title="Tasks unavailable" description={error} onRetry={() => void reload()} /> : null}
      {studentData && data ? (
        <div className="smart-task-queue min-w-0 space-y-5">
          <section aria-label="Task priorities and filters" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(26rem,1fr)]">
            <NextUpPanel nextTask={nextTask} studentData={studentData} />
            <QueueSummaryTabs activeFilter={activeFilter} studentData={studentData} onChange={changeFilter} />
          </section>

          {!studentData.assignmentsById.size ? (
            <NoAssignmentsState />
          ) : (
            <section aria-label="Smart task queue" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.72fr)] xl:items-start">
              <TaskQueue
                activeFilter={activeFilter}
                archivedAssignments={archivedAssignments}
                groups={queueGroups}
                selectedAssignmentId={selectedAssignment?.id}
                studentData={studentData}
                onChangeFilter={changeFilter}
                onSelect={selectTask}
              />
              {selectedAssignment ? (
                <AssignmentDetailPanel
                  assignment={selectedAssignment}
                  submission={selectedSubmission}
                  allocatedTutor={data.assignedTutors?.[0]}
                />
              ) : null}
            </section>
          )}
          <div className="student-greek-key" aria-hidden="true" />
        </div>
      ) : null}
    </PageShell>
  );
}

function NextUpPanel({ nextTask, studentData }: { nextTask: SmartTaskQueueItem | null; studentData: NormalizedStudentData }) {
  const waitingCount = studentData.smartTaskQueue.get('waiting-feedback')?.length || 0;
  const markedCount = studentData.smartTaskQueue.get('recently-marked')?.length || 0;

  if (!nextTask) {
    const destination = waitingCount ? '/dashboard/student/assignments?view=submitted' : markedCount ? '/dashboard/student/assignments?view=marked' : '/dashboard/student';
    const action = waitingCount ? 'View submitted work' : markedCount ? 'Review feedback' : 'Return to Today';
    return (
      <section className="relative min-h-[17.5rem] overflow-hidden rounded-sheet border border-white/10 bg-academy-navy p-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)] sm:p-7">
        <ClassicalPanelArtwork />
        <div className="relative flex h-full max-w-2xl flex-col justify-between gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Next up</p>
            <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">You&apos;re caught up</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
              No assignments currently need learner action. Submitted work and released feedback remain available in the queue.
            </p>
          </div>
          <Link className="academy-btn academy-btn-gold w-full rounded-xl sm:w-fit sm:min-w-64" to={destination}>
            {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const { assignment, submission, status } = nextTask;
  const action = getTaskAction(status, submission);
  return (
    <section className="relative min-h-[17.5rem] overflow-hidden rounded-sheet border border-white/10 bg-academy-navy p-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)] sm:p-7">
      <ClassicalPanelArtwork />
      <div className="relative flex h-full max-w-2xl flex-col justify-between gap-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Next up</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">{assignment.title}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-200">
            <span className="inline-flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-academy-gold" aria-hidden="true" />{subjectLabel(assignment)}</span>
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 text-academy-gold" aria-hidden="true" />{formatDueMoment(assignment.due_date)}</span>
            <span className="inline-flex items-center gap-2"><Clock3 className="h-5 w-5 text-academy-gold" aria-hidden="true" />{getQueueStatusText(status, assignment.due_date)}</span>
          </div>
        </div>
        <Link data-testid="task-primary-action" className="academy-btn academy-btn-gold w-full rounded-xl sm:w-fit sm:min-w-64" to={`/dashboard/student/assignments/${assignment.id}`}>
          {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function ClassicalPanelArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-cover bg-right opacity-25" style={{ backgroundImage: "url('/images/dashboard/student-learning-plan-classical.webp')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-academy-navy via-academy-navy/95 to-academy-navy/30" />
    </div>
  );
}

export function QueueSummaryTabs({
  activeFilter,
  studentData,
  onChange,
}: {
  activeFilter: QueueFilter;
  studentData: NormalizedStudentData;
  onChange: (filter: QueueFilter) => void;
}) {
  const counts: Record<QueueFilter, number> = {
    due: (studentData.smartTaskQueue.get('needs-attention')?.length || 0) + (studentData.smartTaskQueue.get('upcoming')?.length || 0),
    submitted: studentData.smartTaskQueue.get('waiting-feedback')?.length || 0,
    marked: studentData.smartTaskQueue.get('recently-marked')?.length || 0,
    archived: studentData.assignmentBuckets.get('archived')?.length || 0,
  };

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3" role="tablist" aria-label="Task queue filters">
        {filterConfig.map((filter) => {
          const Icon = filter.icon;
          const selected = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              aria-controls="smart-task-panel"
              aria-selected={selected}
              className="flex min-h-32 min-w-0 flex-col items-start rounded-ios border border-[#ded5c6] bg-[#fffbf2] p-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.045)] transition hover:border-academy-gold data-[active=true]:border-academy-gold data-[active=true]:shadow-[0_12px_28px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-slate-900 sm:min-h-[11rem] sm:p-4"
              data-active={selected}
              id={`task-filter-${filter.key}`}
              role="tab"
              type="button"
              onClick={() => onChange(filter.key)}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${filter.iconClass}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="mt-3 min-w-0">
                <span className="font-display text-3xl font-semibold leading-none text-academy-navy dark:text-white sm:text-4xl">{counts[filter.key]}</span>
                <span className="ml-1 text-xs font-semibold text-academy-navy dark:text-white sm:text-sm">{filter.label.toLowerCase()}</span>
              </span>
              <span className="mt-2 hidden text-xs leading-5 text-academy-muted sm:block">{filter.helper}</span>
            </button>
          );
        })}
      </div>
      <button
        aria-pressed={activeFilter === 'archived'}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-academy-aegean hover:bg-white/70 dark:text-academy-gold dark:hover:bg-white/5"
        type="button"
        onClick={() => onChange('archived')}
      >
        <Archive className="h-4 w-4" aria-hidden="true" /> Archive <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-academy-navy dark:bg-white/10 dark:text-white">{counts.archived}</span>
      </button>
    </div>
  );
}

export function TaskQueue({
  activeFilter,
  archivedAssignments,
  groups,
  selectedAssignmentId,
  studentData,
  onChangeFilter,
  onSelect,
}: {
  activeFilter: QueueFilter;
  archivedAssignments: Assignment[];
  groups: Array<{ key: SmartTaskQueueGroup; items: SmartTaskQueueItem[] }>;
  selectedAssignmentId?: string;
  studentData: NormalizedStudentData;
  onChangeFilter: (filter: QueueFilter) => void;
  onSelect: (assignmentId: string) => void;
}) {
  const itemCount = activeFilter === 'archived' ? archivedAssignments.length : groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <section className="min-w-0 overflow-hidden rounded-ios-lg border border-[#ded5c6] bg-[#fffbf2] shadow-[0_12px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900" id="smart-task-panel" role="tabpanel" aria-labelledby={activeFilter === 'archived' ? undefined : `task-filter-${activeFilter}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7dfd1] px-4 py-4 dark:border-white/10 sm:px-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Your task queue</h2>
          <p className="mt-1 text-sm text-academy-muted">One task, one group, one clear next action.</p>
        </div>
        <span className="rounded-full bg-[#e8f0f8] px-3 py-1.5 text-xs font-semibold text-academy-aegean dark:bg-white/10 dark:text-academy-gold">{itemCount} {itemCount === 1 ? 'task' : 'tasks'}</span>
      </div>

      {activeFilter === 'archived' ? (
        archivedAssignments.length ? (
          <div className="px-3 pb-3 sm:px-5 sm:pb-5">
            <QueueGroupHeading title="Archive" count={archivedAssignments.length} tone="text-academy-muted" />
            <div className="divide-y divide-[#e7dfd1] dark:divide-white/10">
              {archivedAssignments.map((assignment) => (
                <AssignmentQueueRow
                  key={assignment.id}
                  assignment={assignment}
                  submission={studentData.submissionsByAssignmentId.get(assignment.id)}
                  selected={assignment.id === selectedAssignmentId}
                  onSelect={() => onSelect(assignment.id)}
                />
              ))}
            </div>
          </div>
        ) : <QueueEmptyState activeFilter={activeFilter} studentData={studentData} onChangeFilter={onChangeFilter} />
      ) : itemCount ? (
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          {groups.map(({ key, items }) => items.length ? (
            <section key={key} aria-labelledby={`queue-group-${key}`}>
              <QueueGroupHeading id={`queue-group-${key}`} title={groupConfig[key].title} count={items.length} tone={groupConfig[key].tone} />
              <p className="-mt-2 mb-2 hidden text-xs text-academy-muted sm:block">{groupConfig[key].description}</p>
              <div className="divide-y divide-[#e7dfd1] dark:divide-white/10">
                {items.map((item) => (
                  <AssignmentQueueRow
                    key={item.assignmentId}
                    assignment={item.assignment}
                    submission={item.submission}
                    selected={item.assignmentId === selectedAssignmentId}
                    status={item.status}
                    onSelect={() => onSelect(item.assignmentId)}
                  />
                ))}
              </div>
            </section>
          ) : null)}
        </div>
      ) : <QueueEmptyState activeFilter={activeFilter} studentData={studentData} onChangeFilter={onChangeFilter} />}
    </section>
  );
}

function QueueGroupHeading({ title, count, tone, id }: { title: string; count: number; tone: string; id?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-5">
      <h3 className={`text-sm font-bold ${tone}`} id={id}>{title}</h3>
      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-academy-navy dark:bg-white/10 dark:text-white">{count}</span>
    </div>
  );
}

export function AssignmentQueueRow({
  assignment,
  submission,
  selected,
  status = calculateAssignmentStatus({ assignment, submission }),
  onSelect,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  selected?: boolean;
  status?: AssignmentLifecycleStatus;
  onSelect: () => void;
}) {
  const action = getTaskAction(status, submission);
  const timing = status === 'marked'
    ? `Released ${formatDate(submission?.released_at || submission?.submitted_at)}`
    : status === 'submitted' || status === 'under_review' || status === 'late_submitted'
      ? `Submitted ${formatDate(submission?.submitted_at)}`
      : formatDueMoment(assignment.due_date);

  const content = (
    <>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${status === 'returned_for_correction' || status === 'missing' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : status === 'marked' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-academy-gold/15 text-[#8a6400] dark:text-academy-gold'}`}>
        {status === 'returned_for_correction' ? <RotateCcw className="h-5 w-5" aria-hidden="true" /> : status === 'marked' ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold leading-5 text-academy-navy dark:text-white">{assignment.title}</span>
        <span className="mt-1 block text-xs text-academy-muted">{subjectLabel(assignment)}</span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:hidden">
          <span className="font-semibold text-academy-ink dark:text-academy-parchment">{timing}</span>
          <span className="text-academy-muted">{getQueueStatusText(status, assignment.due_date)}</span>
        </span>
      </span>
      <span className="hidden w-36 shrink-0 text-sm text-academy-muted sm:block">{timing}</span>
      <span className="hidden w-40 shrink-0 text-sm font-medium text-academy-ink dark:text-academy-parchment md:block">{getQueueStatusText(status, assignment.due_date)}</span>
      <span className={`col-start-2 row-start-2 mt-2 inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold sm:min-w-28 lg:col-auto lg:row-auto lg:mt-0 lg:w-auto ${selected ? 'border-academy-gold bg-academy-gold text-academy-ink' : 'border-academy-aegean/40 bg-white text-academy-aegean dark:border-white/20 dark:bg-slate-950 dark:text-academy-gold'}`}>
        <span className="hidden xs:inline">{action}</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </>
  );

  return (
    <article className={`rounded-xl transition ${selected ? 'bg-academy-gold/[0.07] ring-1 ring-inset ring-academy-gold/50 dark:bg-academy-gold/[0.08]' : 'hover:bg-white dark:hover:bg-white/[0.04]'}`}>
      <button aria-label={`Preview ${assignment.title}`} aria-pressed={selected} className="hidden min-h-[5.25rem] w-full items-center gap-3 px-2 py-3 text-left lg:flex" type="button" onClick={onSelect}>{content}</button>
      <Link aria-label={`Open ${assignment.title}: ${action}`} className="grid min-h-[5.25rem] grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 px-2 py-3 lg:hidden" to={`/dashboard/student/assignments/${assignment.id}`}>{content}</Link>
    </article>
  );
}

export function AssignmentDetailPanel({
  assignment,
  submission,
  allocatedTutor,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  allocatedTutor?: StudentAssignedTutor;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const action = getTaskAction(status, submission);
  const canShowFeedback = Boolean(submission?.feedback && (submission.feedback_released || submission.released_at));
  const canShowMark = submission?.marks_awarded != null && Boolean(submission.marks_released || submission.released_at);

  return (
    <aside className="hidden min-w-0 rounded-ios-lg border border-[#ded5c6] bg-[#fffbf2] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900 xl:block" aria-label={`Details for ${assignment.title}`}>
      <div className="border-b border-[#e7dfd1] pb-4 dark:border-white/10">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-academy-muted">Due</p>
        <p className={`mt-1 font-semibold ${status === 'missing' || status === 'due_soon' ? 'text-red-700 dark:text-red-300' : 'text-academy-navy dark:text-white'}`}>{formatDueMoment(assignment.due_date)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge value={status} />{canShowMark ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{submission?.marks_awarded}%</span> : null}</div>
      </div>

      <DetailSection icon={BookOpenCheck} label="Subject" title={subjectLabel(assignment)} />
      {allocatedTutor ? <DetailSection icon={GraduationCap} label="Allocated support tutor" title={allocatedTutor.full_name} detail="General learner support contact" /> : null}

      <section className="border-t border-[#e7dfd1] py-4 dark:border-white/10">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-academy-muted">Instructions</p>
        <p className="mt-2 text-sm leading-6 text-academy-ink dark:text-academy-parchment">{assignment.description || 'No additional instructions were provided.'}</p>
        {assignment.attachment_url ? (
          <a className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-academy-aegean hover:text-academy-navy dark:text-academy-gold dark:hover:text-white" href={assignment.attachment_url} rel="noreferrer" target="_blank">
            <Download className="h-4 w-4" aria-hidden="true" /> Open assignment attachment
          </a>
        ) : null}
      </section>

      <section className="border-t border-[#e7dfd1] py-4 dark:border-white/10">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-academy-muted">Submission</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e5edf5] text-academy-aegean dark:bg-white/10 dark:text-academy-gold"><Paperclip className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-academy-navy dark:text-white">{submission?.original_filename || (submission?.text_answer ? 'Written response submitted' : 'PDF, JPG, PNG, or written response')}</p>
            <p className="mt-1 text-xs leading-5 text-academy-muted">{submission ? submissionDetail(submission) : 'Maximum file size: 5 MiB.'}</p>
          </div>
        </div>
      </section>

      {canShowFeedback ? (
        <section className="border-t border-[#e7dfd1] py-4 dark:border-white/10">
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-academy-muted"><MessageSquareText className="h-4 w-4" aria-hidden="true" /> Released feedback</p>
          <p className="mt-2 rounded-xl bg-academy-gold/10 p-3 text-sm leading-6 text-academy-ink dark:text-academy-parchment">{submission?.feedback}</p>
        </section>
      ) : null}

      <section className="border-t border-[#e7dfd1] pt-4 dark:border-white/10">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-academy-muted">Next required action</p>
        <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-academy-navy dark:text-white"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />{nextActionGuidance(status)}</p>
        <Link className="academy-btn academy-btn-gold mt-5 w-full rounded-xl" to={`/dashboard/student/assignments/${assignment.id}`}>{action} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>
    </aside>
  );
}

function DetailSection({ icon: Icon, label, title, detail }: { icon: LucideIcon; label: string; title: string; detail?: string }) {
  return (
    <section className="flex items-start gap-3 border-t border-[#e7dfd1] py-4 dark:border-white/10">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e5edf5] text-academy-aegean dark:bg-white/10 dark:text-academy-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-academy-muted">{label}</p><p className="mt-1 text-sm font-semibold text-academy-navy dark:text-white">{title}</p>{detail ? <p className="mt-1 text-xs text-academy-muted">{detail}</p> : null}</div>
    </section>
  );
}

function QueueEmptyState({ activeFilter, studentData, onChangeFilter }: { activeFilter: QueueFilter; studentData: NormalizedStudentData; onChangeFilter: (filter: QueueFilter) => void }) {
  const waiting = studentData.smartTaskQueue.get('waiting-feedback')?.length || 0;
  const marked = studentData.smartTaskQueue.get('recently-marked')?.length || 0;
  const config = activeFilter === 'due'
    ? { title: 'No actionable work', description: waiting ? 'You are caught up. Your submitted work is waiting for feedback.' : marked ? 'You are caught up. Released feedback is ready to review.' : 'You are caught up. New published assignments will appear here.', icon: CheckCircle2 }
    : activeFilter === 'submitted'
      ? { title: 'Nothing waiting for feedback', description: 'Successfully submitted work will appear here while your tutor reviews it.', icon: UploadCloud }
      : activeFilter === 'marked'
        ? { title: 'No released feedback yet', description: 'Only marks and feedback released to you will appear in this queue.', icon: FileCheck2 }
        : { title: 'Archive is empty', description: 'Closed and archived work stays here without cluttering your active queue.', icon: Archive };
  const alternate = activeFilter === 'due' && waiting ? 'submitted' : activeFilter === 'due' && marked ? 'marked' : null;

  return (
    <div className="p-5">
      <EmptyState title={config.title} description={config.description} icon={config.icon} />
      {alternate ? <button className="academy-btn academy-btn-outline mx-auto mt-3 flex" type="button" onClick={() => onChangeFilter(alternate)}>View {alternate} work</button> : null}
    </div>
  );
}

function NoAssignmentsState() {
  return (
    <section className="rounded-ios-lg border border-[#ded5c6] bg-[#fffbf2] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <EmptyState title="No assignments yet" description="When your tutor publishes work, it will appear here in priority order. You can continue learning from Today, Progress, or Resources." icon={BookOpenCheck} />
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link className="academy-btn academy-btn-gold" to="/dashboard/student">Return to Today</Link>
        <Link className="academy-btn academy-btn-outline" to="/dashboard/student/progress">Open progress</Link>
        <Link className="academy-btn academy-btn-outline" to="/dashboard/student/community">View resources</Link>
      </div>
    </section>
  );
}

function groupsForFilter(data: NormalizedStudentData, filter: QueueFilter) {
  const keys: SmartTaskQueueGroup[] = filter === 'due'
    ? ['needs-attention', 'upcoming']
    : filter === 'submitted'
      ? ['waiting-feedback']
      : filter === 'marked'
        ? ['recently-marked']
        : [];
  return keys.map((key) => ({ key, items: data.smartTaskQueue.get(key) || [] }));
}

function parseQueueFilter(value: string | null): QueueFilter {
  return value === 'submitted' || value === 'marked' || value === 'archived' ? value : 'due';
}

function subjectLabel(assignment: Assignment) {
  return assignment.subject?.trim() || 'Subject not listed';
}

function getTaskAction(status: AssignmentLifecycleStatus, submission?: AssignmentSubmission) {
  if (status === 'returned_for_correction') return 'Review corrections';
  if (status === 'marked') return 'Review feedback';
  if (status === 'submitted' || status === 'under_review' || status === 'late_submitted') return 'View submission';
  if (submission) return 'Update submission';
  if (status === 'closed' || status === 'archived' || status === 'draft') return 'View details';
  return 'Start assignment';
}

function getQueueStatusText(status: AssignmentLifecycleStatus, dueDate?: string | null) {
  if (status === 'missing') return 'Overdue — action needed';
  if (status === 'returned_for_correction') return 'Correction requested';
  if (status === 'due_soon') {
    const delta = daysUntil(dueDate);
    return delta === 0 ? 'Due today' : delta === 1 ? 'Due tomorrow' : 'Due soon';
  }
  if (status === 'under_review' || status === 'submitted' || status === 'late_submitted') return 'Waiting for feedback';
  if (status === 'marked') return 'Feedback released';
  return getAssignmentStatusLabel(status);
}

function nextActionGuidance(status: AssignmentLifecycleStatus) {
  if (status === 'returned_for_correction') return 'Read the released feedback, update your work, and submit a new version.';
  if (status === 'marked') return 'Review the released result and feedback.';
  if (status === 'submitted' || status === 'under_review' || status === 'late_submitted') return 'No action is required while your tutor reviews this submission.';
  if (status === 'closed' || status === 'archived' || status === 'draft') return 'This task is read-only.';
  return 'Open the assignment, read the instructions, and submit your work.';
}

function formatDueMoment(value?: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Due date unavailable';
  const delta = daysUntil(value);
  const relative = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : delta != null && delta < 0 ? `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue` : date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  const hasTime = /T\d{2}:\d{2}/.test(value);
  return hasTime ? `${relative} · ${date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}` : relative;
}

function submissionDetail(submission: AssignmentSubmission) {
  const parts = [submission.mime_type, submission.size_bytes ? formatBytes(submission.size_bytes) : null, submission.submitted_at ? `Submitted ${formatDate(submission.submitted_at)}` : null];
  return parts.filter(Boolean).join(' · ') || 'Submission received';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function SmartQueueSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading task queue">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(26rem,1fr)]"><SkeletonCard className="h-72" /><div className="grid grid-cols-3 gap-3"><SkeletonCard className="h-44" /><SkeletonCard className="h-44" /><SkeletonCard className="h-44" /></div></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.72fr)]"><SkeletonCard className="h-96" /><SkeletonCard className="hidden h-96 xl:block" /></div>
    </div>
  );
}
