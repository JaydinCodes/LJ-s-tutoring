const isLocalHost = (value: string) => value === 'localhost' || value === '127.0.0.1';

export function resolveApiBase() {
  const configured = import.meta.env.VITE_PO_API_BASE as string | undefined;
  const raw = String(configured || '').replace(/\/$/, '');
  const host = window.location.hostname;

  if (!raw) {
    return isLocalHost(host) ? `${window.location.protocol}//${host}:3001` : '/api';
  }

  if (isLocalHost(host) && raw === '/api') {
    return `${window.location.protocol}//${host}:3001`;
  }

  return raw;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `request_failed:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function optionalApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('404') || message.includes('501') || message.includes('Failed to fetch')) {
      return fallback;
    }
    throw error;
  }
}
