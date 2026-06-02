import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { signOut } from '../../features/auth/authService';

const nav = {
  student: [
    { to: '/dashboard/student', label: 'Dashboard' },
    { to: '/dashboard/student/assignments', label: 'Assignments' },
    { to: '/dashboard/student/results', label: 'Results' },
    { to: '/dashboard/student/progress', label: 'Progress' },
    { to: '/dashboard/student/reports', label: 'Resources' },
    { to: '/dashboard/student/careers', label: 'Careers / Odie AI' },
    { to: '/onboarding/student', label: 'Settings' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Overview' },
    { to: '/dashboard/admin/students', label: 'Students' },
    { to: '/dashboard/admin/tutors', label: 'Tutors' },
    { to: '/dashboard/admin/assignments', label: 'Assignments' },
    { to: '/dashboard/admin/approvals', label: 'Approvals' },
    { to: '/dashboard/admin/payments', label: 'Payments' },
    { to: '/dashboard/admin/payroll', label: 'Payroll' },
    { to: '/dashboard/admin/reconciliation', label: 'Reconciliation' },
    { to: '/dashboard/admin/reports', label: 'Reports' },
    { to: '/dashboard/admin/results', label: 'Results' },
    { to: '/dashboard/admin/audit', label: 'Audit' },
    { to: '/dashboard/admin/privacy-requests', label: 'Privacy' },
    { to: '/dashboard/admin/retention', label: 'Retention' },
    { to: '/dashboard/admin/ops-runbook', label: 'Runbook' },
  ],
  tutor: [
    { to: '/dashboard/tutor', label: 'Overview' },
    { to: '/dashboard/tutor/classes', label: 'Classes' },
    { to: '/dashboard/tutor/sessions', label: 'Sessions' },
    { to: '/dashboard/tutor/submissions', label: 'Submissions' },
    { to: '/dashboard/tutor/reports', label: 'Reports' },
    { to: '/dashboard/tutor/risk', label: 'Risk' },
  ],
};

export type DashboardSection = keyof typeof nav;

export function DashboardShell({
  title,
  subtitle,
  section,
  children,
}: {
  title: string;
  subtitle: string;
  section: DashboardSection;
  children: ReactNode;
}) {
  const auth = useAuth();
  const sectionLabel = section === 'student' ? 'student portal' : `${section} dashboard`;
  const navItems = nav[section];

  async function handleSignOut() {
    await signOut();
    await auth.refresh();
    window.location.assign('/dashboard/login/');
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,_#f8f5ee_0%,_#ffffff_42%,_#e2e8f0_100%)] text-brand-obsidian dark:bg-brand-obsidian dark:bg-none dark:text-brand-parchment">
      <div className="mx-auto flex max-w-[1640px] gap-4 px-3 py-3 sm:px-4 lg:gap-6 lg:py-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 rounded-[1.5rem] border border-brand-marble bg-white/90 p-5 shadow-xl shadow-brand-navy/10 backdrop-blur dark:border-brand-marble/20 dark:bg-brand-obsidian/95 dark:shadow-black/20 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-navy text-sm font-bold text-white shadow-lg shadow-blue-900/20 dark:bg-slate-100 dark:text-slate-950">PO</div>
            <div>
              <p className="font-semibold">Project Odysseus</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Learning management</p>
            </div>
          </div>
          <nav className="mt-5 grid gap-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/15 dark:bg-brand-aegean dark:text-white' : 'text-slate-600 hover:bg-brand-parchment hover:text-brand-obsidian dark:text-brand-marble dark:hover:bg-brand-navy dark:hover:text-white'}`}
              >
                <span>{item.label}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
              </NavLink>
            ))}
          </nav>
          {section === 'student' ? (
            <div className="mt-auto rounded-[1.5rem] border border-brand-aegean/30 bg-brand-parchment p-4 dark:border-brand-aegean/60 dark:bg-brand-navy">
              <p className="text-sm font-semibold text-brand-navy dark:text-brand-parchment">Odie stays in Careers</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Daily dashboard space stays focused on assignments, results, and progress.</p>
            </div>
          ) : null}
        </aside>
        <main className="min-w-0 flex-1">
          <header className="rounded-[1.5rem] border border-brand-marble bg-white/90 p-4 shadow-lg shadow-brand-navy/10 backdrop-blur dark:border-brand-marble/20 dark:bg-brand-obsidian/95 dark:shadow-black/20 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-aegean dark:text-brand-gold">{sectionLabel}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 sm:w-72">
                  <span className="sr-only">Search dashboard</span>
                  <input
                    className="w-full rounded-full border border-brand-marble bg-brand-parchment/60 px-4 py-2.5 pr-10 text-sm text-brand-obsidian outline-none transition placeholder:text-slate-400 focus:border-brand-aegean focus:bg-white focus:ring-4 focus:ring-brand-aegean/15 dark:border-brand-marble/30 dark:bg-brand-navy dark:text-brand-parchment dark:focus:border-brand-gold dark:focus:bg-brand-obsidian dark:focus:ring-brand-gold/15"
                    placeholder="Search dashboard"
                    type="search"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">/</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Assignment alerts"
                    className="relative grid h-11 w-11 place-items-center rounded-2xl border border-brand-marble bg-white text-sm font-bold text-brand-navy shadow-sm transition hover:border-brand-aegean hover:bg-brand-parchment dark:border-brand-marble/30 dark:bg-brand-navy dark:text-brand-parchment dark:hover:bg-brand-aegean"
                  >
                    !
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                  </button>
                  {auth.profile ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2 pr-3 dark:bg-slate-900">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-navy text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                        {auth.profile.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{auth.profile.full_name}</p>
                        <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{auth.profile.role}</p>
                      </div>
                      <button className="text-xs font-semibold text-slate-600 underline dark:text-slate-300" type="button" onClick={() => void handleSignOut()}>
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
          <div className="mt-4 space-y-4 pb-24 lg:pb-4">{children}</div>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.5rem] border border-brand-marble bg-white/95 p-2 shadow-2xl shadow-brand-navy/15 backdrop-blur dark:border-brand-marble/20 dark:bg-brand-obsidian/95 lg:hidden">
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {navItems.slice(0, 6).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rounded-2xl px-2 py-3 text-center text-[0.7rem] font-semibold leading-tight ${isActive ? 'bg-brand-navy text-white dark:bg-brand-aegean' : 'text-slate-600 dark:text-brand-marble'}`}
            >
              {item.label.replace(' / Odie AI', '')}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
