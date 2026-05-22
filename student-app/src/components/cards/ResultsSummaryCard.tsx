import type { ResultsItem } from '../../types';
import { formatDate } from '../../lib/format';

export function ResultsSummaryCard({ result }: { result: ResultsItem }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">{result.subject || 'Result'}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{result.title || 'Marked work'}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{result.percentage != null ? `${result.percentage}%` : '--'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{result.markedAt ? `Marked ${formatDate(result.markedAt)}` : 'Awaiting mark'}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{result.feedbackSummary || 'Feedback summary will appear here once your tutor marks the work.'}</p>
    </article>
  );
}
