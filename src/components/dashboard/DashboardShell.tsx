import type { ReactNode } from 'react';
import {
  BookOpen,
  Brain,
  Clock,
  Compass,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { signOut } from '../../features/auth/authService';

type DashboardNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

// Keep icon choices centralized so sidebar and mobile nav share one visual language.
const nav = {
  student: [
    { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/student/assignments', label: 'Assignments', icon: ScrollText },
    { to: '/dashboard/student/results', label: 'Results', icon: Trophy },
    { to: '/dashboard/student/progress', label: 'Progress', icon: TrendingUp },
    { to: '/dashboard/student/reports', label: 'Resources', icon: BookOpen },
    { to: '/dashboard/student/careers', label: 'Careers / Odie AI', icon: Compass },
    { to: '/onboarding/student', label: 'Settings', icon: Sparkles },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/dashboard/admin/tutors', label: 'Tutors', icon: Brain },
    { to: '/dashboard/admin/assignments', label: 'Assignments', icon: ScrollText },
    { to: '/dashboard/admin/approvals', label: 'Approvals', icon: Target },
    { to: '/dashboard/admin/payments', label: 'Payments', icon: Trophy },
    { to: '/dashboard/admin/payroll', label: 'Payroll', icon: TrendingUp },
    { to: '/dashboard/admin/reconciliation', label: 'Reconciliation', icon: Clock },
    { to: '/dashboard/admin/reports', label: 'Reports', icon: BookOpen },
    { to: '/dashboard/admin/results', label: 'Results', icon: Trophy },
    { to: '/dashboard/admin/audit', label: 'Audit', icon: Sparkles },
    { to: '/dashboard/admin/privacy-requests', label: 'Privacy', icon: Target },
    { to: '/dashboard/admin/retention', label: 'Retention', icon: Clock },
    { to: '/dashboard/admin/ops-runbook', label: 'Runbook', icon: Compass },
  ],
  tutor: [
    { to: '/dashboard/tutor', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard/tutor/classes', label: 'Classes', icon: BookOpen },
    { to: '/dashboard/tutor/sessions', label: 'Sessions', icon: Clock },
    { to: '/dashboard/tutor/submissions', label: 'Submissions', icon: ScrollText },
    { to: '/dashboard/tutor/reports', label: 'Reports', icon: TrendingUp },
    { to: '/dashboard/tutor/risk', label: 'Risk', icon: Brain },
  ],
} satisfies Record<string, DashboardNavItem[]>;

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,_rgba(31,111,139,0.12),_transparent_30%),radial-gradient(circle_at_88%_8%,_rgba(244,197,24,0.10),_transparent_26%),linear-gradient(180deg,_#f7f8fb_0%,_#eef2f7_100%)] text-brand-obsidian dark:bg-[radial-gradient(circle_at_12%_0%,_rgba(31,111,139,0.2),_transparent_30%),linear-gradient(180deg,_#070b14_0%,_#111827_100%)] dark:text-brand-parchment">
      <div className="mx-auto flex max-w-[1640px] gap-4 px-3 py-3 sm:px-4 lg:gap-6 lg:py-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 rounded-[2rem] border border-white/70 bg-white/72 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.09)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/25 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-950/5 pb-5 dark:border-white/10">
            <div className="grid h-11 w-11 place-items-center rounded-[1.2rem] bg-brand-navy text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950">PO</div>
            <div>
              <p className="font-semibold">Project Odysseus</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Learning management</p>
            </div>
          </div>
          <nav className="mt-5 grid gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center justify-between rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-navy text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] dark:bg-brand-aegean dark:text-white' : 'text-slate-600 hover:bg-white/80 hover:text-brand-obsidian dark:text-brand-marble dark:hover:bg-white/[0.08] dark:hover:text-white'}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-current" aria-hidden="true" strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="h-5 w-1 rounded-full bg-current opacity-25" aria-hidden="true" />
                </NavLink>
              );
            })}
          </nav>
          {section === 'student' ? (
            <div className="mt-auto rounded-[1.5rem] border border-white/70 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.05]">
              <p className="text-sm font-semibold text-brand-navy dark:text-brand-parchment">Odie stays in Careers</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Daily dashboard space stays focused on assignments, results, and progress.</p>
            </div>
          ) : null}
        </aside>
        <main className="min-w-0 flex-1">
          <header className="rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/25 sm:p-5">
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
                    className="w-full rounded-full border border-slate-950/10 bg-white/65 px-4 py-2.5 pr-10 text-sm text-brand-obsidian outline-none transition placeholder:text-slate-400 focus:border-brand-aegean/40 focus:bg-white focus:ring-4 focus:ring-brand-aegean/10 dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment dark:focus:border-brand-gold/40 dark:focus:bg-white/[0.08] dark:focus:ring-brand-gold/10"
                    placeholder="Search dashboard"
                    type="search"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">/</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Assignment alerts"
                    className="relative grid h-11 w-11 place-items-center rounded-[1.2rem] border border-slate-950/10 bg-white/70 text-sm font-bold text-brand-navy shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment dark:hover:bg-white/[0.09]"
                  >
                    <Clock className="h-4 w-4 text-current" aria-hidden="true" />
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                  </button>
                  {auth.profile ? (
                    <div className="flex items-center gap-3 rounded-[1.3rem] border border-slate-950/5 bg-white/60 p-2 pr-3 dark:border-white/10 dark:bg-white/[0.05]">
                      <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-brand-navy text-sm font-bold text-white dark:bg-white dark:text-slate-950">
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
          <div className="mt-4 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-4">{children}</div>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-[2rem] border border-white/70 bg-white/82 p-2 shadow-[0_22px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/78 lg:hidden">
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {navItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `rounded-[1.35rem] px-2 py-2.5 text-center text-[0.68rem] font-semibold leading-tight transition ${isActive ? 'bg-brand-navy text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] dark:bg-brand-aegean' : 'text-slate-600 hover:bg-white/70 dark:text-brand-marble dark:hover:bg-white/[0.08]'}`}
              >
                <Icon className="mx-auto mb-1 h-4 w-4 text-current" aria-hidden="true" strokeWidth={2} />
                <span className="block truncate">{item.label.replace(' / Odie AI', '')}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
