import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase, supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/lms';
import { getDashboardPath, normalizeUserRole, type SupportedDashboardRole } from './roles';

export { getDashboardPath } from './roles';

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
  error: string | null;
}

export async function fetchCurrentProfile() {
  if (!isSupabaseConfigured || !supabase) {
    return { session: null, profile: null, status: 'error' as const };
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const authUserId = session?.user.id;
  if (!authUserId) {
    return { session: null, profile: null, status: 'unauthenticated' as const };
  }

  const profileResult = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle();
  if (profileResult.error) {
    throw profileResult.error;
  }

  if (!profileResult.data) {
    return { session, profile: null, status: 'missing_profile' as const };
  }

  const role = normalizeUserRole((profileResult.data as Profile).role);
  if (!role) {
    return { session, profile: null, status: 'invalid_role' as const };
  }

  return {
    session,
    profile: { ...(profileResult.data as Profile), role },
    status: 'authenticated' as const,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireSupabase();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) {
    throw result.error;
  }

  return fetchCurrentProfile();
}

export async function sendMagicLink(email: string) {
  const client = requireSupabase();
  const redirectTo = `${window.location.origin}/dashboard/login/`;
  const result = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (result.error) {
    throw result.error;
  }
}

export async function signOut() {
  const client = requireSupabase();
  const result = await client.auth.signOut();
  if (result.error) {
    throw result.error;
  }
}
