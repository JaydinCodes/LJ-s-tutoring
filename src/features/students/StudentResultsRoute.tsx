import { Link, useParams } from 'react-router-dom';
import { BookOpen, Brain, Clock, Target, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { AnimatedProgressBar, ErrorState, PageShell, ProgressRing, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils/format';
import {
  cognitiveLevelOrder,
  type ClassDistributionBucket,
  type CognitiveLevelName,
  type StudentResultCognitiveLevel,
  type StudentResultItem,
  type StudentResultTopic,
} from './studentResultsRepository';
import { useStudentResultsQuery } from './studentQueries';

const chartPalette = ['#071b3a', '#0f8aa6', '#d6a84f', '#f5efe3'];

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? '--' : `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}%`;
}

function formatMark(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? '--' : Number(value).toFixed(Number.isInteger(value) ? 0 : 1);
}

function releasedResults(items: StudentResultItem[]) {
  return items.filter((item) => Number.isFinite(Number(item.percentage)));
}

function sortByDate(items: StudentResultItem[]) {
  return [...items].sort((left, right) => new Date(right.completedAt || right.markedAt || 0).getTime() - new Date(left.completedAt || left.markedAt || 0).getTime());
}

function getBestSubject(items: StudentResultItem[]) {
  const bySubject = groupBySubject(items);
  return [...bySubject.entries()]
    .map(([subject, subjectItems]) => ({ subject, average: average(subjectItems.map((item) => item.percentage)), count: subjectItems.length }))
    .filter((item) => item.average != null)
    .sort((left, right) => Number(right.average) - Number(left.average) || left.subject.localeCompare(right.subject))[0] || null;
}

function getWeakestTopic(items: StudentResultItem[]) {
  return items
    .flatMap((item) => item.topicBreakdown.map((topic) => ({ ...topic, subject: topic.subject || item.subject })))
    .filter((topic) => Number.isFinite(Number(topic.score)))
    .sort((left, right) => Number(left.score) - Number(right.score) || left.topic.localeCompare(right.topic))[0] || null;
}

function groupBySubject(items: StudentResultItem[]) {
  const bySubject = new Map<string, StudentResultItem[]>();
  for (const item of items) {
    bySubject.set(item.subject, [...(bySubject.get(item.subject) || []), item]);
  }
  return bySubject;
}

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.round((finite.reduce((total, value) => total + value, 0) / finite.length) * 10) / 10 : null;
}

function consistencyScore(items: StudentResultItem[]) {
  if (items.length < 2) return null;
  const scores = items.map((item) => item.percentage);
  const avg = average(scores);
  if (avg == null) return null;
  const variance = scores.reduce((total, score) => total + (score - avg) ** 2, 0) / scores.length;
  return Math.max(0, Math.round(100 - Math.sqrt(variance)));
}

function trendLabel(items: StudentResultItem[]) {
  const chronological = [...items].sort((left, right) => new Date(left.completedAt || left.markedAt || 0).getTime() - new Date(right.completedAt || right.markedAt || 0).getTime());
  if (chronological.length < 2) return 'Needs two marks';
  const first = chronological[0].percentage;
  const latest = chronological[chronological.length - 1].percentage;
  const delta = Math.round((latest - first) * 10) / 10;
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}

export function StudentResultsRoute() {
  const { data, loading, error, refetching, reload } = useStudentResultsQuery();
  const items = releasedResults(data?.items || []);
  const latest = sortByDate(items)[0] || null;
  const bestSubject = getBestSubject(items);
  const weakestTopic = getWeakestTopic(items);

  return (
    <PageShell
      title="Results"
      subtitle="A private learner insight screen for marks, movement, subjects, and the next topic to improve."
      section="student"
    >
      {loading ? <SkeletonCard /> : null}
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing results...</p> : null}
      {error ? <ErrorState title="Results unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <div className="space-y-6">
          <ResultsHero
            average={data.summary.averageAcrossAssessments}
            bestSubject={bestSubject}
            latest={latest}
            status={data.summary.currentAcademicStatus}
            totalResults={items.length}
          />
          <MarkTrend items={items} />
          <SubjectResultRows items={items} />
          <WeakTopicInsight topic={weakestTopic} />
        </div>
      ) : null}
    </PageShell>
  );
}

