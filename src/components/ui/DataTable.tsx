import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, empty }: { columns: Array<Column<T>>; rows: T[]; empty: string }) {
  if (!rows.length) {
    return <div className="rounded-2xl bg-brand-parchment/70 p-4 text-sm text-slate-600 dark:bg-brand-navy/70 dark:text-brand-marble">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-marble dark:border-brand-marble/20">
      <div className="overflow-x-auto">
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
