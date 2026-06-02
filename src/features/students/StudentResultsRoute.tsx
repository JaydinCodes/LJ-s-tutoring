import { useMemo, useState } from 'react';
import { AnimatedProgressBar, ErrorState, InsightCard, MetricCard, PageShell, ProgressRing, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils/format';
import {
  type ClassDistributionBucket,
  type StudentResultItem,
  type StudentResultTopic,
  type SubjectBreakdownItem,
} from './studentResultsRepository';
import { normalizeStudentResults, selectResults, selectResultSubjects } from './studentData';
import { useStudentResultsQuery } from './studentQueries';

type SortKey = 'date' | 'percentage' | 'subject';

const chartPalette = ['#0f766e', '#7c3aed', '#d97706', '#2563eb', '#be123c', '#4f46e5'];

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? '--' : `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}%`;
}

function formatMark(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? '--' : Number(value).toFixed(Number.isInteger(value) ? 0 : 1);
}

function clampPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

export function StudentResultsRoute() {
  const { data, loading, error, refetching, reload } = useStudentResultsQuery();
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [query, setQuery] = useState('');

  const normalizedResults = useMemo(() => normalizeStudentResults(data?.items || []), [data?.items]);
  const subjects = useMemo(() => selectResultSubjects(normalizedResults), [normalizedResults]);
  const filteredItems = useMemo(
    () => selectResults(normalizedResults, { query, sort: sortKey, subject: subjectFilter }),
    [normalizedResults, query, sortKey, subjectFilter],
  );

  return (
    <PageShell
      title="Results"
      subtitle="Private academic analytics for your marks, trends, strengths, and anonymous class context."
      section="student"
    >
      {loading ? <SkeletonCard /> : null}
      {refetching ? <Card>Refreshing results dashboard...</Card> : null}
      {error ? <ErrorState title="Results unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <>
          <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Overall Score" value={formatPercent(data.summary.overallPercentage)} helper={`${formatMark(data.summary.totalMarksObtained)} / ${formatMark(data.summary.totalMarksAvailable)} total marks`} tone="teal" />
            <KpiCard label="Assessment Average" value={formatPercent(data.summary.averageAcrossAssessments)} helper={`${data.items.length} completed assessment${data.items.length === 1 ? '' : 's'}`} tone="violet" />
            <KpiCard label="Class Average" value={formatPercent(data.summary.classAverage)} helper={data.summary.differenceFromClassAverage == null ? 'Anonymous aggregate only' : `${data.summary.differenceFromClassAverage >= 0 ? '+' : ''}${formatPercent(data.summary.differenceFromClassAverage)} difference`} tone="amber" />
            <KpiCard label="Academic Status" value={data.summary.currentAcademicStatus} helper={data.classAnalytics.positioning} tone="blue" />
          </StaggerGrid>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Subject breakdown</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Performance grouped by subject, calculated from your own released results.</p>
                </div>
                <ProgressRing value={data.summary.overallPercentage} label="Overall score" />
              </div>
              <StaggerGrid className="mt-5 grid gap-3 md:grid-cols-2">
                {data.subjectBreakdown.map((item, index) => <StaggerItem key={item.subject}><SubjectCard item={item} color={chartPalette[index % chartPalette.length]} /></StaggerItem>)}
                {!data.subjectBreakdown.length ? <EmptyState title="No subject data yet" description="Subject performance appears after marked results are released." /> : null}
              </StaggerGrid>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Strengths and focus areas</h2>
              <div className="mt-5 grid gap-4">
                <InsightList title="Strong Areas" items={data.strengths.topics.length ? data.strengths.topics : data.strengths.subjects.map(subjectAsTopic)} empty="Strong topics will appear after more results." tone="strong" />
                <InsightList title="Needs Improvement" items={data.improvementAreas.topics.length ? data.improvementAreas.topics : data.improvementAreas.subjects.map(subjectAsTopic)} empty="Improvement areas will appear after more results." tone="focus" />
              </div>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Anonymous class overview</h2>
              {data.classAnalytics.available && data.classAnalytics.overview ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MiniMetric label="Class Average" value={formatPercent(data.classAnalytics.overview.classAverage)} />
                    <MiniMetric label="Highest Score" value={formatPercent(data.classAnalytics.overview.highestScore)} />
                    <MiniMetric label="Lowest Score" value={formatPercent(data.classAnalytics.overview.lowestScore)} />
                    <MiniMetric label="Pass Rate" value={formatPercent(data.classAnalytics.overview.passRate)} />
                    <MiniMetric label="Learners" value={String(data.classAnalytics.overview.numberOfLearners)} />
                    <MiniMetric label="Assessments" value={String(data.classAnalytics.overview.assessmentCount)} />
                  </div>
                  <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-100">{data.classAnalytics.positioning}</p>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Anonymous class analytics are hidden until at least {data.classAnalytics.privacyThreshold} learners are represented.
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Mark distribution</h2>
              <DistributionChart buckets={data.classAnalytics.distribution} />
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Class trend</h2>
              <LineChart points={data.classAnalytics.trends.map((point) => ({ label: formatDate(point.period), value: point.average ?? 0 }))} empty="Class trends will appear once aggregate history is available." />
            </Card>
            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Subject-wide trends</h2>
              <HorizontalBars items={data.classAnalytics.subjectTrends.map((item) => ({ label: item.subject, value: item.average ?? 0, helper: `${item.assessments} assessments` }))} empty="Subject-wide anonymous trends are not available yet." />
            </Card>
          </section>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Assessment history</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Only your own assessments, marks, and feedback are shown here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input className="h-10 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter feedback" />
                <select className="h-10 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
                  {subjects.map((subject) => <option key={subject} value={subject}>{subject === 'all' ? 'All subjects' : subject}</option>)}
                </select>
                <select className="h-10 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  <option value="date">Newest first</option>
                  <option value="percentage">Highest mark</option>
                  <option value="subject">Subject</option>
                </select>
              </div>
            </div>
            <AssessmentTable items={filteredItems} />
          </Card>
        </>
      ) : null}
    </PageShell>
  );
}

function KpiCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: 'teal' | 'violet' | 'amber' | 'blue' }) {
  const metricTone = ({
    teal: 'aegean',
    violet: 'navy',
    amber: 'gold',
    blue: 'marble',
  } as const)[tone];
  return <StaggerItem><MetricCard label={label} value={value} helper={helper} tone={metricTone} /></StaggerItem>;
}
function SubjectCard({ item, color }: { item: SubjectBreakdownItem; color: string }) {
  return (
    <InsightCard title={item.subject}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatPercent(item.score)}</p>
      </div>
      <div className="mt-3"><AnimatedProgressBar value={item.score} color={color} /></div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{item.assessments} assessment{item.assessments === 1 ? '' : 's'} - {formatMark(item.marksObtained)} / {formatMark(item.marksAvailable)} marks</p>
    </InsightCard>
  );
}

function subjectAsTopic(item: SubjectBreakdownItem): StudentResultTopic {
  return { topic: item.subject, subject: 'Subject', score: item.score ?? 0 };
}

function InsightList({ title, items, empty, tone }: { title: string; items: StudentResultTopic[]; empty: string; tone: 'strong' | 'focus' }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={`${item.subject}-${item.topic}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.topic}</span>
              {item.subject ? <span className="text-xs text-slate-500 dark:text-slate-400">{item.subject}</span> : null}
            </span>
            <span className={`text-sm font-semibold ${tone === 'strong' ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>{formatPercent(item.score)}</span>
          </div>
        ))}
        {!items.length ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{empty}</p> : null}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function DistributionChart({ buckets }: { buckets: ClassDistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="mt-5 flex h-64 items-end gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
      {buckets.map((bucket) => (
        <div key={bucket.range} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-44 w-full items-end">
            <div
              className={`w-full rounded-t-md ${bucket.isLearnerBucket ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              style={{ height: `${Math.max(8, (bucket.count / max) * 100)}%` }}
              title={`${bucket.range}: ${bucket.count}`}
            />
          </div>
          <span className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">{bucket.range}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points, empty }: { points: Array<{ label: string; value: number }>; empty: string }) {
  if (points.length < 2) return <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{empty}</p>;
  const width = 640;
  const height = 220;
  const pad = 24;
  const max = Math.max(100, ...points.map((point) => point.value));
  const min = Math.min(0, ...points.map((point) => point.value));
  const coords = points.map((point, index) => {
    const x = pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.value - min) / Math.max(1, max - min)) * (height - pad * 2);
    return { ...point, x, y };
  });
  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Class average trend">
        <polyline fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={coords.map((point) => `${point.x},${point.y}`).join(' ')} />
        {coords.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="5" fill="#7c3aed" />)}
      </svg>
      <div className="flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function HorizontalBars({ items, empty }: { items: Array<{ label: string; value: number; helper: string }>; empty: string }) {
  if (!items.length) return <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{empty}</p>;
  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
            <span className="text-slate-600 dark:text-slate-300">{formatPercent(item.value)} - {item.helper}</span>
          </div>
          <div className="mt-2"><AnimatedProgressBar value={clampPercent(item.value)} color={chartPalette[index % chartPalette.length]} /></div>
        </div>
      ))}
    </div>
  );
}

function AssessmentTable({ items }: { items: StudentResultItem[] }) {
  if (!items.length) return <div className="mt-5"><EmptyState title="No results match" description="Try changing the filter or wait for marked assessments to be released." /></div>;
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Mark</th>
              <th className="px-4 py-3">Percentage</th>
              <th className="px-4 py-3">Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-100">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.subject}</p>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(item.completedAt || item.markedAt || item.submittedAt)}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatMark(item.score)} / {formatMark(item.total)}</td>
                <td className="px-4 py-3 font-semibold text-teal-700 dark:text-teal-300">{formatPercent(item.percentage)}</td>
                <td className="max-w-md px-4 py-3 text-slate-700 dark:text-slate-300">{item.feedbackSummary || 'No written feedback supplied.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
