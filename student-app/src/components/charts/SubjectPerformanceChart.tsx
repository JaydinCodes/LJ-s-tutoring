export function SubjectPerformanceChart({ items }: { items: Array<{ topic: string; completion: number; minutes: number; sessions: number }> }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Subject performance</h3>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.topic}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{item.topic}</span>
              <span className="text-slate-500 dark:text-slate-400">{item.completion}%</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-3 rounded-full bg-gradient-to-r from-teal-400 via-sky-500 to-violet-500" style={{ width: `${Math.max(6, item.completion)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.minutes} minutes | {item.sessions} sessions</p>
          </div>
        ))}
      </div>
    </div>
  );
}
