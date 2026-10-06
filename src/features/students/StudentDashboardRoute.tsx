import { useMemo } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  MessageSquareText,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { LearningTimeline, SubjectProgressBands, TodayOdyssey } from './StudentDashboardComponents';
import { normalizeStudentData, selectDueTasks } from './studentData';
import { selectTodayBattlePlan, type BattlePlanItem } from './studentBattlePlan';
import { selectDailyInsight } from './studentDailyInsight';
import { useStudentDashboardQuery } from './studentQueries';
import { useDueRetentionStep, useLearnerMasterySummary, useNextLearningStep } from '../learning/studentLearningQueries';
import { daysUntil } from '../assignments/assignmentStatus';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission, StudentDashboardView, StudentProgress } from '../../types/lms';
import type { LearnerMasterySummary } from '../learning/studentLearningRepository';

const masteryLabels: Record<LearnerMasterySummary['state'], string> = {
  unassessed: 'Not assessed yet',
  emerging: 'Starting',
  developing: 'Making progress',
  secure: 'Strong understanding',
  retained: 'Remembered over time',
};

export function StudentDashboardRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const nextStepQuery = useNextLearningStep();
  const retentionQuery = useDueRetentionStep();
  const masteryQuery = useLearnerMasterySummary();
  const nextStep = retentionQuery.data ?? nextStepQuery.data;

  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const nextAssignment = studentData ? selectDueTasks(studentData, 1)[0]?.assignment : undefined;
  const dailyInsight = useMemo(() => data && studentData ? selectDailyInsight(data, studentData) : null, [data, studentData]);
  const battlePlan = useMemo(() => data && studentData ? selectTodayBattlePlan(data, studentData) : [], [data, studentData]);

  const needsAttentionItem = useMemo(() => {
    if (!data) return null;
    const emergingSkill = masteryQuery.data?.find((s) => s.state === 'emerging');
    if (emergingSkill) {
      let to = '/dashboard/student/progress';
      if (nextStep?.activityCode && nextStep.targetSkillCode === emergingSkill.skillCode) {
        to = `/dashboard/student/learning/activity/${encodeURIComponent(nextStep.activityCode)}`;
      }
      return {
        topic: emergingSkill.skillName,
        reason: 'Identified as needing conceptual foundation practice in recent diagnostic checks.',
        to,
      };
    }
    const lowestResult = findLowestRecordedResult(data.progress);
    if (lowestResult && lowestResult.score < 70) {
      return {
        source: 'school-result' as const,
        topic: lowestResult.topic,
        score: lowestResult.score,
        reason: `Your lowest recorded result was ${lowestResult.score}%.`,
        to: '/dashboard/student/progress',
      };
    }
    return null;
  }, [data, masteryQuery.data, nextStep]);

  return (
    <PageShell
      title="Today"
      subtitle={dailyInsight?.message || "Here's what moves you forward today."}
      section="student"
      identity={data ? { name: data.profile.name, meta: data.profile.grade || 'Student' } : undefined}
    >
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing today's plan...</p> : null}
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <div className="student-dashboard space-y-5">
          <section aria-label="Today's priorities" className="grid min-w-0 gap-5 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <TodayOdyssey
                nextAssignment={nextAssignment}
                battlePlan={battlePlan}
                nextStep={nextStep}
              />
            </div>
            <NextSessionCard data={data} />
          </section>

          {needsAttentionItem ? (
            <NeedsAttentionBanner item={needsAttentionItem} />
          ) : null}

          <StudentBentoGrid data={data} battlePlan={battlePlan} mastery={masteryQuery.data ?? []} />

          <section aria-label="Extended learning detail" className="grid min-w-0 gap-5 border-t border-academy-gold/20 pt-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
            <LearningTimeline items={battlePlan} />
            <SubjectProgressBands progress={data.progress} />
          </section>
          <div className="student-greek-key" aria-hidden="true" />
        </div>
      ) : null}
    </PageShell>
  );
}

