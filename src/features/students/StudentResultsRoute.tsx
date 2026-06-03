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
  const consistency = consistencyScore(items);

  return (
    <PageShell
      title="Results Overview"
      subtitle="A private summary of released marks, trends, strengths, and anonymous class context."
      section="student"
    >
      {loading ? <SkeletonCard /> : null}
      {refetching ? <Card>Refreshing results overview...</Card> : null}
      {error ? <ErrorState title="Results unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <div className="space-y-5">
          <Card>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-aegean dark:text-brand-gold">Results oracle</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-obsidian dark:text-brand-parchment">Your mark movement, simplified</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-brand-marble">
                  This overview uses released learner results only. Class analytics stay anonymous and are hidden until the privacy threshold is met.
                </p>
              </div>
              <ProgressRing value={data.summary.overallPercentage} label="Overall average" />
            </div>
          </Card>

          <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PremiumResultMetric label="Overall Average" value={formatPercent(data.summary.averageAcrossAssessments)} explanation="Mean percentage across released results." icon={Trophy} tone="navy" />
            <PremiumResultMetric label="Best Subject" value={bestSubject ? bestSubject.subject : 'Pending'} explanation={bestSubject ? `${formatPercent(bestSubject.average)} across ${bestSubject.count} result${bestSubject.count === 1 ? '' : 's'}.` : 'Appears once at least one subject has a released mark.'} icon={BookOpen} tone="aegean" to={bestSubject ? `/dashboard/student/results/subjects/${encodeURIComponent(bestSubject.subject)}` : undefined} />
            <PremiumResultMetric label="Weakest Topic" value={weakestTopic?.topic || 'Pending'} explanation={weakestTopic ? `${formatPercent(weakestTopic.score)}. Use this as your next practice target.` : 'Topic-level data appears when released results include topic breakdowns.'} icon={Brain} tone="gold" />
            <PremiumResultMetric label="Latest Mark" value={latest ? formatPercent(latest.percentage) : '--'} explanation={latest ? `${latest.subject}: ${latest.title}.` : 'Latest released result appears here.'} icon={Clock} tone="marble" to={latest ? `/dashboard/student/results/${latest.id}` : undefined} />
            <PremiumResultMetric label="Mark Trend" value={trendLabel(items)} explanation={items.length < 2 ? 'Needs at least two released marks to show movement.' : 'Change from earliest released result to latest released result.'} icon={TrendingUp} tone="navy" />
            <PremiumResultMetric label="Consistency Score" value={consistency == null ? '--' : `${consistency}/100`} explanation={consistency == null ? 'Needs at least two results.' : 'Higher means marks are steadier across assessments.'} icon={Target} tone="aegean" />
          </StaggerGrid>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Mark Trend</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Movement over time from your released results only.</p>
                </div>
                <span className="rounded-full bg-brand-parchment px-3 py-1 text-xs font-semibold text-brand-obsidian">{items.length} result{items.length === 1 ? '' : 's'}</span>
              </div>
              <LearnerTrendChart items={items} />
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Anonymous Class Context</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">No classmate names or individual marks are shown.</p>
              <ClassAnalyticsSummary data={data.classAnalytics} buckets={data.classAnalytics.distribution} />
            </Card>
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Subjects</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Open a subject to see all released results for that subject.</p>
              </div>
            </div>
            <SubjectSummaryGrid items={items} />
          </Card>
        </div>
      ) : null}
    </PageShell>
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
    navy: 'border-brand-navy bg-brand-navy text-white',
    aegean: 'border-brand-aegean/40 bg-brand-aegean/10 text-brand-obsidian dark:text-brand-parchment',
    gold: 'border-brand-gold/60 bg-brand-gold/15 text-brand-obsidian dark:text-brand-parchment',
    marble: 'border-brand-marble bg-white text-brand-obsidian dark:bg-brand-obsidian dark:text-brand-parchment',
  }[tone];
  const content = (
    <article className={`h-full rounded-[1.6rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">{label}</p>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-current/10 bg-white/30 text-current shadow-sm dark:bg-white/5">
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
      <div className="mt-5 rounded-[1.5rem] border border-brand-marble bg-brand-parchment/60 p-5">
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
      <div className="mt-4 rounded-2xl border border-dashed border-brand-marble p-4 text-sm leading-6 text-slate-600 dark:text-brand-marble">
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
      <p className="rounded-2xl bg-brand-parchment px-4 py-3 text-sm font-semibold text-brand-obsidian">{data.positioning}</p>
    </div>
  );
}

function DistributionBars({ buckets }: { buckets: ClassDistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="flex h-32 items-end gap-2 rounded-2xl bg-brand-parchment/60 p-3">
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
            <Link className="block rounded-[1.5rem] border border-brand-marble bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-lg dark:bg-brand-obsidian" to={`/dashboard/student/results/subjects/${encodeURIComponent(subject)}`}>
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
        <p className="mt-3 rounded-2xl bg-brand-parchment/70 p-4 text-sm leading-7 text-slate-700 dark:bg-brand-navy/70 dark:text-brand-marble">{result.feedbackSummary || 'No written feedback supplied.'}</p>
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
          <div key={level} className={`rounded-2xl border p-3 ${weak ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-brand-marble bg-white dark:bg-brand-obsidian'}`}>
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
        <div key={`${topic.subject}-${topic.topic}`} className="rounded-2xl bg-brand-parchment/60 p-3">
          <div className="flex justify-between gap-3 text-sm font-semibold text-brand-obsidian">
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
        <Link key={item.id} className="block rounded-[1.5rem] border border-brand-marble bg-white p-4 transition hover:border-brand-gold hover:shadow-lg dark:bg-brand-obsidian" to={`/dashboard/student/results/${item.id}`}>
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
    <div className="rounded-2xl bg-brand-parchment/70 p-3 dark:bg-brand-navy/60">
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
