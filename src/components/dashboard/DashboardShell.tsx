import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  Ellipsis,
  FolderOpen,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { signOut } from '../../features/auth/authService';
import { useStudentNotifications } from '../../features/students/useStudentNotifications';
import { NotificationDialog } from '../../features/students/StudentNotificationsPanel';
import { useModalDialog } from '../../hooks/useModalDialog';

type DashboardNavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
};

type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

const navigation = {
  student: [
    {
      label: 'Learning',
      items: [
        { to: '/dashboard/student', label: 'Today', icon: Home },
        { to: '/dashboard/student/assignments', label: 'Tasks', icon: ClipboardList },
        { to: '/dashboard/student/results', label: 'Results', icon: Trophy },
        { to: '/dashboard/student/progress', label: 'Progress', icon: TrendingUp },
      ],
    },
    {
      label: 'Support',
      items: [
        { to: '/dashboard/student/sessions', label: 'Tutor & sessions', shortLabel: 'Sessions', icon: UserRound },
        { to: '/dashboard/student/reports', label: 'Resources', icon: FolderOpen },
        { to: '/dashboard/student/careers', label: 'Careers', icon: Compass },
        { to: '/dashboard/student/settings', label: 'Settings', icon: Settings },
      ],
    },
  ],
  tutor: [
    {
      label: 'Teaching day',
      items: [
        { to: '/dashboard/tutor', label: 'Today', icon: LayoutDashboard },
        { to: '/dashboard/tutor/risk', label: 'Learners', icon: UsersRound },
        { to: '/dashboard/tutor/sessions', label: 'Teach', icon: Clock },
        { to: '/dashboard/tutor/submissions', label: 'Assess', icon: ScrollText },
        { to: '/dashboard/tutor/reports', label: 'Insights', icon: TrendingUp },
      ],
    },
    {
      label: 'Workspace',
      items: [
        { to: '/dashboard/tutor/classes', label: 'Classes', icon: BookOpen },
        { to: '/dashboard/tutor/assignments', label: 'Assignments', icon: Target },
      ],
    },
    {
      label: 'Account',
      items: [{ to: '/dashboard/tutor/settings', label: 'Settings', icon: Settings }],
    },
  ],
  admin: [
    {
      label: 'Overview',
      items: [{ to: '/dashboard/admin', label: 'Today', icon: LayoutDashboard }],
    },
    {
      label: 'Learners',
      items: [
        { to: '/dashboard/admin/students', label: 'Learners & guardians', shortLabel: 'Learners', icon: GraduationCap },
        { to: '/dashboard/admin/tutors', label: 'Tutors', icon: UsersRound },
        { to: '/dashboard/admin/allocations', label: 'Allocations', icon: Target },
        { to: '/dashboard/admin/users', label: 'Account access', icon: UserPlus },
      ],
    },
    {
      label: 'Teaching',
      items: [
        { to: '/dashboard/admin/results', label: 'Learning quality', shortLabel: 'Teaching', icon: Brain },
        { to: '/dashboard/admin/classes', label: 'Classes', icon: BookOpen },
        { to: '/dashboard/admin/approvals', label: 'Session approvals', icon: ShieldCheck },
        { to: '/dashboard/admin/ai-grading', label: 'AI grading', icon: Sparkles },
      ],
    },
    {
      label: 'Finance',
      items: [
        { to: '/dashboard/admin/payments', label: 'Finance', icon: WalletCards },
        { to: '/dashboard/admin/payroll', label: 'Payroll', icon: TrendingUp },
        { to: '/dashboard/admin/reconciliation', label: 'Reconciliation', icon: Clock },
      ],
    },
    {
      label: 'Governance',
      items: [
        { to: '/dashboard/admin/audit', label: 'Audit trail', shortLabel: 'Governance', icon: ShieldCheck },
        { to: '/dashboard/admin/privacy-requests', label: 'Privacy requests', icon: Target },
        { to: '/dashboard/admin/retention', label: 'Retention', icon: Clock },
        { to: '/dashboard/admin/ops-runbook', label: 'Operations runbook', icon: Compass },
      ],
    },
    {
      label: 'Reports',
      items: [{ to: '/dashboard/admin/reports', label: 'Reports', icon: BookOpen }],
    },
  ],
  parent: [
    { label: 'Overview', items: [{ to: '/dashboard/parent/reports', label: 'My child', icon: ScrollText }] },
  ],
  ngo: [
    { label: 'Overview', items: [{ to: '/dashboard/ngo/reports', label: 'Cohort impact', shortLabel: 'Impact', icon: UsersRound }] },
  ],
} satisfies Record<string, DashboardNavGroup[]>;