function NextSessionCard({ data }: { data: StudentDashboardView }) {
  const sessions = [...data.sessions]
    .filter((session) => session.date)
    .sort((left, right) => `${left.date}T${left.start_time || '00:00'}`.localeCompare(`${right.date}T${right.start_time || '00:00'}`));
  const now = Date.now();
  const nextSession = sessions.find((session) => new Date(`${session.date}T${session.start_time || '00:00'}`).getTime() >= now) || sessions[0];
  const tutor = data.assignedTutors?.[0];

  return (
    <article className="student-session-card relative min-h-[20rem] overflow-hidden rounded-sheet border border-academy-gold/70 bg-[#fffbf2] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.055)] dark:border-academy-gold/30 dark:bg-slate-900 sm:p-8 xl:col-span-5">
      <div className="absolute inset-0 bg-cover bg-center opacity-70 dark:opacity-10" aria-hidden="true" style={{ backgroundImage: "url('/images/dashboard/student-session-voyage.webp')" }} />
      <div className="relative flex h-full max-w-[24rem] flex-col">
        <div>
          <h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white sm:text-3xl">Next tutoring session</h2>
          <span className="mt-3 block h-0.5 w-8 bg-academy-gold" aria-hidden="true" />
        </div>
        {nextSession ? (
          <div className="mt-7 flex flex-1 flex-col justify-between gap-6">
            <div className="flex items-start gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#e5edf5] text-academy-navy dark:bg-white/10 dark:text-academy-gold">
                <CalendarDays className="h-8 w-8" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="font-display text-2xl font-semibold text-academy-navy dark:text-white">{formatSessionDate(nextSession.date)} · {nextSession.start_time?.slice(0, 5)}</p>
                <p className="mt-1 text-lg text-academy-muted">{nextSession.mode || 'Tutoring'}</p>
                {tutor?.full_name ? <p className="mt-1 text-sm text-academy-muted">with {tutor.full_name}</p> : null}
              </div>
            </div>
            <Link className="academy-btn academy-btn-outline w-full rounded-xl border-academy-aegean bg-white/90 sm:w-fit sm:min-w-64" to="/dashboard/student/sessions">
              View session details <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : <CompactEmpty title="No session scheduled" detail="Your next tutoring session will appear here once it is arranged." />}
      </div>
    </article>
  );
}

function StudentBentoGrid({ data, battlePlan, mastery }: { data: StudentDashboardView; battlePlan: BattlePlanItem[]; mastery: LearnerMasterySummary[] }) {
  const assignments = [...data.assignments]
    .filter((assignment) => assignment.status !== 'archived')
    .sort((left, right) => String(left.due_date || '9999').localeCompare(String(right.due_date || '9999')))
    .slice(0, 2);
  // Keep one adaptive next step visible even on a busy assignment day. Hiding
  // it whenever two assignments exist made genuine recommendation evidence
  // disappear from the learner's dashboard.
  const suggestedPractice = battlePlan.find((item) => item.kind !== 'assignment');
  const latestFeedback = [...data.submissions]
    .filter((submission) => Boolean(submission.feedback))
    .sort((left, right) => String(right.released_at || right.submitted_at || '').localeCompare(String(left.released_at || left.submitted_at || '')))[0];
  const streakDays = data.dailyInsightContext?.streakDays || 0;
  const masterySummary = summarizeMastery(mastery);
  const latestSchoolResult = findLatestSchoolResult(data.progress);

  return (
    <section aria-label="Today at a glance" className="grid min-w-0 gap-5 xl:grid-cols-12">
      <article className="student-bento-card xl:col-span-5">
        <div className="flex items-start justify-between gap-4">
          <EditorialHeading icon={ScrollText} title="Assignments" />
          {assignments.length ? <span className="rounded-xl bg-[#e8f0f8] px-3 py-2 text-xs font-semibold text-academy-aegean dark:bg-white/10 dark:text-academy-gold">{assignments.length} due next</span> : null}
        </div>
        {assignments.length || suggestedPractice ? (
          <div className="mt-4 divide-y divide-[#e7dfd1] dark:divide-white/10">
            {assignments.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} submission={data.submissions.find((submission) => submission.assignment_id === assignment.id)} />
            ))}
            {suggestedPractice ? <SuggestedPracticeRow item={suggestedPractice} /> : null}
          </div>
        ) : <CompactEmpty title="Nothing due" detail="You are up to date on all assignments." />}
        <Link className="mt-auto flex min-h-12 items-center justify-between border-t border-[#e7dfd1] pt-4 text-sm font-semibold text-academy-aegean dark:border-white/10 dark:text-academy-gold" to="/dashboard/student/assignments">
          View all assignments <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </article>

      <article className="student-bento-card xl:col-span-4">
        <EditorialHeading icon={Sparkles} title="Learning progress" />
        {masterySummary.length ? (
          <div className="mt-4 flex flex-1 flex-col">
            <div className="flex items-end justify-between gap-3">
              <p className="font-display text-xl font-semibold text-academy-navy dark:text-white">{mastery.length} skill{mastery.length === 1 ? '' : 's'} tracked</p>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-academy-muted">
              {masterySummary.map(({ state, count }) => <p key={state}><span className="font-semibold text-academy-navy dark:text-white">{count}</span> {masteryLabels[state]}</p>)}
            </div>
            <p className="mt-4 text-sm text-academy-muted">Focus next: {mastery.find((skill) => skill.state === 'emerging' || skill.state === 'developing')?.skillName || 'Keep building independent evidence.'}</p>
            <Link className="mt-auto flex min-h-12 items-center justify-between border-t border-[#e7dfd1] pt-4 text-sm font-semibold text-academy-aegean dark:border-white/10 dark:text-academy-gold" to="/dashboard/student/progress">
              View learning progress <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : <CompactEmpty title="No learning evidence yet" detail="Complete a diagnostic or practice activity to begin tracking learning progress." />}
      </article>

      <div className="grid min-w-0 gap-5 xl:col-span-3">
        {latestSchoolResult ? (
          <article className="student-bento-card">
            <EditorialHeading icon={ScrollText} title="Latest school result" />
            <div className="mt-4 flex flex-1 flex-col">
              <p className="font-display text-xl font-semibold text-academy-navy dark:text-white">{latestSchoolResult.subject || 'School assessment'}</p>
              <p className="mt-1 font-display text-4xl font-semibold text-academy-navy dark:text-white">{latestSchoolResult.score}%</p>
              <p className="mt-2 text-sm text-academy-muted">{latestSchoolResult.topic}</p>
              <Link className="mt-auto flex min-h-12 items-center justify-between border-t border-[#e7dfd1] pt-4 text-sm font-semibold text-academy-aegean dark:border-white/10 dark:text-academy-gold" to="/dashboard/student/results">
                View school results <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ) : null}
        {streakDays > 0 ? <StreakCard days={streakDays} /> : null}
        <FeedbackCard feedback={latestFeedback} compact={streakDays > 0} />
      </div>
    </section>
  );
}

