import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { AdminMfaGate } from './AdminMfaGate';
import { useAuth } from './AuthProvider';
import { formatRoleList, normalizeUserRole, type SupportedDashboardRole } from './roles';

export function ProtectedRoute({ roles, children }: { roles: SupportedDashboardRole[]; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const currentRole = normalizeUserRole(auth.profile?.role);

  if (auth.loading) {
    return <GuardMessage title="Checking access" description="Loading your account access..." />;
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
    return (
      <GuardMessage
        title="Profile missing"
        description="Your account setup is incomplete. Please contact support so we can finish linking your profile."
      />
    );
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
      <GuardMessage
        title="Access denied"
        description={`This route requires one of these roles: ${formatRoleList(roles)}. Your current role is ${currentRole}.`}
      />
    );
  }

  if (currentRole === 'admin') {
    return <AdminMfaGate>{children}</AdminMfaGate>;
  }

  return <>{children}</>;
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
