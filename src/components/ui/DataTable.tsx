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
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900">
      <div className="grid gap-3 p-2 sm:p-3 md:hidden">
        {rows.map((row, index) => (
          <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/60 sm:p-4">
            {columns.map((column) => (
              <div key={column.key} className="grid gap-1 border-b border-slate-950/10 py-2 last:border-b-0 dark:border-white/10">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-aegean dark:text-brand-gold">{column.label}</p>
                <div className="min-w-0 break-words text-sm text-slate-700 dark:text-slate-300 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11 [&_button]:touch-manipulation">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-brand-marble">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-950/10 bg-white dark:divide-white/10 dark:bg-slate-900">
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
