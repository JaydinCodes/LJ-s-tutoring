import type { DashboardMetric } from '../../types/lms';

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const accent = {
    teal: 'border-teal-100 bg-teal-50',
    violet: 'border-blue-100 bg-blue-50',
    amber: 'border-amber-100 bg-amber-50',
    blue: 'border-sky-100 bg-sky-50',
    slate: 'border-slate-100 bg-slate-50',
  }[metric.tone];

  return (
    <article className={`rounded-[1.5rem] border p-5 shadow-sm ${accent}`}>
      <p className="text-sm font-medium text-slate-600">{metric.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p>
    </article>
  );
}
