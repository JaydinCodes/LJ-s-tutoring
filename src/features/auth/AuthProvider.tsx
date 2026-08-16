import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import {
  captureAppError,
  captureAppMessage,
  setMonitoringUserContext,
} from '../../lib/monitoring/errorReporting';
import {
  ADMIN_MFA_NOT_APPLICABLE,
  fetchCurrentProfile,
  type AuthState,
} from './authService';

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authConfigured = isSupabaseConfigured || isE2EAuthMockEnabled();
  const hasResolvedInitialAuth = useRef(false);
  const activeAuthUserId = useRef<string | null>(null);
  const latestRefreshId = useRef(0);
  const scheduledRefreshTimer = useRef<number | null>(null);

  const [state, setState] = useState<AuthState>({
    configured: authConfigured,
    loading: true,
    session: null,
    profile: null,
    status: 'loading',
    operationalAccess: 'not_applicable',
    adminMfa: ADMIN_MFA_NOT_APPLICABLE,
    mustChangeTemporaryPassword: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    const refreshId = ++latestRefreshId.current;
    const configured = isSupabaseConfigured || isE2EAuthMockEnabled();

    if (!configured) {
      hasResolvedInitialAuth.current = true;
      activeAuthUserId.current = null;
      setState({
        configured: false,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        operationalAccess: 'not_applicable',
        adminMfa: ADMIN_MFA_NOT_APPLICABLE,
        mustChangeTemporaryPassword: false,
        error:
          'The sign-in service is temporarily unavailable. Please contact support if you need urgent access.',
      });

      return;
    }

    // Only the first auth lookup is allowed to block protected routes. Later
    // access checks run behind the current screen so an automatic token
    // refresh cannot unmount a form and discard the user's unsaved work.
    if (!hasResolvedInitialAuth.current) {
      setState((current) => ({
        ...current,
        configured,
        loading: true,
        status: 'loading',
        error: null,
      }));
    }

    try {
      const {
        session,
        profile,
        status,
        operationalAccess,
        adminMfa,
        mustChangeTemporaryPassword,
      } = await fetchCurrentProfile();

      if (refreshId !== latestRefreshId.current) {
        return;
      }

      const statusError =
        status === 'missing_profile'
          ? 'Your account setup is incomplete. Please contact support so we can finish linking your profile.'
          : status === 'invalid_role'
            ? 'Your profile has a role that is not enabled for this portal.'
            : null;

      hasResolvedInitialAuth.current = true;
      activeAuthUserId.current = session?.user.id ?? null;
      setState({
        configured,
        loading: false,
        session,
        profile,
        status,
        operationalAccess,
        adminMfa,
        mustChangeTemporaryPassword,
        error: statusError,
      });
    } catch (error) {
      if (refreshId !== latestRefreshId.current) {
        return;
      }

      captureAppError(error, {
        featureArea: 'auth',
        action: 'auth.refresh_failed',
      });

      const message =
        error instanceof Error
          ? error.message
          : 'Could not load your account session.';

      if (hasResolvedInitialAuth.current) {
        // A temporary background-check failure must not behave like a sign
        // out. RLS still protects every request, and the next auth event can
        // retry without destroying the current page state.
        setState((current) => ({
          ...current,
          configured,
          loading: false,
          error: message,
        }));
        return;
      }

      hasResolvedInitialAuth.current = true;
      activeAuthUserId.current = null;
      setState({
        configured,
        loading: false,
        session: null,
        profile: null,
        status: 'error',
        operationalAccess: 'not_applicable',
        adminMfa: ADMIN_MFA_NOT_APPLICABLE,
        mustChangeTemporaryPassword: false,
        error: message,
      });
    }
  }, []);

  const scheduleBackgroundRefresh = useCallback(() => {
    if (scheduledRefreshTimer.current !== null) {
      return;
    }

    scheduledRefreshTimer.current = window.setTimeout(() => {
      scheduledRefreshTimer.current = null;
      void refresh();
    }, 0);
  }, [refresh]);

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

    if (
      !state.loading &&
      state.status === 'authenticated' &&
      state.operationalAccess === 'blocked'
    ) {
      captureAppMessage('Operational account access blocked', {
        featureArea: 'auth',
        action: 'auth.operational_access_blocked',
        role: state.profile?.role ?? null,
        metadata: {
          profile_id: state.profile?.id ?? null,
        },
      });
    }
  }, [
    state.loading,
    state.operationalAccess,
    state.profile?.id,
    state.profile?.role,
    state.session,
    state.status,
  ]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase holds its auth lock while notifying listeners. Starting a
      // second auth request here can deadlock getSession()/getUser() and leave
      // protected routes permanently on their loading screen.
      if (event === 'SIGNED_OUT') {
        latestRefreshId.current += 1;
        hasResolvedInitialAuth.current = true;
        activeAuthUserId.current = null;
        setState({
          configured: true,
          loading: false,
          session: null,
          profile: null,
          status: 'unauthenticated',
          operationalAccess: 'not_applicable',
          adminMfa: ADMIN_MFA_NOT_APPLICABLE,
          mustChangeTemporaryPassword: false,
          error: null,
        });
        return;
      }

      if (session) {
        if (event !== 'INITIAL_SESSION') {
          // Any new auth event supersedes an older access lookup, even when
          // the event is handled without blocking the current page.
          latestRefreshId.current += 1;
        }

        const identityChanged =
          activeAuthUserId.current !== null &&
          activeAuthUserId.current !== session.user.id;

        activeAuthUserId.current = session.user.id;

        if (identityChanged) {
          // Never keep the previous user's profile on screen while a new
          // identity is being resolved. A genuine account switch is the one
          // auth transition that intentionally returns to the blocking gate.
          hasResolvedInitialAuth.current = false;
          setState({
            configured: true,
            loading: true,
            session,
            profile: null,
            status: 'loading',
            operationalAccess: 'not_applicable',
            adminMfa: ADMIN_MFA_NOT_APPLICABLE,
            mustChangeTemporaryPassword: false,
            error: null,
          });
        } else {
          // Keep the fresh JWT available immediately without putting the
          // route guard back into its blocking "Checking access" state.
          setState((current) => ({
            ...current,
            session,
            mustChangeTemporaryPassword:
              current.profile?.role === 'student' &&
              session.user.app_metadata?.require_password_change === true,
          }));
        }
      }

      if (event !== 'INITIAL_SESSION') {
        scheduleBackgroundRefresh();
      }
    });

    return () => {
      data.subscription.unsubscribe();
      if (scheduledRefreshTimer.current !== null) {
        window.clearTimeout(scheduledRefreshTimer.current);
        scheduledRefreshTimer.current = null;
      }
    };
  }, [scheduleBackgroundRefresh]);

  const value = useMemo(
    () => ({ ...state, refresh }),
    [state, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
