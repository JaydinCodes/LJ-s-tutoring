import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../../types/lms';
import type { SupportedDashboardRole } from '../../features/auth/roles';

export const E2E_AUTH_STORAGE_KEY = 'project-odysseus:e2e-auth';

export const E2E_TEST_PASSWORD = 'ProjectOdysseus!23';

export const E2E_TEST_USERS: Record<SupportedDashboardRole, { email: string; fullName: string }> = {
  admin: { email: 'admin.e2e@projectodysseus.test', fullName: 'Admin E2E' },
  ngo_partner: { email: 'ngo.e2e@projectodysseus.test', fullName: 'NGO Partner E2E' },
  parent: { email: 'parent.e2e@projectodysseus.test', fullName: 'Guardian E2E' },
  student: { email: 'student.e2e@projectodysseus.test', fullName: 'Student E2E' },
  tutor: { email: 'tutor.e2e@projectodysseus.test', fullName: 'Tutor E2E' },
};

interface StoredE2EAuth {
  role: SupportedDashboardRole;
  email: string;
}

export function isE2EAuthMockEnabled() {
  return !import.meta.env.PROD && import.meta.env.VITE_E2E_AUTH_MOCK === 'true';
}

export function getE2EMockPassword() {
  return (import.meta.env.VITE_E2E_AUTH_PASSWORD as string | undefined) || E2E_TEST_PASSWORD;
}

export function getE2ECurrentRole() {
  return getStoredE2EAuth()?.role ?? null;
}

export function getE2EMockAuthSnapshot() {
  const stored = getStoredE2EAuth();
  if (!stored) {
    return { session: null, profile: null, status: 'unauthenticated' as const };
  }

  const profile = makeProfile(stored.role, stored.email);
  return {
    session: makeSession(profile),
    profile,
    status: 'authenticated' as const,
  };
}

export async function signInWithE2EMock(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const matched = Object.entries(E2E_TEST_USERS).find(([, user]) => user.email === normalizedEmail);
  if (!matched || password !== getE2EMockPassword()) {
    throw new Error('Incorrect email or password for the E2E smoke test account.');
  }

  const role = matched[0] as SupportedDashboardRole;
  storeE2EAuth({ role, email: normalizedEmail });
  return getE2EMockAuthSnapshot();
}

export async function signOutE2EMock() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
}

function getStoredE2EAuth(): StoredE2EAuth | null {
  if (!isE2EAuthMockEnabled() || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredE2EAuth>;
    if (!parsed.role || !parsed.email || !(parsed.role in E2E_TEST_USERS)) {
      return null;
    }
    return { role: parsed.role as SupportedDashboardRole, email: parsed.email };
  } catch {
    return null;
  }
}

function storeE2EAuth(value: StoredE2EAuth) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(E2E_AUTH_STORAGE_KEY, JSON.stringify(value));
}

function makeProfile(role: SupportedDashboardRole, email: string): Profile {
  const user = E2E_TEST_USERS[role];
  const now = new Date('2026-06-08T08:00:00.000Z').toISOString();
  return {
    id: `e2e-profile-${role}`,
    auth_user_id: `e2e-auth-${role}`,
    full_name: user.fullName,
    email,
    phone: null,
    role,
    created_at: now,
    updated_at: now,
  };
}

function makeSession(profile: Profile): Session {
  return {
    access_token: `e2e-access-token-${profile.role}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `e2e-refresh-token-${profile.role}`,
    user: {
      id: profile.auth_user_id,
      aud: 'authenticated',
      role: 'authenticated',
      email: profile.email,
      email_confirmed_at: profile.created_at,
      phone: '',
      app_metadata: {},
      user_metadata: { full_name: profile.full_name, role: profile.role },
      identities: [],
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
  } as Session;
}
