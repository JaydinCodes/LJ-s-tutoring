export function LoadingState({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className={`h-4 rounded-full bg-slate-200 dark:bg-slate-800 ${index === 0 ? 'w-2/3' : index === lines - 1 ? 'w-1/2' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}