function AssignmentRow({ assignment, submission }: { assignment: Assignment; submission?: AssignmentSubmission }) {
  const status = submission?.marks_awarded != null || submission?.status === 'marked'
    ? 'Complete'
    : submission ? 'Awaiting review' : daysUntil(assignment.due_date) != null && Number(daysUntil(assignment.due_date)) < 0 ? 'Overdue' : 'In progress';
  const tone = status === 'Complete' ? 'bg-emerald-50 text-emerald-800' : status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-[#e8f0f8] text-academy-aegean';

  return (
    <Link className="flex min-h-[5.75rem] items-center gap-4 py-4" to={`/student/assignments/${assignment.id}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-academy-gold/20 text-academy-navy dark:text-academy-gold">
        <ScrollText className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-semibold text-academy-navy dark:text-white">{assignment.title}</span>
        <span className="mt-1 block text-sm text-academy-muted">{formatAssignmentDue(assignment.due_date)}</span>
      </span>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>
    </Link>
  );
}

function SuggestedPracticeRow({ item }: { item: BattlePlanItem }) {
  return (
    <Link className="flex min-h-[5.75rem] items-center gap-4 py-4" to={item.to}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-academy-aegean/10 text-academy-aegean dark:bg-white/10 dark:text-academy-gold">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-academy-aegean dark:text-academy-gold">Suggested practice</span>
        <span className="mt-1 block line-clamp-2 font-display text-lg font-semibold leading-tight text-academy-navy dark:text-white">{item.title}</span>
        <span className="mt-1 block text-sm text-academy-muted">About {item.estimatedMinutes} min</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />
    </Link>
  );
}

function StreakCard({ days }: { days: number }) {
  return (
    <article className="relative min-h-[8.5rem] overflow-hidden rounded-sheet border border-white/10 bg-academy-navy p-5 text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-academy-gold/20" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-academy-gold/40 bg-white/[0.05] text-academy-gold">
          <Flame className="h-7 w-7" aria-hidden="true" />
        </span>
        <div><p className="font-display text-4xl font-semibold text-academy-gold">{days}</p><p className="text-sm text-academy-parchment">day study streak</p></div>
      </div>
    </article>
  );
}

function FeedbackCard({ feedback, compact }: { feedback?: AssignmentSubmission; compact: boolean }) {
  return (
    <article className={`student-bento-card relative min-h-0 overflow-hidden ${compact ? '' : 'min-h-[14rem]'}`}>
      <div className="absolute -bottom-12 -right-8 h-40 w-24 rotate-[-16deg] rounded-full border-l border-academy-gold/20" aria-hidden="true" />
      <EditorialHeading icon={MessageSquareText} title="Recent feedback" />
      {feedback ? (
        <div className="relative mt-5 flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e5edf5] text-academy-navy dark:bg-white/10 dark:text-academy-gold"><MessageSquareText className="h-6 w-6" aria-hidden="true" /></span>
          <div><p className="font-semibold leading-6 text-academy-navy dark:text-white">{feedback.feedback}</p><p className="mt-2 text-xs text-academy-muted">Released {formatDate(feedback.released_at || feedback.submitted_at)}</p></div>
        </div>
      ) : <CompactEmpty title="No feedback yet" detail="Tutor comments will appear here after reviewed work is released." />}
    </article>
  );
}

function EditorialHeading({ icon: Icon, title }: { icon: typeof Clock; title: string }) {
  return <div><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">{title}</h2></div><span className="mt-2 block h-0.5 w-7 bg-academy-gold" aria-hidden="true" /></div>;
}

function CompactEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-3 dark:border-white/15"><p className="text-sm font-semibold text-academy-navy dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{detail}</p></div>;
}

function NeedsAttentionBanner({ item }: { item: { source?: 'school-result'; topic: string; score?: number; reason?: string; to?: string } }) {
  return (
    <section aria-label="Needs attention" className="rounded-sheet border border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-white p-5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                {item.source === 'school-result' ? 'Review suggested' : 'Needs attention'}
              </span>
              {typeof item.score === 'number' ? (
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  {item.score}% {item.source === 'school-result' ? 'result' : 'accuracy'}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 font-display text-lg font-semibold text-academy-navy dark:text-white sm:text-xl">
              {item.topic}
            </h3>
            <p className="mt-0.5 text-sm text-academy-muted">
              {item.reason || 'Recent checks show a pattern to reinforce before moving on to new topics.'}
            </p>
          </div>
        </div>
        <Link
          className="academy-btn inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-amber-400 bg-white px-5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800 sm:self-center"
          to={item.to || '/dashboard/student/progress'}
        >
          Practise {item.topic.toLowerCase()} <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function summarizeMastery(mastery: LearnerMasterySummary[]) {
  const counts = new Map<LearnerMasterySummary['state'], number>();
  for (const skill of mastery) counts.set(skill.state, (counts.get(skill.state) ?? 0) + 1);
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((left, right) => left.state.localeCompare(right.state));
}

function findLatestSchoolResult(progress: StudentProgress[]) {
  return [...progress]
    .filter((item) => Number.isFinite(Number(item.score)))
    .sort((left, right) => String(right.recorded_at || '').localeCompare(String(left.recorded_at || '')))[0];
}

function findLowestRecordedResult(progress: StudentProgress[]) {
  return [...progress]
    .filter((item) => Number.isFinite(Number(item.score)))
    .sort((left, right) => Number(left.score) - Number(right.score))[0];
}

function formatSessionDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? formatDate(date) : parsed.toLocaleDateString('en-ZA', { weekday: 'long' });
}

function formatAssignmentDue(date?: string | null) {
  const delta = daysUntil(date);
  if (!date) return 'Due date pending';
  if (delta === 0) return 'Due today';
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  return `Due ${formatDate(date)}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-12"><SkeletonCard className="h-80 xl:col-span-7" /><SkeletonCard className="h-80 xl:col-span-5" /></div>
      <div className="grid gap-5 xl:grid-cols-12"><SkeletonCard className="h-80 xl:col-span-5" /><SkeletonCard className="h-80 xl:col-span-4" /><SkeletonCard className="h-80 xl:col-span-3" /></div>
    </div>
  );
}
