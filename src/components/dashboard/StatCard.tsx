import type { DashboardMetric } from '../../types/lms';

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const accent = {
    teal: 'border-teal-200 bg-teal-50',
    violet: 'border-violet-200 bg-violet-50',
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-sky-200 bg-sky-50',
    slate: 'border-slate-200 bg-slate-50',
  }[metric.tone];

  return (
    <article className={`rounded-lg border p-5 ${accent}`}>
      <p className="text-sm font-medium text-slate-600">{metric.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p>
    </article>
  );
}
