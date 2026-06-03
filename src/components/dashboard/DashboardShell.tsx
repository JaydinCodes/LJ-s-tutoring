import type { ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  Clock,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { signOut } from '../../features/auth/authService';

type DashboardNavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
};

const nav = {
  student: [
    { to: '/dashboard/student', label: 'Dashboard', shortLabel: 'Today', icon: LayoutDashboard },
    { to: '/dashboard/student/assignments', label: 'Assignments', shortLabel: 'Tasks', icon: ScrollText },
    { to: '/dashboard/student/results', label: 'Results', icon: Trophy },
    { to: '/dashboard/student/progress', label: 'Progress', icon: TrendingUp },
    { to: '/dashboard/student/reports', label: 'Resources', icon: BookOpen },
    { to: '/dashboard/student/careers', label: 'Careers', icon: Compass },
    { to: '/onboarding/student', label: 'Settings', icon: Settings },
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

type ShellProps = {
  title: string;
  subtitle: string;
  section: DashboardSection;
  children: ReactNode;
};

function getInitials(name?: string) {
  if (!name) return 'PO';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function isCurrentPath(pathname: string, item: DashboardNavItem) {
  if (item.to === '/dashboard/student' || item.to === '/dashboard/admin' || item.to === '/dashboard/tutor') {
    return pathname === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function DashboardShell(props: ShellProps) {
  if (props.section === 'student') {
    return <AppShell {...props} />;
  }

  return <LegacyDashboardShell {...props} />;
}

export function AppShell({ title, subtitle, children }: ShellProps) {
  const auth = useAuth();
  const location = useLocation();
  const onCareersPage = location.pathname.startsWith('/dashboard/student/careers');

  async function handleSignOut() {
    await signOut();
    await auth.refresh();
    window.location.assign('/dashboard/login');
  }

  return (
    <div className="academy-app-bg">
      <div className="mx-auto grid min-h-screen w-full max-w-[1180px] grid-cols-1 lg:grid-cols-[5rem_minmax(0,1fr)]">
        <DesktopRail navItems={nav.student} />
        <main className="min-w-0 px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-5 lg:px-6 lg:pb-8 lg:pt-5">
          <TopStudentHeader
            name={auth.profile?.full_name}
            role={auth.profile?.role}
            subtitle={subtitle}
            title={title}
            onSignOut={() => void handleSignOut()}
          />
          <div className="mx-auto mt-4 w-full max-w-4xl space-y-4">{children}</div>
        </main>
      </div>
      <MobileBottomNav navItems={nav.student.slice(0, 4).concat(nav.student[5])} />
      {onCareersPage ? (
        <a
          aria-label="Open Odie career assistant"
          className="fixed bottom-[calc(6.35rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-academy-gold text-academy-ink shadow-[0_18px_44px_rgba(15,23,42,0.24)] transition duration-fluid ease-ios hover:scale-[1.03] focus-visible:outline-academy-gold lg:bottom-6 lg:right-6"
          href="#odie-career-assistant"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" strokeWidth={2.2} />
        </a>
      ) : null}
    </div>
  );
}

export function TopStudentHeader({
  name,
  role,
  subtitle,
  title,
  onSignOut,
}: {
  name?: string;
  role?: string;
  subtitle: string;
  title: string;
  onSignOut: () => void;
}) {
  return (
    <header className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">
            Project Odysseus
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment sm:text-3xl">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NavLink
            aria-label="Open resources"
            className="grid h-11 w-11 place-items-center rounded-ios border border-slate-950/10 bg-white/64 text-academy-navy shadow-sm backdrop-blur-xl transition duration-fluid ease-ios hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-academy-parchment dark:hover:bg-white/[0.09]"
            to="/dashboard/student/reports"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </NavLink>
          <NavLink
            aria-label="Open settings"
            className="grid h-11 w-11 place-items-center rounded-ios border border-slate-950/10 bg-white/64 text-academy-navy shadow-sm backdrop-blur-xl transition duration-fluid ease-ios hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-academy-parchment dark:hover:bg-white/[0.09]"
            to="/onboarding/student"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </NavLink>
          <button
            aria-label="Sign out"
            className="hidden h-11 items-center gap-2 rounded-full border border-slate-950/10 bg-white/64 px-4 text-sm font-semibold text-academy-navy shadow-sm backdrop-blur-xl transition duration-fluid ease-ios hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-academy-parchment dark:hover:bg-white/[0.09] sm:inline-flex"
            type="button"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
          <div className="grid h-11 w-11 place-items-center rounded-ios bg-academy-navy text-sm font-bold text-white shadow-academy-soft dark:bg-white dark:text-slate-950">
            {getInitials(name)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-academy-muted">
        {name ? <span className="font-semibold text-academy-ink dark:text-academy-parchment">{name}</span> : null}
        {role ? <span className="h-1 w-1 rounded-full bg-academy-gold" aria-hidden="true" /> : null}
        {role ? <span className="capitalize">{role}</span> : null}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-academy-muted">{subtitle}</p>
      <div className="greek-keyline mt-4 h-px" aria-hidden="true" />
    </header>
  );
}

export function DesktopRail({ navItems }: { navItems: DashboardNavItem[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen py-5 pl-3 lg:block">
      <div className="flex h-full w-16 flex-col items-center rounded-sheet border border-white/70 bg-white/[0.72] py-3 shadow-academy backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
        <NavLink
          aria-label="Project Odysseus dashboard"
          className="mb-3 grid h-11 w-11 place-items-center rounded-ios bg-academy-navy text-sm font-bold text-white shadow-academy-soft dark:bg-white dark:text-slate-950"
          to="/dashboard/student"
        >
          PO
        </NavLink>
        <nav aria-label="Student portal" className="flex flex-1 flex-col items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                aria-label={item.label}
                className={({ isActive }) => `group relative grid h-11 w-11 place-items-center rounded-ios transition duration-fluid ease-ios ${isActive ? 'bg-academy-navy text-white shadow-academy-soft dark:bg-academy-aegean' : 'text-slate-500 hover:bg-white/80 hover:text-academy-navy dark:text-academy-marble dark:hover:bg-white/[0.08] dark:hover:text-white'}`}
                end={item.to === '/dashboard/student'}
                title={item.label}
                to={item.to}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" strokeWidth={2} />
                <span className="pointer-events-none absolute left-[3.65rem] z-50 hidden rounded-full border border-slate-950/10 bg-white/95 px-3 py-1.5 text-xs font-semibold text-academy-ink shadow-academy-soft backdrop-blur-xl group-hover:block dark:border-white/10 dark:bg-slate-950/95 dark:text-academy-parchment">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function MobileBottomNav({ navItems }: { navItems: DashboardNavItem[] }) {
  const location = useLocation();

  return (
    <nav aria-label="Student portal" className="academy-bottom-nav lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentPath(location.pathname, item);
          return (
            <NavLink
              key={item.to}
              aria-label={item.label}
              className="academy-nav-item"
              data-active={active}
              end={item.to === '/dashboard/student'}
              to={item.to}
            >
              <Icon className="mx-auto mb-1 h-4 w-4 text-current" aria-hidden="true" strokeWidth={2} />
              <span className="block truncate">{item.shortLabel ?? item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function LegacyDashboardShell({ title, subtitle, section, children }: ShellProps) {
  const auth = useAuth();
  const sectionLabel = `${section} dashboard`;
  const navItems = nav[section];

  async function handleSignOut() {
    await signOut();
    await auth.refresh();
    window.location.assign('/dashboard/login');
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
                  className={({ isActive }) => `flex items-center justify-between rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-navy text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] dark:bg-brand-aegean dark:text-white' : 'text-slate-600 hover:bg-white/80 hover:text-brand-obsidian dark:text-brand-marble dark:hover:bg-white/[0.08] dark:hover:text-white'}`}
                  end={item.to === '/dashboard/admin' || item.to === '/dashboard/tutor'}
                  to={item.to}
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
        </aside>
        <main className="min-w-0 flex-1">
          <header className="rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/25 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-aegean dark:text-brand-gold">{sectionLabel}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Dashboard alerts"
                  className="relative grid h-11 w-11 place-items-center rounded-[1.2rem] border border-slate-950/10 bg-white/70 text-sm font-bold text-brand-navy shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment dark:hover:bg-white/[0.09]"
                >
                  <Bell className="h-4 w-4 text-current" aria-hidden="true" />
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
          </header>
          <div className="mt-4 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
