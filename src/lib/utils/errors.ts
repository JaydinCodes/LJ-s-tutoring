import { captureAppError } from '../monitoring/errorReporting';

export function getTechnicalErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unexpected error';
}

export function toUserFacingError(error: unknown) {
  const message = getTechnicalErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('jwt expired')
    || normalized.includes('refresh token')
    || normalized.includes('invalid session')
    || normalized.includes('session_not_found')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  if (
    normalized.includes('permission denied')
    || normalized.includes('row-level security')
    || normalized.includes('violates row-level security')
    || normalized.includes('rls')
    || normalized.includes('42501')
  ) {
    return 'You do not have permission to view or change this information. If this looks wrong, contact support.';
  }

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('network')
    || normalized.includes('timeout')
  ) {
    return 'The portal could not reach the server. Check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}

export function logTechnicalError(scope: string, error: unknown) {
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[Project Odysseus] ${scope}`, error);
  }
  captureAppError(error, {
    featureArea: 'async_resource',
    action: scope,
  });
}
