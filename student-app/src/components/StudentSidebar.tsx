import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/student/dashboard/', label: 'Dashboard' },
  { to: '/student/assignments/', label: 'Assignments' },
  { to: '/student/results/', label: 'Results' },
  { to: '/student/progress/', label: 'Progress' },
  { to: '/student/careers/', label: 'Careers' },
];

export function StudentSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden min-h-[calc(100vh-2rem)] w-72 rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 text-slate-100 shadow-2xl lg:flex lg:flex-col">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-300">Project Odysseus</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Student Portal</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">A modern learning cockpit for progress, tasks, and career direction.</p>
      </div>
      <nav className="mt-10 space-y-2">
        {links.map((link) => {
          const active = location.pathname === link.to || location.pathname.startsWith(link.to.slice(0, -1));
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? 'bg-gradient-to-r from-violet-500 to-teal-400 text-white shadow-lg' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Careers assistant lives here now</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Odie has been removed from the dashboard and kept in Careers for pathway guidance only.</p>
      </div>
    </aside>
  );
}
