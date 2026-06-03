const isLocalHost = (value: string) => value === 'localhost' || value === '127.0.0.1';

export function resolveApiBase() {
  const configured = (import.meta.env.VITE_PO_API_BASE || import.meta.env.PUBLIC_PO_API_BASE) as string | undefined;
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

function readCookie(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function csrfHeaders(): Record<string, string> {
  const csrfToken = readCookie('csrf');
  // The LMS API enforces double-submit CSRF for authenticated writes.
  return csrfToken ? { 'x-csrf-token': csrfToken } : {};
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

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`api_non_json_response:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...csrfHeaders(),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`api_non_json_response:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...csrfHeaders(),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`api_non_json_response:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...csrfHeaders(),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`api_non_json_response:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiStreamText(
  path: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      accept: 'text/plain',
      'content-type': 'application/json',
      ...csrfHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  if (!response.body) {
    throw new Error('api_stream_unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) onChunk(finalChunk);
}

export async function optionalApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('404') || message.includes('501') || message.includes('Failed to fetch') || message.includes('api_non_json_response')) {
      return fallback;
    }
    throw error;
  }
}
