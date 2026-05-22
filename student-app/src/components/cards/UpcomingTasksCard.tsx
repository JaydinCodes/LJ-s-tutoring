import { formatDate } from '../../lib/format';

interface UpcomingItem {
  title: string;
  meta: string;
  tone?: 'task' | 'lesson' | 'goal';
}

export function UpcomingTasksCard({ title, items }: { title: string; items: UpcomingItem[] }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={`${item.title}-${item.meta}`} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">{item.tone || 'task'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.meta}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
