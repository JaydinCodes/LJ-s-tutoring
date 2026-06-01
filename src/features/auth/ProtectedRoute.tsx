import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import type { UserRole } from '../../types/lms';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

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

  if (!auth.profile) {
    return (
      <GuardMessage
        title="Profile missing"
        description="Your account setup is incomplete. Please contact support so we can finish linking your profile."
      />
    );
  }

  if (!roles.includes(auth.profile.role)) {
    return (
      <GuardMessage
        title="Access denied"
        description={`This route requires one of these roles: ${roles.join(', ')}. Your current role is ${auth.profile.role}.`}
      />
    );
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
