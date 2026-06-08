import * as Sentry from '@sentry/react';

type MonitoringPrimitive = string | number | boolean | null;

export interface MonitoringContext {
  featureArea?: string;
  action?: string;
  role?: string | null;
  route?: string;
  metadata?: Record<string, unknown>;
}

export interface MonitoringUserContext {
  authUserId?: string | null;
  profileId?: string | null;
  role?: string | null;
}

const sensitiveKeyPattern = /(email|name|phone|contact|parent|guardian|feedback|note|notes|answer|file|filename|password|token|secret|mark|marks|score|rubric)/i;
const monitoringEnabled = import.meta.env.PROD
  && Boolean(import.meta.env.VITE_SENTRY_DSN)
  && import.meta.env.VITE_SENTRY_ENABLED !== 'false';

export function initErrorReporting() {
  if (!monitoringEnabled) {
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || 'production',
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    sampleRate: readRate(import.meta.env.VITE_SENTRY_SAMPLE_RATE, 1),
    sendDefaultPii: false,
    beforeSend(event) {
      const sanitized = { ...event };
      if (sanitized.user) {
        sanitized.user = {
          id: typeof sanitized.user.id === 'string' ? sanitized.user.id : undefined,
        };
      }
      sanitized.contexts = sanitizeObject(sanitized.contexts) as typeof sanitized.contexts;
      sanitized.extra = sanitizeObject(sanitized.extra) as typeof sanitized.extra;
      return sanitized;
    },
  });
}

export function setMonitoringUserContext(context: MonitoringUserContext) {
  if (!monitoringEnabled) {
    return;
  }

  Sentry.setUser(context.authUserId ? { id: context.authUserId } : null);
  Sentry.setTag('role', context.role || 'anonymous');
  Sentry.setContext('project_odysseus_user', sanitizeObject({
    profile_id: context.profileId,
    role: context.role,
  }));
}

export function captureAppError(error: unknown, context: MonitoringContext = {}) {
  if (!monitoringEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    applyContext(scope, context);
    Sentry.captureException(error instanceof Error ? error : new Error(String(error || 'Unknown error')));
  });
}

export function captureAppMessage(message: string, context: MonitoringContext = {}) {
  if (!monitoringEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    applyContext(scope, context);
    Sentry.captureMessage(message);
  });
}

function applyContext(scope: Sentry.Scope, context: MonitoringContext) {
  const route = context.route || getCurrentRoute();
  scope.setTag('route', route);
  scope.setTag('feature_area', context.featureArea || inferFeatureAreaFromRoute(route));
  if (context.action) {
    scope.setTag('action', context.action);
  }
  if (context.role) {
    scope.setTag('role', context.role);
  }
  scope.setContext('project_odysseus', sanitizeObject({
    feature_area: context.featureArea || inferFeatureAreaFromRoute(route),
    action: context.action,
    route,
    metadata: context.metadata || {},
  }));
}

function readRate(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function sanitizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKeyPattern.test(key)) {
      output[key] = '[Filtered]';
      continue;
    }

    if (raw == null || typeof raw === 'boolean' || typeof raw === 'number') {
      output[key] = raw as MonitoringPrimitive;
      continue;
    }

    if (typeof raw === 'string') {
      output[key] = raw.length > 160 ? `${raw.slice(0, 160)}...` : raw;
      continue;
    }

    if (Array.isArray(raw)) {
      output[key] = `[Array:${raw.length}]`;
      continue;
    }

    if (typeof raw === 'object') {
      output[key] = sanitizeObject(raw);
    }
  }
  return output;
}

function getCurrentRoute() {
  if (typeof window === 'undefined') {
    return 'server';
  }
  return window.location.pathname || '/';
}

function inferFeatureAreaFromRoute(route: string) {
  if (route.includes('/admin')) return 'admin';
  if (route.includes('/tutor')) return 'tutor';
  if (route.includes('/parent')) return 'parent';
  if (route.includes('/ngo')) return 'ngo';
  if (route.includes('/student/assignments')) return 'assignments';
  if (route.includes('/student/results')) return 'results';
  if (route.includes('/student')) return 'student';
  if (route.includes('/login')) return 'auth';
  return 'public';
}
