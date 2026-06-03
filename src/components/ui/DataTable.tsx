import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, empty }: { columns: Array<Column<T>>; rows: T[]; empty: string }) {
  if (!rows.length) {
    return <EmptyState title={empty} description="This dashboard section will fill in automatically once matching records are available." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-marble dark:border-brand-marble/20">
      <div className="grid gap-3 bg-brand-parchment/50 p-3 dark:bg-brand-navy/30 md:hidden">
        {rows.map((row, index) => (
          <article key={index} className="rounded-2xl border border-brand-marble bg-white p-4 shadow-sm dark:border-brand-marble/20 dark:bg-brand-obsidian">
            {columns.map((column) => (
              <div key={column.key} className="grid gap-1 border-b border-brand-marble/60 py-2 last:border-b-0 dark:border-brand-marble/20">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">{column.label}</p>
                <div className="break-words text-sm text-slate-700 dark:text-slate-300">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-brand-parchment text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-brand-navy dark:text-brand-marble">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-marble bg-white dark:divide-brand-marble/20 dark:bg-brand-obsidian">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
