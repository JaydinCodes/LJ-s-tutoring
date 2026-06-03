import { useMemo, useState } from 'react';
import { BookOpen, Brain, CalendarDays, Layers3, TrendingUp } from 'lucide-react';
import { AnimatedProgressBar, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils/format';
import type { StudentProgress } from '../../types/lms';
import { useStudentDashboardQuery } from './studentQueries';

const allSubjects = 'All';

export function StudentProgressRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const [activeSubject, setActiveSubject] = useState(allSubjects);
  const subjects = useMemo(() => getProgressSubjects(data?.progress || []), [data?.progress]);
  const rows = useMemo(() => filterProgressBySubject(data?.progress || [], activeSubject), [data?.progress, activeSubject]);
  const summary = useMemo(() => getProgressSummary(data?.progress || []), [data?.progress]);

  return (
    <PageShell
      title="Progress"
      subtitle="Topic mastery, cognitive level, and recorded learning signals in one clean list."
      section="student"
    >
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing progress...</p> : null}
      {loading ? <ProgressSkeleton /> : null}
      {error ? (
        <ErrorState title="Progress unavailable" description={error} onRetry={() => void reload()} />
      ) : null}
      {data ? (
        <section className="space-y-5" aria-labelledby="progress-title">
          <ProgressHeader summary={summary} />
          <SubjectFilterChips
            activeSubject={activeSubject}
            subjects={subjects}
            onChange={setActiveSubject}
          />
          <TopicProgressList progress={rows} />
        </section>
      ) : null}
    </PageShell>
  );
}

function ProgressHeader({ summary }: { summary: { average: number | null; topicCount: number; weakestTopic?: string } }) {
  return (
    <section className="academy-major-surface relative overflow-hidden">
      <div className="absolute inset-x-6 top-0 h-px greek-keyline" aria-hidden="true" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Topic progress</p>
          <h2 id="progress-title" className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            {summary.average == null ? 'Progress is starting' : `${summary.average}% mastery`}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">
            {summary.weakestTopic
              ? `Start with ${summary.weakestTopic}. It is the clearest topic to strengthen next.`
              : 'Progress rows appear when marks, quizzes, or tutor updates create topic records.'}
          </p>
        </div>
        <div className="rounded-ios-lg border border-white/15 bg-white/10 p-4 shadow-academy-inset backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-gold">Recorded topics</p>
          <p className="mt-2 text-4xl font-semibold text-white">{summary.topicCount}</p>
          <p className="mt-2 text-sm leading-6 text-academy-parchment">Topic signals currently available</p>
        </div>
      </div>
    </section>
  );
}

export function SubjectFilterChips({
  activeSubject,
  subjects,
  onChange,
}: {
  activeSubject: string;
  subjects: string[];
  onChange: (subject: string) => void;
}) {
  return (
    <section aria-label="Filter progress by subject" className="flex gap-2 overflow-x-auto pb-1">
      {[allSubjects, ...subjects].map((subject) => {
        const active = subject === activeSubject;
        return (
          <button
            key={subject}
            className="academy-chip shrink-0"
            data-active={active}
            type="button"
            onClick={() => onChange(subject)}
          >
            <span className={active ? 'text-academy-aegean dark:text-academy-gold' : undefined}>{subject}</span>
          </button>
        );
      })}
    </section>
  );
}

export function TopicProgressList({ progress }: { progress: StudentProgress[] }) {
  if (!progress.length) {
    return (
      <EmptyState
        title="No topic mastery yet"
        description="Progress appears after marks, quizzes, or tutor updates. Start with your next assignment so the portal has real learning signals."
        actionLabel="Open assignments"
        actionHref="/dashboard/student/assignments"
        icon={Brain}
      />
    );
  }

  return (
    <section className="divide-y divide-slate-950/5 rounded-ios-lg border border-white/70 bg-white/[0.48] px-4 shadow-academy-inset backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]" aria-label="Topic progress list">
      {progress.map((item) => (
        <TopicProgressRow key={item.id} progress={item} />
      ))}
    </section>
  );
}

export function TopicProgressRow({ progress }: { progress: StudentProgress }) {
  const subject = progress.subject || progress.subject_id || 'General study';
  const score = Number(progress.score || 0);
  const color = score >= 75 ? '#1F6F8B' : score >= 55 ? '#f4c518' : '#d97706';

  return (
    <article className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ios bg-slate-950/[0.04] text-academy-aegean dark:bg-white/[0.06] dark:text-academy-gold">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-academy-ink dark:text-academy-parchment">{progress.topic}</h3>
              <p className="mt-1 text-sm text-academy-muted">{subject}</p>
            </div>
          </div>
        </div>
        <p className="shrink-0 text-lg font-semibold text-academy-aegean dark:text-academy-gold">{score}%</p>
      </div>

      <div className="mt-3">
        <AnimatedProgressBar value={score} color={color} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-academy-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/[0.04] px-3 py-1 dark:bg-white/[0.06]">
          <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
          {progress.cognitive_level || 'Cognitive level pending'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/[0.04] px-3 py-1 dark:bg-white/[0.06]">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDate(progress.recorded_at)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/[0.04] px-3 py-1 dark:bg-white/[0.06]">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          {getMasteryLabel(score)}
        </span>
      </div>
    </article>
  );
}

function getProgressSubjects(progress: StudentProgress[]) {
  return [...new Set(progress.map((item) => item.subject || item.subject_id || 'General study'))]
    .sort((left, right) => left.localeCompare(right));
}

function filterProgressBySubject(progress: StudentProgress[], subject: string) {
  const rows = subject === allSubjects
    ? progress
    : progress.filter((item) => (item.subject || item.subject_id || 'General study') === subject);

  return [...rows].sort((left, right) => Number(left.score || 0) - Number(right.score || 0) || left.topic.localeCompare(right.topic));
}

function getProgressSummary(progress: StudentProgress[]) {
  const scores = progress.map((item) => Number(item.score)).filter(Number.isFinite);
  const average = scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null;
  const weakestTopic = [...progress]
    .filter((item) => Number.isFinite(Number(item.score)))
    .sort((left, right) => Number(left.score || 0) - Number(right.score || 0) || left.topic.localeCompare(right.topic))[0]?.topic;

  return {
    average,
    topicCount: progress.length,
    weakestTopic,
  };
}

function getMasteryLabel(score: number) {
  if (score >= 80) return 'Strong mastery';
  if (score >= 65) return 'Building confidence';
  if (score >= 50) return 'Needs practice';
  return 'Priority topic';
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonCard className="h-56" />
      <SkeletonCard className="h-14" />
      {[0, 1, 2].map((item) => <SkeletonCard key={item} className="h-28" />)}
    </div>
  );
}
