import { Link } from 'react-router-dom';

export function QuickActionsPanel() {
  const actions = [
    { to: '/student/assignments/', title: 'Upload assignment', copy: 'Jump straight into the submission workflow.' },
    { to: '/student/results/', title: 'View results', copy: 'Check marks, feedback, and recent growth signals.' },
    { to: '/student/progress/', title: 'View study plan', copy: 'See subjects, goals, and rhythm in one place.' },
    { to: '/student/careers/', title: 'Open careers', copy: 'Career pathways and the AI assistant stay here.' },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {actions.map((action) => (
        <article key={action.to} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{action.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.copy}</p>
          <Link to={action.to} className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            Open
          </Link>
        </article>
      ))}
    </div>
  );
}
