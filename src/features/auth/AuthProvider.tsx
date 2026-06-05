import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { fetchCurrentProfile, type AuthState } from './authService';

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    configured: isSupabaseConfigured,
    loading: true,
    session: null,
    profile: null,
    status: 'loading',
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState({
        configured: false,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        error: 'The sign-in service is temporarily unavailable. Please contact support if you need urgent access.',
      });
      return;
    }

    setState((current) => ({ ...current, configured: true, loading: true, status: 'loading', error: null }));
    try {
      const { session, profile, status } = await fetchCurrentProfile();
      const statusError = status === 'missing_profile'
        ? 'Your account setup is incomplete. Please contact support so we can finish linking your profile.'
        : status === 'invalid_role'
          ? 'Your profile has a role that is not enabled for this portal.'
          : null;
      setState({ configured: true, loading: false, session, profile, status, error: statusError });
    } catch (error) {
      setState({
        configured: true,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not load your account session.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
