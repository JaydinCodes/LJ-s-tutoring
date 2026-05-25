import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/lms';
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
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState({
        configured: false,
        loading: false,
        session: null,
        profile: null,
        error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      });
      return;
    }

    setState((current) => ({ ...current, configured: true, loading: true, error: null }));
    try {
      const { session, profile } = await fetchCurrentProfile();
      setState({ configured: true, loading: false, session, profile: profile as Profile | null, error: null });
    } catch (error) {
      setState({
        configured: true,
        loading: false,
        session: null,
        profile: null,
        error: error instanceof Error ? error.message : 'Could not load Supabase session.',
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
