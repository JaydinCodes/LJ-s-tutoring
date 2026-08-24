import { useMemo } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  MessageSquareText,
  ScrollText,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { LearningTimeline, SubjectProgressBands, TodayOdyssey } from './StudentDashboardComponents';
import { normalizeStudentData, selectDueTasks } from './studentData';
import { selectTodayBattlePlan, type BattlePlanItem } from './studentBattlePlan';
import { selectDailyInsight } from './studentDailyInsight';
import { useStudentDashboardQuery } from './studentQueries';
import { daysUntil } from '../assignments/assignmentStatus';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission, StudentDashboardView, StudentProgress } from '../../types/lms';

export function StudentDashboardRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const nextAssignment = studentData ? selectDueTasks(studentData, 1)[0]?.assignment : undefined;
  const dailyInsight = useMemo(() => data && studentData ? selectDailyInsight(data, studentData) : null, [data, studentData]);
  const battlePlan = useMemo(() => data && studentData ? selectTodayBattlePlan(data, studentData) : [], [data, studentData]);

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
              />
            </div>
            <NextSessionCard data={data} />
          </section>

          <StudentBentoGrid data={data} battlePlan={battlePlan} />

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

function StudentBentoGrid({ data, battlePlan }: { data: StudentDashboardView; battlePlan: BattlePlanItem[] }) {
  const assignments = [...data.assignments]
    .filter((assignment) => assignment.status !== 'archived')
    .sort((left, right) => String(left.due_date || '9999').localeCompare(String(right.due_date || '9999')))
    .slice(0, 2);
  const suggestedPractice = assignments.length < 2 ? battlePlan.find((item) => item.kind !== 'assignment') : undefined;
  const latestFeedback = [...data.submissions]
    .filter((submission) => Boolean(submission.feedback))
    .sort((left, right) => String(right.released_at || right.submitted_at || '').localeCompare(String(left.released_at || left.submitted_at || '')))[0];
  const streakDays = data.dailyInsightContext?.streakDays || 0;
  const progressSummary = summarizeProgress(data.progress);

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
        ) : <CompactEmpty title="Nothing due" detail="Your visible assignment queue is clear." />}
        <Link className="mt-auto flex min-h-12 items-center justify-between border-t border-[#e7dfd1] pt-4 text-sm font-semibold text-academy-aegean dark:border-white/10 dark:text-academy-gold" to="/dashboard/student/assignments">
          View all assignments <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </article>

      <article className="student-bento-card xl:col-span-4">
        <EditorialHeading icon={TrendingUp} title="Your progress" />
        {progressSummary ? (
          <div className="mt-4 flex flex-1 flex-col">
            <div className="flex items-end justify-between gap-3">
              <p className="font-display text-xl font-semibold text-academy-navy dark:text-white">Mathematics</p>
              <p className="font-display text-4xl font-semibold text-academy-navy dark:text-white">{progressSummary.average}%</p>
            </div>
            <ProgressTrendChart points={progressSummary.points} />
            <p className="mt-2 text-sm text-academy-muted">{progressSummary.label} · Next focus: {progressSummary.weakestTopic}</p>
            <Link className="mt-auto flex min-h-12 items-center justify-between border-t border-[#e7dfd1] pt-4 text-sm font-semibold text-academy-aegean dark:border-white/10 dark:text-academy-gold" to="/dashboard/student/progress">
              View full progress <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : <CompactEmpty title="No progress yet" detail="Released marks will establish your learning baseline." />}
      </article>

      <div className="grid min-w-0 gap-5 xl:col-span-3">
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

function ProgressTrendChart({ points }: { points: number[] }) {
  const safePoints = points.length > 1 ? points : [points[0] || 0, points[0] || 0];
  const coordinates = safePoints.map((point, index) => {
    const x = 8 + (index / Math.max(1, safePoints.length - 1)) * 304;
    const y = 116 - (Math.max(0, Math.min(100, point)) / 100) * 98;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg aria-label={`Recent mathematics progress ending at ${Math.round(safePoints.at(-1) || 0)} percent`} className="mt-4 h-36 w-full" role="img" viewBox="0 0 320 132">
      {[18, 50, 82, 116].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth="1" />)}
      <polyline fill="none" points={coordinates} stroke="#1F6F8B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {safePoints.map((point, index) => {
        const [x, y] = coordinates.split(' ')[index].split(',');
        return <circle key={`${index}-${point}`} cx={x} cy={y} fill="#fffbf2" r={index === safePoints.length - 1 ? 5 : 3} stroke="#1F6F8B" strokeWidth="2" />;
      })}
    </svg>
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

function summarizeProgress(progress: StudentProgress[]) {
  const maths = progress.filter((item) => /math/i.test(item.subject || ''));
  const items = maths.length ? maths : progress;
  if (!items.length) return null;
  const chronological = [...items].sort((left, right) => String(left.recorded_at).localeCompare(String(right.recorded_at)));
  const points = chronological.slice(-8).map((item) => Number(item.score || 0));
  const average = Math.round(points.at(-1) ?? points.reduce((sum, point) => sum + point, 0) / points.length);
  const midpoint = Math.ceil(points.length / 2);
  const recent = points.slice(midpoint);
  const earlier = points.slice(0, midpoint);
  const recentAverage = recent.length ? recent.reduce((sum, point) => sum + point, 0) / recent.length : average;
  const earlierAverage = earlier.length ? earlier.reduce((sum, point) => sum + point, 0) / earlier.length : recentAverage;
  const delta = Math.round(recentAverage - earlierAverage);
  const weakestTopic = [...items].sort((left, right) => Number(left.score || 0) - Number(right.score || 0))[0]?.topic || 'Keep practising';
  return { average, points, label: points.length > 1 ? `${delta >= 0 ? '+' : ''}${delta}% recent trend` : 'Baseline', weakestTopic };
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
