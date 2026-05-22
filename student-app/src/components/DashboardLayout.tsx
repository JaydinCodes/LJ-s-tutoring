import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopbar } from './StudentTopbar';

const mobileLinks = [
  { to: '/student/dashboard/', label: 'Home' },
  { to: '/student/assignments/', label: 'Tasks' },
  { to: '/student/results/', label: 'Results' },
  { to: '/student/progress/', label: 'Progress' },
  { to: '/student/careers/', label: 'Careers' },
];

export function DashboardLayout({
  title,
  subtitle,
  name,
  avatar,
  children,
}: {
  title: string;
  subtitle: string;
  name: string;
  avatar?: string;
  children: ReactNode;
}) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.14),_transparent_25rem),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_24rem),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-3 py-3 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_25rem),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.16),_transparent_24rem),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] dark:text-white sm:px-5">
      <div className="mx-auto flex max-w-[1600px] gap-3 lg:gap-6">
        <StudentSidebar />
        <main className="min-w-0 flex-1">
          <StudentTopbar name={name} subtitle={subtitle} avatar={avatar} />
          <section className="mt-4 space-y-4">
            <div className="px-1">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            </div>
            {children}
          </section>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] border border-slate-200/70 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
        <div className="grid grid-cols-5 gap-2">
          {mobileLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-2xl px-2 py-3 text-center text-xs font-semibold ${active ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
