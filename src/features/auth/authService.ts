import type { Session } from '@supabase/supabase-js';
import { getE2EMockAuthSnapshot, isE2EAuthMockEnabled, signInWithE2EMock, signOutE2EMock } from '../../lib/e2e/mockAuth';
import { captureAppError } from '../../lib/monitoring/errorReporting';
import { isSupabaseConfigured, requireSupabase, supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/lms';
import { getDashboardPath, normalizeUserRole, type SupportedDashboardRole } from './roles';

export { getDashboardPath } from './roles';

export type OperationalAccess = 'allowed' | 'blocked' | 'not_applicable';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'missing_profile'
  | 'invalid_role'
  | 'error';

export type AuthProfile = Omit<Profile, 'role'> & { role: SupportedDashboardRole };

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  status: AuthStatus;
  operationalAccess: OperationalAccess;
  mustChangeTemporaryPassword: boolean;
  error: string | null;
}

export async function fetchCurrentProfile() {
  if (isE2EAuthMockEnabled()) {
    const snapshot = getE2EMockAuthSnapshot();
    const role = snapshot.profile?.role;

    const operationalAccess: OperationalAccess =
      role === 'student' || role === 'tutor'
        ? 'allowed'
        : 'not_applicable';

    return {
      ...snapshot,
      mustChangeTemporaryPassword: false,
      operationalAccess,
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      session: null,
      profile: null,
      status: 'error' as const,
      operationalAccess: 'not_applicable' as const,
      mustChangeTemporaryPassword: false,
    };
  }

  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error) {
    captureAppError(sessionResult.error, {
      featureArea: 'auth',
      action: 'auth.get_session_failed',
    });

    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const authUserId = session?.user.id;

  if (!authUserId) {
    return {
      session: null,
      profile: null,
      status: 'unauthenticated' as const,
      operationalAccess: 'not_applicable' as const,
      mustChangeTemporaryPassword: false,
    };
  }

  const profileResult = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (profileResult.error) {
    captureAppError(profileResult.error, {
      featureArea: 'auth',
      action: 'auth.profile_load_failed',
      metadata: { has_auth_user: true },
    });

    throw profileResult.error;
  }

  if (!profileResult.data) {
    return {
      session,
      profile: null,
      status: 'missing_profile' as const,
      operationalAccess: 'not_applicable' as const,
      mustChangeTemporaryPassword: false,
    };
  }

  const role = normalizeUserRole((profileResult.data as Profile).role);

  if (!role) {
    return {
      session,
      profile: null,
      status: 'invalid_role' as const,
      operationalAccess: 'not_applicable' as const,
      mustChangeTemporaryPassword: false,
    };
  }

  let operationalAccess: OperationalAccess = 'not_applicable';

  if (role === 'student') {
    const accessResult = await supabase.rpc('current_active_student_id');

    if (accessResult.error) {
      captureAppError(accessResult.error, {
        featureArea: 'auth',
        action: 'auth.student_operational_access_failed',
      });

      throw accessResult.error;
    }

    operationalAccess = accessResult.data ? 'allowed' : 'blocked';
  }

  if (role === 'tutor') {
    const accessResult = await supabase.rpc(
      'current_approved_active_tutor_id',
    );

    if (accessResult.error) {
      captureAppError(accessResult.error, {
        featureArea: 'auth',
        action: 'auth.tutor_operational_access_failed',
      });

      throw accessResult.error;
    }

    operationalAccess = accessResult.data ? 'allowed' : 'blocked';
  }

  return {
    session,
    profile: {
      ...(profileResult.data as Profile),
      role,
    },
    status: 'authenticated' as const,
    operationalAccess,
    mustChangeTemporaryPassword: role === 'student' && session.user.app_metadata?.require_password_change === true,
  };
}

export async function signInWithPassword(email: string, password: string) {
  if (isE2EAuthMockEnabled()) {
    const snapshot = await signInWithE2EMock(email, password);
    return {
      ...snapshot,
    };
  }

  const client = requireSupabase();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) {
    captureAppError(result.error, {
      featureArea: 'auth',
      action: 'auth.password_sign_in_failed',
      metadata: { method: 'password' },
    });
    throw result.error;
  }

  return fetchCurrentProfile();
}

export async function sendMagicLink(email: string) {
  if (isE2EAuthMockEnabled()) {
    throw new Error(`Magic links are not used in E2E smoke mode. Sign in with ${email || 'a documented E2E test user'} and the shared test password.`);
  }

  const client = requireSupabase();
  const redirectTo = `${window.location.origin}/dashboard/login/`;
  const result = await client.auth.signInWithOtp({
    email,
    // Access is provisioned by an administrator. Never let the public magic
    // link form silently create an uninvited Auth identity.
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (result.error) {
    captureAppError(result.error, {
      featureArea: 'auth',
      action: 'auth.magic_link_failed',
      metadata: { method: 'magic_link' },
    });
    throw result.error;
  }
}

export async function signOut() {
  if (isE2EAuthMockEnabled()) {
    await signOutE2EMock();
    return;
  }

  const client = requireSupabase();
  const result = await client.auth.signOut();
  if (result.error) {
    captureAppError(result.error, {
      featureArea: 'auth',
      action: 'auth.sign_out_failed',
    });
    throw result.error;
  }
}
