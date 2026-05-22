import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/70 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      <p className="text-base font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
