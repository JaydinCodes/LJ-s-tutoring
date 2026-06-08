import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { LoadingState, MissingProfileState, PermissionDeniedState } from '../../components/ui/State';
import { captureAppMessage } from '../../lib/monitoring/errorReporting';
import { AdminMfaGate } from './AdminMfaGate';
import { useAuth } from './AuthProvider';
import { formatRoleList, getDashboardPath, normalizeUserRole, type SupportedDashboardRole } from './roles';

export function ProtectedRoute({ roles, children }: { roles: SupportedDashboardRole[]; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const currentRole = normalizeUserRole(auth.profile?.role);
  const dashboardHref = getDashboardPath(currentRole);

  if (auth.loading) {
    return <GuardShell><LoadingState title="Checking access" description="Loading your account access..." /></GuardShell>;
  }

  if (!auth.configured) {
    return (
      <GuardMessage
        title="Access temporarily unavailable"
        description="The portal sign-in service is unavailable. Please contact support if you need urgent access."
      />
    );
  }

  if (!auth.session) {
    return <Navigate to="/dashboard/login" replace state={{ from: location.pathname }} />;
  }

  if (auth.status === 'missing_profile' || !auth.profile) {
    return <GuardShell><GuardMonitoringEvent action="auth.missing_profile_route" route={location.pathname} /><MissingProfileState /></GuardShell>;
  }

  if (auth.status === 'invalid_role' || !currentRole) {
    return (
      <GuardMessage
        title="Portal role unavailable"
        description="Your account has a role that is not enabled for this portal. Please contact support so we can correct your access."
      />
    );
  }

  if (!roles.includes(currentRole)) {
    return (
      <GuardShell>
        <GuardMonitoringEvent
          action="auth.unauthorized_route"
          role={currentRole}
          route={location.pathname}
          metadata={{ required_roles: roles.join(',') }}
        />
        <PermissionDeniedState
          dashboardHref={dashboardHref}
          description={`This route requires ${formatRoleList(roles)} access. Your current role is ${currentRole}.`}
        />
      </GuardShell>
    );
  }

  if (currentRole === 'admin') {
    return <AdminMfaGate>{children}</AdminMfaGate>;
  }

  return <>{children}</>;
}

function GuardMonitoringEvent({
  action,
  metadata,
  role,
  route,
}: {
  action: string;
  metadata?: Record<string, unknown>;
  role?: string | null;
  route: string;
}) {
  useEffect(() => {
    captureAppMessage('Protected route access anomaly', {
      featureArea: 'auth',
      action,
      role,
      route,
      metadata,
    });
  }, [action, metadata, role, route]);

  return null;
}

function GuardShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
      <div className="mx-auto mt-20 max-w-xl">{children}</div>
    </main>
  );
}

function GuardMessage({ title, description }: { title: string; description: string }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
      <div className="mx-auto mt-20 max-w-xl">
        <Card>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </Card>
      </div>
    </main>
  );
}
