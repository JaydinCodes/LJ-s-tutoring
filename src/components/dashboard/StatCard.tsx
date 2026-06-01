import type { DashboardMetric } from '../../types/lms';

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const accent = {
    teal: 'border-teal-100 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40',
    violet: 'border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40',
    amber: 'border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    blue: 'border-sky-100 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
    slate: 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900',
  }[metric.tone];

  return (
    <article className={`rounded-[1.5rem] border p-5 shadow-sm ${accent}`}>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{metric.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{metric.helper}</p>
    </article>
  );
}