export function ResultsHero({
  average,
  bestSubject,
  latest,
  status,
  totalResults,
}: {
  average: number | null | undefined;
  bestSubject: { subject: string; average: number | null; count: number } | null;
  latest: StudentResultItem | null;
  status: string;
  totalResults: number;
}) {
  return (
    <section className="academy-major-surface relative overflow-hidden">
      <div className="absolute inset-x-6 top-0 h-px greek-keyline" aria-hidden="true" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Results insight</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            {formatPercent(average)} average
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">
            {status}. This view uses released learner results only and keeps class context anonymous.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ResultSignal label="Latest result" value={latest ? formatPercent(latest.percentage) : '--'} helper={latest ? `${latest.subject}: ${latest.title}` : 'Released marks will appear here.'} to={latest ? `/dashboard/student/results/${latest.id}` : undefined} />
            <ResultSignal label="Best subject" value={bestSubject?.subject || 'Pending'} helper={bestSubject ? `${formatPercent(bestSubject.average)} across ${bestSubject.count} result${bestSubject.count === 1 ? '' : 's'}.` : 'Needs one released result.'} to={bestSubject ? `/dashboard/student/results/subjects/${encodeURIComponent(bestSubject.subject)}` : undefined} />
            <ResultSignal label="Released marks" value={String(totalResults)} helper="Only marks available to this learner are counted." />
          </div>
        </div>
        <div className="mx-auto">
          <ProgressRing value={average} label="Main average score" />
        </div>
      </div>
    </section>
  );
}