export type DashboardSection = keyof typeof navigation;

type ShellProps = {
  title: string;
  subtitle: string;
  section: DashboardSection;
  children: ReactNode;
  identity?: DashboardIdentity;
};

export type DashboardIdentity = {
  name?: string;
  meta?: string;
};

const mobilePrimaryLabels: Partial<Record<DashboardSection, string[]>> = {
  student: ['Today', 'Tasks', 'Results', 'Progress'],
  tutor: ['Today', 'Learners', 'Teach', 'Assess'],
  admin: ['Today', 'Learners & guardians', 'Learning quality', 'Finance'],
};

function flattenNavigation(groups: DashboardNavGroup[]) {
  return groups.flatMap((group) => group.items);
}

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
  const roleHomes = ['/dashboard/student', '/dashboard/admin', '/dashboard/tutor'];
  if (roleHomes.includes(item.to)) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function getSectionHome(section: DashboardSection) {
  if (section === 'parent') return '/dashboard/parent/reports';
  if (section === 'ngo') return '/dashboard/ngo/reports';
  return `/dashboard/${section}`;
}

function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function useDashboardSignOut(refreshAuth: () => Promise<void>) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      await refreshAuth();
      window.location.assign('/dashboard/login');
    } catch {
      setSignOutError('We could not sign you out. Check your connection and try again.');
    } finally {
      setIsSigningOut(false);
    }
  }

  return { handleSignOut, isSigningOut, signOutError };
}

export function DashboardShell({ title, subtitle, section, children, identity }: ShellProps) {
  const auth = useAuth();
  const location = useLocation();
  const groups = navigation[section];
  const navItems = useMemo(() => flattenNavigation(groups), [groups]);
  const homeHref = getSectionHome(section);
  const isHome = location.pathname === homeHref;
  const useGreeting = isHome && (section === 'student' || section === 'tutor' || section === 'admin');
  const displayTitle = useGreeting
    ? `${dayGreeting()}, ${auth.profile?.full_name?.split(' ')[0] || (section === 'admin' ? 'Admin' : section === 'tutor' ? 'Tutor' : 'Student')}`
    : title;
  const { handleSignOut, isSigningOut, signOutError } = useDashboardSignOut(auth.refresh);

  return (
    <div className={`academy-app-bg overflow-x-clip ${section === 'student' ? 'student-parchment-bg' : ''}`}>
      <div className={`mx-auto grid min-h-screen w-full max-w-[1720px] grid-cols-1 ${section === 'student' ? 'lg:grid-cols-[13.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[16.5rem_minmax(0,1fr)]'}`} data-modal-background>
        <DesktopSidebar groups={groups} homeHref={homeHref} role={section} onSignOut={() => void handleSignOut()} signingOut={isSigningOut} />
        <main className={`min-w-0 px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 lg:pb-8 lg:pt-5 ${section === 'student' ? 'lg:px-9 xl:px-12' : 'lg:px-7 xl:px-9'}`}>
          <DashboardHeader
            title={displayTitle}
            subtitle={subtitle}
            name={identity?.name || auth.profile?.full_name}
            role={identity?.meta || auth.profile?.role}
            section={section}
            notificationControl={section === 'student' ? <StudentNotificationControl /> : undefined}
          />
          {signOutError ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-100" role="alert">
              <p>{signOutError}</p>
              <button className="min-h-11 rounded-xl border border-current px-4 font-semibold" disabled={isSigningOut} onClick={() => void handleSignOut()} type="button">Try again</button>
            </div>
          ) : null}
          <div className="mt-5 min-w-0 space-y-4">{children}</div>
        </main>
      </div>
      <MobileRoleNavigation
        homeHref={homeHref}
        navItems={navItems}
        onSignOut={() => void handleSignOut()}
        signingOut={isSigningOut}
        section={section}
      />
    </div>
  );
}

