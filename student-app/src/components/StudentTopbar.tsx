import { studentApi } from '../lib/api';

interface StudentTopbarProps {
  name: string;
  subtitle: string;
  avatar?: string;
}

export function StudentTopbar({ name, subtitle, avatar }: StudentTopbarProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">Project Odysseus</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{name}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {avatar ? <img src={avatar} alt="" className="h-12 w-12 rounded-2xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-100">{name.charAt(0).toUpperCase()}</div>}
        <button
          type="button"
          onClick={() => void studentApi.logout().finally(() => window.location.replace('/dashboard/login.html'))}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white dark:hover:text-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
