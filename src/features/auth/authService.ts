import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase, supabase } from '../../lib/supabase/client';
import type { Profile, UserRole } from '../../types/lms';

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
}

export function getDashboardPath(role?: UserRole | null) {
  if (role === 'admin') {
    return '/dashboard/admin';
  }
  if (role === 'tutor') {
    return '/dashboard/tutor';
  }
  return '/dashboard/student';
}

export async function fetchCurrentProfile() {
  if (!isSupabaseConfigured || !supabase) {
    return { session: null, profile: null };
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const authUserId = session?.user.id;
  if (!authUserId) {
    return { session: null, profile: null };
  }

  const profileResult = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle();
  if (profileResult.error) {
    throw profileResult.error;
  }

  return { session, profile: profileResult.data as Profile | null };
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