function ResultSignal({ label, value, helper, to }: { label: string; value: string; helper: string; to?: string }) {
  const body = (
    <div className="min-h-28 rounded-ios-lg border border-white/15 bg-white/10 p-4 text-left shadow-academy-inset backdrop-blur-xl transition duration-fluid ease-ios hover:bg-white/[0.14]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-academy-parchment">{helper}</p>
    </div>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

export function MarkTrend({ items }: { items: StudentResultItem[] }) {
  return (
    <section aria-labelledby="mark-trend-title" className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Mark trend</p>
          <h2 id="mark-trend-title" className="mt-1 text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment">
            {trendLabel(items)}
          </h2>
        </div>
        <span className="academy-chip shrink-0">{items.length} result{items.length === 1 ? '' : 's'}</span>
      </div>
      <LearnerTrendChart items={items} />
    </section>
  );
}

export function SubjectResultRows({ items }: { items: StudentResultItem[] }) {
  const subjects = [...groupBySubject(items).entries()]
    .map(([subject, subjectItems]) => ({
      subject,
      items: subjectItems,
      average: average(subjectItems.map((item) => item.percentage)),
      latest: sortByDate(subjectItems)[0],
    }))
    .sort((left, right) => Number(right.average ?? 0) - Number(left.average ?? 0) || left.subject.localeCompare(right.subject));

  return (
    <section aria-labelledby="subject-results-title" className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Subject rows</p>
        <h2 id="subject-results-title" className="mt-1 text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment">
          Subject breakdown
        </h2>
      </div>
      <div className="divide-y divide-slate-950/5 rounded-ios-lg border border-white/70 bg-white/[0.48] px-4 shadow-academy-inset backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]">
        {!subjects.length ? (
          <div className="py-4">
            <EmptyState
              title="No subject summaries yet"
              description="Subject rows appear when released results are available."
              actionLabel="Open assignments"
              actionHref="/dashboard/student/assignments"
              icon={BookOpen}
            />
          </div>
        ) : null}
        {subjects.map((subject, index) => (
          <Link key={subject.subject} className="block py-4" to={`/dashboard/student/results/subjects/${encodeURIComponent(subject.subject)}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-academy-ink dark:text-academy-parchment">{subject.subject}</h3>
                <p className="mt-1 text-sm leading-6 text-academy-muted">
                  Latest: {subject.latest?.title || 'Pending'} • {subject.items.length} result{subject.items.length === 1 ? '' : 's'}
                </p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-academy-aegean dark:text-academy-gold">{formatPercent(subject.average)}</p>
            </div>
            <div className="mt-3">
              <AnimatedProgressBar value={subject.average || 0} color={chartPalette[index % chartPalette.length]} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function WeakTopicInsight({ topic }: { topic: (StudentResultTopic & { subject?: string }) | null }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.58] p-5 shadow-academy backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]" aria-labelledby="weak-topic-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-ios border border-academy-gold/20 bg-academy-gold/10 text-academy-ink dark:text-academy-gold">
          <Brain className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Weakest topic recommendation</p>
          <h2 id="weak-topic-title" className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">
            {topic ? `Practise ${topic.topic}` : 'No weak topic yet'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-academy-muted">
            {topic
              ? `${topic.subject || 'This subject'} is currently at ${formatPercent(topic.score)} for this topic. Start with one worked example, then one exam-style question.`
              : 'Topic-level recommendations appear when released results include topic breakdowns.'}
          </p>
        </div>
      </div>
      <Link className="academy-btn academy-btn-outline mt-4 w-full sm:w-auto" to="/dashboard/student/progress">
        Open progress
      </Link>
    </section>
  );
}

export function StudentResultDetailRoute() {
  const { resultId } = useParams();
  const { data, loading, error, reload } = useStudentResultsQuery();
  const result = releasedResults(data?.items || []).find((item) => item.id === resultId) || null;

  return (
    <PageShell title="Result Detail" subtitle="Full private mark breakdown and practice guidance for one released result." section="student">
      <BackToResults />
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Result unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data && !result ? (
        <Card>
          <EmptyState
            title="Result not found"
            description="This result is not available for the signed-in learner. Return to your private results overview to choose another released mark."
            actionLabel="Back to results"
            actionHref="/dashboard/student/results"
            icon={Trophy}
          />
        </Card>
      ) : null}
      {result ? <ResultDetail result={result} /> : null}
    </PageShell>
  );
}

export function StudentResultsSubjectRoute() {
  const { subject } = useParams();
  const decodedSubject = decodeURIComponent(subject || '');
  const { data, loading, error, reload } = useStudentResultsQuery();
  const items = releasedResults(data?.items || []).filter((item) => item.subject === decodedSubject);

  return (
    <PageShell title={`${decodedSubject || 'Subject'} Results`} subtitle="All released results for this subject, shown only for the signed-in learner." section="student">
      <BackToResults />
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Subject results unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">Subject archive</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{decodedSubject}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">{items.length} released result{items.length === 1 ? '' : 's'} for this subject.</p>
            </div>
            <ProgressRing value={average(items.map((item) => item.percentage))} label="Subject average" />
          </div>
          <ResultList items={items} emptyTitle="No released results for this subject" />
        </Card>
      ) : null}
    </PageShell>
  );
}

function PremiumResultMetric({
  label,
  value,
  explanation,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string;
  explanation: string;
  icon: LucideIcon;
  tone: 'navy' | 'aegean' | 'gold' | 'marble';
  to?: string;
}) {
  const toneClass = {
    navy: 'border-white/65 bg-brand-navy text-white shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/[0.08]',
    aegean: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
    gold: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
    marble: 'border-white/70 bg-white/76 text-brand-obsidian shadow-[0_18px_45px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
  }[tone];
  const accentClass = {
    navy: 'text-brand-gold bg-white/10 border-white/10',
    aegean: 'text-brand-aegean bg-brand-aegean/[0.07] border-brand-aegean/10',
    gold: 'text-[#9a6a05] bg-brand-gold/[0.12] border-brand-gold/20',
    marble: 'text-slate-500 bg-slate-950/[0.04] border-slate-950/[0.06] dark:text-brand-marble dark:bg-white/[0.06]',
  }[tone];
  const content = (
    <article className={`h-full rounded-[1.6rem] border p-5 backdrop-blur-2xl transition hover:-translate-y-0.5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">{label}</p>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[1.15rem] border ${accentClass}`}>
          <Icon className="h-5 w-5 text-current" aria-hidden="true" strokeWidth={2} />
        </span>
      </div>
      <h3 className="mt-3 text-3xl font-semibold tracking-tight">{value}</h3>
      <p className="mt-3 text-sm leading-6 opacity-80">{explanation}</p>
    </article>
  );

  return <StaggerItem>{to ? <Link to={to}>{content}</Link> : content}</StaggerItem>;
}

function LearnerTrendChart({ items }: { items: StudentResultItem[] }) {
  const chronological = [...items].sort((left, right) => new Date(left.completedAt || left.markedAt || 0).getTime() - new Date(right.completedAt || right.markedAt || 0).getTime());
  if (!chronological.length) {
    return (
      <EmptyState
        title="No released marks yet"
        description="Your trend chart appears after your first released result. Until then, use progress to choose what to practise."
        actionLabel="Open progress"
        actionHref="/dashboard/student/progress"
        icon={TrendingUp}
      />
    );
  }
  if (chronological.length === 1) {
    return (
      <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/62 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
        <p className="text-sm font-semibold text-brand-obsidian">First mark recorded: {formatPercent(chronological[0].percentage)}</p>
        <p className="mt-2 text-sm text-slate-600">A trend line needs at least two released marks.</p>
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = 24;
  const coords = chronological.map((item, index) => {
    const x = pad + (index / Math.max(1, chronological.length - 1)) * (width - pad * 2);
    const y = height - pad - (item.percentage / 100) * (height - pad * 2);
    return { ...item, x, y };
  });

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-brand-navy via-brand-deepBlue to-brand-aegean p-4 text-brand-parchment">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Learner mark movement over time">
        <polyline fill="none" stroke="#d6a84f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={coords.map((point) => `${point.x},${point.y}`).join(' ')} />
        {coords.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="5" fill="#f5efe3" />)}
      </svg>
      <div className="flex justify-between gap-3 text-xs">
        <span>{formatDate(chronological[0].completedAt || chronological[0].markedAt)}</span>
        <span>{formatDate(chronological[chronological.length - 1].completedAt || chronological[chronological.length - 1].markedAt)}</span>
      </div>
    </div>
  );
}

function ClassAnalyticsSummary({ data, buckets }: { data: { available: boolean; privacyThreshold: number; overview: { classAverage: number | null; numberOfLearners: number } | null; positioning: string }; buckets: ClassDistributionBucket[] }) {
  if (!data.available || !data.overview) {
    return (
      <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4 text-sm leading-6 text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-marble">
        Anonymous class analytics are hidden until at least {data.privacyThreshold} learners are represented.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniMetric label="Class average" value={formatPercent(data.overview.classAverage)} />
        <MiniMetric label="Learners" value={String(data.overview.numberOfLearners)} />
      </div>
      <DistributionBars buckets={buckets} />
      <p className="rounded-2xl border border-white/70 bg-white/62 px-4 py-3 text-sm font-semibold text-brand-obsidian backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment">{data.positioning}</p>
    </div>
  );
}

function DistributionBars({ buckets }: { buckets: ClassDistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="flex h-32 items-end gap-2 rounded-2xl border border-white/70 bg-white/55 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      {buckets.map((bucket) => (
        <div key={bucket.range} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full items-end">
            <div className={`w-full rounded-t-md ${bucket.isLearnerBucket ? 'bg-brand-gold' : 'bg-brand-aegean/30'}`} style={{ height: `${Math.max(8, (bucket.count / max) * 100)}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-slate-600">{bucket.range}</span>
        </div>
      ))}
    </div>
  );
}

function SubjectSummaryGrid({ items }: { items: StudentResultItem[] }) {
  const bySubject = groupBySubject(items);
  const subjects = [...bySubject.entries()];
  if (!subjects.length) {
    return (
      <EmptyState
        title="No subject summaries yet"
        description="Subject cards appear when released results are available, giving you a clean view of strengths by subject."
        actionLabel="Open assignments"
        actionHref="/dashboard/student/assignments"
        icon={BookOpen}
      />
    );
  }

  return (
    <StaggerGrid className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {subjects.map(([subject, subjectItems], index) => {
        const subjectAverage = average(subjectItems.map((item) => item.percentage));
        return (
          <StaggerItem key={subject}>
            <Link className="block rounded-[1.5rem] border border-white/70 bg-white/68 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-brand-gold/50 dark:border-white/10 dark:bg-white/[0.05]" to={`/dashboard/student/results/subjects/${encodeURIComponent(subject)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">{subject}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatPercent(subjectAverage)}</p>
              <div className="mt-3"><AnimatedProgressBar value={subjectAverage || 0} color={chartPalette[index % chartPalette.length]} /></div>
              <p className="mt-3 text-sm text-slate-600 dark:text-brand-marble">{subjectItems.length} released result{subjectItems.length === 1 ? '' : 's'}</p>
            </Link>
          </StaggerItem>
        );
      })}
    </StaggerGrid>
  );
}

function ResultDetail({ result }: { result: StudentResultItem }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">Released result</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-100">{result.title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-brand-marble">{result.subject} - {formatDate(result.completedAt || result.markedAt)}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Mark" value={`${formatMark(result.score)} / ${formatMark(result.total)}`} />
          <MiniMetric label="Percentage" value={formatPercent(result.percentage)} />
          <MiniMetric label="Band" value={result.levelBand || 'Pending'} />
        </div>
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Topic Breakdown</h2>
          <TopicBreakdown topics={result.topicBreakdown} />
        </section>
      </Card>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Cognitive Level Breakdown</h2>
          <CognitiveBreakdown levels={result.cognitiveBreakdown} />
        </Card>
        <Card>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Practice Recommendation</h2>
          <PracticeRecommendation levels={result.cognitiveBreakdown} fallbackSteps={result.recommendedNextSteps} />
        </Card>
      </aside>

      <Card>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Feedback</h2>
        <p className="mt-3 rounded-2xl border border-white/70 bg-white/58 p-4 text-sm leading-7 text-slate-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-marble">{result.feedbackSummary || 'No written feedback supplied.'}</p>
      </Card>
    </div>
  );
}

function CognitiveBreakdown({ levels }: { levels: StudentResultCognitiveLevel[] }) {
  const byLevel = new Map(levels.map((item) => [item.level, item]));
  if (!levels.length) {
    return (
      <EmptyState
        title="No cognitive data yet"
        description="Older results may not include CAPS cognitive-level marks. Use the practice recommendation and topic feedback that is available."
        actionLabel="Back to overview"
        actionHref="/dashboard/student/results"
        icon={Brain}
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {cognitiveLevelOrder.map((level) => {
        const item = byLevel.get(level);
        const score = item?.score ?? null;
        const weak = score != null && score < 50;
        return (
          <div key={level} className={`rounded-2xl border p-3 backdrop-blur-xl ${weak ? 'border-amber-200/80 bg-amber-50/75 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100' : 'border-white/70 bg-white/58 dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-parchment'}`}>
            <div className="flex justify-between gap-3 text-sm font-semibold">
              <span>{level}</span>
              <span>{formatPercent(score)}</span>
            </div>
            <div className="mt-2"><AnimatedProgressBar value={score || 0} color={weak ? '#d97706' : '#0f8aa6'} /></div>
          </div>
        );
      })}
    </div>
  );
}

function PracticeRecommendation({ levels, fallbackSteps }: { levels: StudentResultCognitiveLevel[]; fallbackSteps: string[] }) {
  const weak = [...levels].filter((item) => item.score != null && item.score < 50).sort((left, right) => Number(left.score) - Number(right.score))[0];
  if (weak) {
    return (
      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-brand-marble">
        Practice more {questionTypeForLevel(weak.level)} questions first. This targets {weak.level}, currently at {formatPercent(weak.score)}.
      </p>
    );
  }
  if (fallbackSteps.length) {
    return <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600 dark:text-brand-marble">{fallbackSteps.map((step) => <li key={step}>{step}</li>)}</ul>;
  }
  return <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-brand-marble">Keep a balanced revision mix: definitions, routine drills, multi-step questions, and one problem-solving question.</p>;
}

function questionTypeForLevel(level: CognitiveLevelName) {
  const map: Record<CognitiveLevelName, string> = {
    Knowledge: 'definition, fact recall, and formula recognition',
    'Routine Procedure': 'standard method and substitution',
    'Complex Procedure': 'multi-step application',
    'Problem Solving': 'unfamiliar, exam-style problem-solving',
  };
  return map[level] || 'targeted practice';
}

function TopicBreakdown({ topics }: { topics: StudentResultTopic[] }) {
  if (!topics.length) {
    return (
      <EmptyState
        title="No topic breakdown"
        description="This result only has the overall mark. Future released results can show topic-level focus areas."
        actionLabel="Open progress"
        actionHref="/dashboard/student/progress"
        icon={Target}
      />
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {topics.map((topic, index) => (
        <div key={`${topic.subject}-${topic.topic}`} className="rounded-2xl border border-white/70 bg-white/58 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex justify-between gap-3 text-sm font-semibold text-brand-obsidian dark:text-brand-parchment">
            <span>{topic.topic}</span>
            <span>{formatPercent(topic.score)}</span>
          </div>
          <div className="mt-2"><AnimatedProgressBar value={topic.score} color={chartPalette[index % chartPalette.length]} /></div>
        </div>
      ))}
    </div>
  );
}

function ResultList({ items, emptyTitle }: { items: StudentResultItem[]; emptyTitle: string }) {
  if (!items.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Released results will appear here once available, with each mark linking to its full breakdown."
        actionLabel="Back to overview"
        actionHref="/dashboard/student/results"
        icon={Trophy}
      />
    );
  }
  return (
    <div className="mt-5 space-y-3">
      {sortByDate(items).map((item) => (
        <Link key={item.id} className="block rounded-[1.5rem] border border-white/70 bg-white/68 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition hover:border-brand-gold/50 dark:border-white/10 dark:bg-white/[0.05]" to={`/dashboard/student/results/${item.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950 dark:text-slate-100">{item.title}</p>
              <p className="text-sm text-slate-600 dark:text-brand-marble">{formatDate(item.completedAt || item.markedAt)}</p>
            </div>
            <p className="text-xl font-semibold text-brand-aegean dark:text-brand-gold">{formatPercent(item.percentage)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/58 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function BackToResults() {
  return (
    <div className="mb-4">
      <Link className="text-sm font-semibold text-brand-aegean hover:text-brand-gold dark:text-brand-gold" to="/dashboard/student/results">
        Back to results overview
      </Link>
    </div>
  );
}
