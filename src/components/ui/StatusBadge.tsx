export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes('paid') || normalized.includes('active') || normalized.includes('marked')
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : normalized.includes('overdue') || normalized.includes('rejected')
      ? 'bg-red-50 text-red-700 ring-red-200'
      : normalized.includes('pending') || normalized.includes('draft')
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-slate-100 text-slate-700 ring-slate-200';

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{value}</span>;
}
