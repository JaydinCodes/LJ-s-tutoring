import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { signOut } from '../../features/auth/authService';

const nav = {
  student: [
    { to: '/dashboard/student', label: 'Overview' },
    { to: '/dashboard/student/assignments', label: 'Assignments' },
    { to: '/dashboard/student/progress', label: 'Progress' },
    { to: '/dashboard/student/results', label: 'Results' },
    { to: '/dashboard/student/careers', label: 'Careers' },
    { to: '/dashboard/student/reports', label: 'Reports' },
    { to: '/dashboard/student/community', label: 'Community' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Overview' },
    { to: '/dashboard/admin/students', label: 'Students' },
    { to: '/dashboard/admin/tutors', label: 'Tutors' },
    { to: '/dashboard/admin/assignments', label: 'Assignments' },
    { to: '/dashboard/admin/approvals', label: 'Approvals' },
    { to: '/dashboard/admin/payments', label: 'Payments' },
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
    { to: '/dashboard/tutor/submissions', label: 'Submissions' },
  ],
};

export function DashboardShell({
  title,
  subtitle,
  section,
  children,
}: {
  title: string;
  subtitle: string;
  section: keyof typeof nav;
  children: ReactNode;
}) {
  const auth = useAuth();

  async function handleSignOut() {
    await signOut();
    await auth.refresh();
    window.location.assign('/dashboard/login/');
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-white">PO</div>
            <div>
              <p className="font-semibold">Project Odysseus</p>
              <p className="text-xs text-slate-500">React LMS</p>
            </div>
          </div>
          <nav className="mt-4 grid gap-1">
            {nav[section].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{section} dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
              </div>
              {auth.profile ? (
                <div className="rounded-lg bg-slate-50 p-3 text-right">
                  <p className="text-sm font-semibold text-slate-950">{auth.profile.full_name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{auth.profile.role}</p>
                  <button className="mt-2 text-sm font-semibold text-slate-700 underline" type="button" onClick={() => void handleSignOut()}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>
          <div className="mt-4 space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
