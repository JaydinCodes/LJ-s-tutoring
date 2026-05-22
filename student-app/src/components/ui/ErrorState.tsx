export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
