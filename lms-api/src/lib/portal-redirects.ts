export type PortalRole = 'ADMIN' | 'TUTOR' | 'STUDENT';

export type PortalRedirectEnv = Partial<Record<'ADMIN_PORTAL_URL' | 'TUTOR_PORTAL_URL' | 'STUDENT_PORTAL_URL', string>>;

const ROLE_DASHBOARD_PATH: Record<PortalRole, string> = {
  ADMIN: '/dashboard/admin/',
  TUTOR: '/dashboard/tutor/',
  STUDENT: '/dashboard/student/'
};

const ROLE_ENV_KEY: Record<PortalRole, keyof PortalRedirectEnv> = {
  ADMIN: 'ADMIN_PORTAL_URL',
  TUTOR: 'TUTOR_PORTAL_URL',
  STUDENT: 'STUDENT_PORTAL_URL'
};

const LOGIN_PATH = '/dashboard/login/';

function portalOrigin(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    // Portal env vars are origins, but parsing also strips accidental path config safely.
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function appendPath(origin: string, path: string): string {
  return origin ? `${origin}${path}` : path;
}

export function portalRedirectTarget(role: PortalRole, env: PortalRedirectEnv = process.env): string {
  const origin = portalOrigin(env[ROLE_ENV_KEY[role]]);
  return appendPath(origin, ROLE_DASHBOARD_PATH[role]);
}

export function portalRedirectTargetForRole(role: string | undefined, env: PortalRedirectEnv = process.env): string {
  // Unknown roles are never sent to a private dashboard; use the student origin login route as the safest portal fallback.
  if (role === 'ADMIN' || role === 'TUTOR' || role === 'STUDENT') {
    return portalRedirectTarget(role, env);
  }
  return safePortalFallback(env);
}

export function portalLoginTarget(role: PortalRole, env: PortalRedirectEnv = process.env): string {
  const origin = portalOrigin(env[ROLE_ENV_KEY[role]]);
  return appendPath(origin, LOGIN_PATH);
}

export function safePortalFallback(env: Pick<PortalRedirectEnv, 'STUDENT_PORTAL_URL'> = process.env): string {
  return appendPath(portalOrigin(env.STUDENT_PORTAL_URL), LOGIN_PATH);
}
