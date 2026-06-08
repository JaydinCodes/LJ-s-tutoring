import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { captureAppError, captureAppMessage, setMonitoringUserContext } from '../../lib/monitoring/errorReporting';
import { ADMIN_MFA_NOT_APPLICABLE, fetchCurrentProfile, type AuthState } from './authService';

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authConfigured = isSupabaseConfigured || isE2EAuthMockEnabled();
  const [state, setState] = useState<AuthState>({
    configured: authConfigured,
    loading: true,
    session: null,
    profile: null,
    status: 'loading',
    adminMfa: ADMIN_MFA_NOT_APPLICABLE,
    error: null,
  });

  const refresh = useCallback(async () => {
    const configured = isSupabaseConfigured || isE2EAuthMockEnabled();
    if (!configured) {
      setState({
        configured: false,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        adminMfa: ADMIN_MFA_NOT_APPLICABLE,
        error: 'The sign-in service is temporarily unavailable. Please contact support if you need urgent access.',
      });
      return;
    }

    setState((current) => ({ ...current, configured, loading: true, status: 'loading', error: null }));
    try {
      const { session, profile, status, adminMfa } = await fetchCurrentProfile();
      const statusError = status === 'missing_profile'
        ? 'Your account setup is incomplete. Please contact support so we can finish linking your profile.'
        : status === 'invalid_role'
          ? 'Your profile has a role that is not enabled for this portal.'
          : null;
      setState({ configured, loading: false, session, profile, status, adminMfa, error: statusError });
    } catch (error) {
      captureAppError(error, {
        featureArea: 'auth',
        action: 'auth.refresh_failed',
      });
      setState({
        configured,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        adminMfa: ADMIN_MFA_NOT_APPLICABLE,
        error: error instanceof Error ? error.message : 'Could not load your account session.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setMonitoringUserContext({
      authUserId: state.session?.user.id ?? null,
      profileId: state.profile?.id ?? null,
      role: state.profile?.role ?? null,
    });

    if (!state.loading && state.status === 'missing_profile') {
      captureAppMessage('Auth profile missing', {
        featureArea: 'auth',
        action: 'auth.missing_profile',
        role: null,
        metadata: {
          has_session: Boolean(state.session),
        },
      });
    }

    if (!state.loading && state.status === 'invalid_role') {
      captureAppMessage('Auth profile role invalid', {
        featureArea: 'auth',
        action: 'auth.invalid_role',
        metadata: {
          has_session: Boolean(state.session),
        },
      });
    }
  }, [state.loading, state.profile?.id, state.profile?.role, state.session, state.status]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