function DashboardHeader({
  title,
  subtitle,
  name,
  role,
  section,
  notificationControl,
}: {
  title: string;
  subtitle: string;
  name?: string;
  role?: string;
  section: DashboardSection;
  notificationControl?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 items-start justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-white/10">
      <div className="min-w-0">
        <p className={`text-[0.7rem] font-bold uppercase tracking-[0.2em] text-academy-aegean dark:text-academy-gold ${section === 'student' ? 'lg:hidden' : ''}`}>Project Odysseus</p>
        <h1 className={`mt-1 break-words font-display font-semibold leading-tight text-academy-navy dark:text-academy-parchment ${section === 'student' ? 'text-[clamp(1.8rem,4vw,3.3rem)]' : 'text-[clamp(1.8rem,3vw,2.65rem)]'}`}>{title}</h1>
        <p className={`mt-2 text-sm leading-6 text-academy-muted ${section === 'student' ? 'max-w-5xl line-clamp-3 sm:line-clamp-2 lg:line-clamp-1' : 'max-w-3xl'}`}>{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {notificationControl}
        {section === 'student' ? (
          <NavLink aria-label="Open student settings" className="flex h-11 min-w-11 items-center gap-2 rounded-2xl border border-[#ded5c6] bg-[#fffbf2] p-1 shadow-sm transition hover:border-academy-gold dark:border-white/10 dark:bg-slate-900 sm:pr-3 lg:h-16 lg:min-w-72 lg:gap-3 lg:rounded-full lg:px-2" to="/dashboard/student/settings">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-academy-navy text-xs font-bold text-white dark:bg-academy-aegean lg:hidden">{getInitials(name)}</span>
            <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-academy-gold/15 text-[#b1830a] lg:grid"><GraduationCap className="h-6 w-6" aria-hidden="true" /></span>
            <span className="hidden min-w-0 flex-1 sm:block">
              <span className="block max-w-40 truncate text-xs font-semibold text-academy-navy dark:text-white lg:max-w-44 lg:text-base">{name || 'Project Odysseus'}</span>
              <span className="block text-[0.65rem] capitalize text-academy-muted lg:text-sm">{role || 'Student'}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-academy-navy dark:text-white lg:block" aria-hidden="true" />
          </NavLink>
        ) : (
          <div className="flex h-11 min-w-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 pr-1 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:pr-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-academy-navy text-xs font-bold text-white dark:bg-academy-aegean">{getInitials(name)}</span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-36 truncate text-xs font-semibold text-academy-navy dark:text-white">{name || 'Project Odysseus'}</span>
              <span className="block text-[0.65rem] capitalize text-academy-muted">{role || 'Portal'}</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function StudentNotificationControl() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useStudentNotifications();
  const unreadCount = (notifications ?? []).filter((notification) => !notification.is_read).length;

  return (
    <>
      <button
        aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-academy-navy shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-academy-gold px-1 text-[0.65rem] font-bold text-academy-navy">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      <NotificationDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function DesktopSidebar({
  groups,
  homeHref,
  role,
  onSignOut,
  signingOut,
}: {
  groups: DashboardNavGroup[];
  homeHref: string;
  role: DashboardSection;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen min-h-0 bg-academy-navy text-white lg:flex lg:flex-col" data-testid={`${role}-desktop-sidebar`}>
      <NavLink className={`shrink-0 border-b border-white/10 ${role === 'student' ? 'flex flex-col items-center gap-2 px-4 py-6 text-center' : 'flex items-center gap-3 px-5 py-5'}`} to={homeHref}>
        <img className={role === 'student' ? 'h-28 w-32 scale-110 object-contain' : 'h-12 w-12 object-contain'} src="/images/project-odysseus-logo-transparent.png" alt="" />
        <span className="min-w-0">
          {role === 'student' ? null : <span className="block font-display text-xl font-semibold text-white">Odysseus</span>}
          <span className={`block font-semibold uppercase text-academy-gold ${role === 'student' ? 'rounded-lg border border-academy-gold/70 px-4 py-1 text-[0.62rem] tracking-[0.18em]' : 'text-[0.65rem] tracking-[0.16em]'}`}>{role} portal</span>
        </span>
      </NavLink>
      <nav aria-label={`${role} dashboard`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable]" data-testid={`${role}-desktop-navigation`}>
        {groups.map((group) => (
          <div className="mb-5 last:mb-0" key={group.label}>
            <p className="mb-1 px-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-white/[0.12] text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
                    end={item.to === homeHref}
                    to={item.to}
                  >
                    {({ isActive }) => <>
                      <Icon className={`h-[1.1rem] w-[1.1rem] shrink-0 ${isActive && role === 'student' ? 'text-academy-gold' : 'text-current'}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive && role === 'student' ? 'text-academy-gold' : 'opacity-40'}`} aria-hidden="true" />
                    </>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.07] hover:text-white" disabled={signingOut} onClick={onSignOut} type="button">
          <LogOut className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}

function MobileRoleNavigation({
  homeHref,
  navItems,
  onSignOut,
  signingOut,
  section,
}: {
  homeHref: string;
  navItems: DashboardNavItem[];
  onSignOut: () => void;
  signingOut: boolean;
  section: DashboardSection;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestedLabels = mobilePrimaryLabels[section];
  const primaryItems = requestedLabels
    ? requestedLabels.map((label) => navItems.find((item) => item.label === label)).filter((item): item is DashboardNavItem => Boolean(item))
    : navItems.slice(0, 4);
  const primaryPaths = new Set(primaryItems.map((item) => item.to));
  const overflowItems = navItems.filter((item) => !primaryPaths.has(item.to));
  const visibleItems = navItems.length <= 5 && !requestedLabels ? navItems : primaryItems;
  const showMore = overflowItems.length > 0;
  const activeOverflow = overflowItems.some((item) => isCurrentPath(location.pathname, item));
  const dialogId = `${section}-more-navigation`;
  const dialogTitleId = `${dialogId}-title`;
  useModalDialog({ dialogRef, onClose: () => setOpen(false), open });

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 px-3 lg:hidden" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <div
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="fixed inset-x-3 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] max-h-[min(34rem,calc(100vh-7rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-academy-parchment p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950"
            id={dialogId}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Project Odysseus</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-academy-navy dark:text-white" id={dialogTitleId}>More</h2>
              </div>
              <button aria-label="Close More navigation" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-academy-navy dark:border-white/10 dark:bg-slate-900 dark:text-white" data-modal-initial-focus onClick={() => setOpen(false)} type="button">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label={`${section} secondary navigation`} className="mt-3 grid gap-2 sm:grid-cols-2">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const active = isCurrentPath(location.pathname, item);
                return (
                  <NavLink
                    key={item.to}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-academy-navy data-[active=true]:border-academy-aegean data-[active=true]:bg-academy-navy data-[active=true]:text-white dark:border-white/10 dark:bg-slate-900 dark:text-white dark:data-[active=true]:bg-academy-aegean"
                    data-active={active}
                    onClick={() => setOpen(false)}
                    to={item.to}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <button className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-academy-navy dark:border-white/10 dark:bg-slate-900 dark:text-white" disabled={signingOut} onClick={onSignOut} type="button">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
      <nav aria-label={`${section} dashboard`} className="academy-bottom-nav lg:hidden" data-modal-background data-testid={`${section}-mobile-navigation`}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleItems.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrentPath(location.pathname, item);
            return (
              <NavLink key={item.to} aria-label={item.label} className="academy-nav-item" data-active={active} end={item.to === homeHref} to={item.to}>
                <Icon className="mx-auto mb-1 h-[1.15rem] w-[1.15rem] text-current" aria-hidden="true" />
                <span className="block truncate">{item.shortLabel ?? item.label}</span>
              </NavLink>
            );
          })}
          {showMore ? (
            <button aria-controls={dialogId} aria-expanded={open} aria-haspopup="dialog" className="academy-nav-item" data-active={activeOverflow} onClick={() => setOpen(true)} type="button">
              <Ellipsis className="mx-auto mb-1 h-[1.15rem] w-[1.15rem] text-current" aria-hidden="true" />
              <span className="block truncate">More</span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
