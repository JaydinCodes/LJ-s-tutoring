import type { Session } from '@supabase/supabase-js';
import { getE2EMockAuthSnapshot, isE2EAuthMockEnabled, signInWithE2EMock, signOutE2EMock } from '../../lib/e2e/mockAuth';
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

export type AdminMfaStatus =
  | 'not_applicable'
  | 'verified'
  | 'required'
  | 'setup_required'
  | 'unavailable'
  | 'dev_bypass';

export interface AdminMfaState {
  status: AdminMfaStatus;
  currentLevel: string | null;
  nextLevel: string | null;
  factorId: string | null;
  error: string | null;
}

export interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  status: AuthStatus;
  adminMfa: AdminMfaState;
  error: string | null;
}

type MfaFactorLike = {
  id?: string;
  factor_type?: string;
  status?: string;
};

export const ADMIN_MFA_NOT_APPLICABLE: AdminMfaState = {
  status: 'not_applicable',
  currentLevel: null,
  nextLevel: null,
  factorId: null,
  error: null,
};

function isLocalAdminMfaBypassEnabled() {
  return !import.meta.env.PROD && import.meta.env.VITE_PO_DEV_ADMIN_MFA_BYPASS === 'true';
}

function findVerifiedTotpFactor(factors: unknown) {
  const groupedFactors = factors as Partial<Record<'totp' | 'all', MfaFactorLike[]>>;
  const candidates = [...(groupedFactors.totp ?? []), ...(groupedFactors.all ?? [])];
  return candidates.find((factor) => factor.id && factor.factor_type === 'totp' && factor.status === 'verified') ?? null;
}

export async function getAdminMfaState(): Promise<AdminMfaState> {
  if (isLocalAdminMfaBypassEnabled()) {
    return {
      status: 'dev_bypass',
      currentLevel: 'dev_bypass',
      nextLevel: 'dev_bypass',
      factorId: null,
      error: null,
    };
  }

  const client = requireSupabase();
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) {
    return {
      status: 'unavailable',
      currentLevel: null,
      nextLevel: null,
      factorId: null,
      error: assurance.error.message,
    };
  }

  const currentLevel = assurance.data.currentLevel ?? null;
  const nextLevel = assurance.data.nextLevel ?? null;
  if (currentLevel === 'aal2') {
    return { status: 'verified', currentLevel, nextLevel, factorId: null, error: null };
  }

  const factorResult = await client.auth.mfa.listFactors();
  if (factorResult.error) {
    return {
      status: 'unavailable',
      currentLevel,
      nextLevel,
      factorId: null,
      error: factorResult.error.message,
    };
  }

  const verifiedTotpFactor = findVerifiedTotpFactor(factorResult.data);
  if (!verifiedTotpFactor?.id) {
    return {
      status: 'setup_required',
      currentLevel,
      nextLevel,
      factorId: null,
      error: 'A verified Supabase TOTP factor is required for admin access.',
    };
  }

  return {
    status: 'required',
    currentLevel,
    nextLevel,
    factorId: verifiedTotpFactor.id,
    error: null,
  };
}

export async function challengeAdminMfa(factorId: string) {
  const client = requireSupabase();
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error) {
    throw challenge.error;
  }

  return { challengeId: challenge.data.id };
}

export async function verifyAdminMfa(input: { factorId: string; challengeId: string; code: string }) {
  const client = requireSupabase();
  const verification = await client.auth.mfa.verify(input);
  if (verification.error) {
    throw verification.error;
  }

  return verification.data;
}

export async function fetchCurrentProfile() {
  if (isE2EAuthMockEnabled()) {
    const snapshot = getE2EMockAuthSnapshot();
    return {
      ...snapshot,
      adminMfa: snapshot.profile?.role === 'admin'
        ? { status: 'dev_bypass', currentLevel: 'dev_bypass', nextLevel: 'dev_bypass', factorId: null, error: null } satisfies AdminMfaState
        : ADMIN_MFA_NOT_APPLICABLE,
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { session: null, profile: null, status: 'error' as const, adminMfa: ADMIN_MFA_NOT_APPLICABLE };
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const authUserId = session?.user.id;
  if (!authUserId) {
    return { session: null, profile: null, status: 'unauthenticated' as const, adminMfa: ADMIN_MFA_NOT_APPLICABLE };
  }

  const profileResult = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle();
  if (profileResult.error) {
    throw profileResult.error;
  }

  if (!profileResult.data) {
    return { session, profile: null, status: 'missing_profile' as const, adminMfa: ADMIN_MFA_NOT_APPLICABLE };
  }

  const role = normalizeUserRole((profileResult.data as Profile).role);
  if (!role) {
    return { session, profile: null, status: 'invalid_role' as const, adminMfa: ADMIN_MFA_NOT_APPLICABLE };
  }

  const adminMfa = role === 'admin' ? await getAdminMfaState() : ADMIN_MFA_NOT_APPLICABLE;

  return {
    session,
    profile: { ...(profileResult.data as Profile), role },
    status: 'authenticated' as const,
    adminMfa,
  };
}

export async function signInWithPassword(email: string, password: string) {
  if (isE2EAuthMockEnabled()) {
    const snapshot = await signInWithE2EMock(email, password);
    return {
      ...snapshot,
      adminMfa: snapshot.profile?.role === 'admin'
        ? { status: 'dev_bypass', currentLevel: 'dev_bypass', nextLevel: 'dev_bypass', factorId: null, error: null } satisfies AdminMfaState
        : ADMIN_MFA_NOT_APPLICABLE,
    };
  }

  const client = requireSupabase();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) {
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
    options: { emailRedirectTo: redirectTo },
  });
  if (result.error) {
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
    throw result.error;
  }
}
