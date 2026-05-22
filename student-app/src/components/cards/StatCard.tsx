export function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'violet' | 'teal' | 'gold' | 'blue';
}) {
  const accent = {
    violet: 'from-violet-500/20 to-violet-500/5',
    teal: 'from-teal-400/20 to-teal-400/5',
    gold: 'from-amber-400/25 to-amber-400/5',
    blue: 'from-sky-400/25 to-sky-400/5',
  }[tone];

  return (
    <article className={`rounded-[1.75rem] border border-slate-200/70 bg-gradient-to-br ${accent} bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950`}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{helper}</p>
    </article>
  );
}
