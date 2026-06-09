const isLocalHost = (value: string) => value === 'localhost' || value === '127.0.0.1';

declare global {
  interface Window {
    __PO_API_BASE__?: string;
  }
}

async function supabaseAccessToken() {
  const { supabase } = await import('../supabase/client');
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  return session?.access_token ?? '';
}

export function resolveApiBase() {
  const configured = (import.meta.env.VITE_PO_API_BASE || window.__PO_API_BASE__) as string | undefined;
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
  // Transitional Fastify endpoints still enforce double-submit CSRF while they move to Supabase bearer auth.
  return csrfToken ? { 'x-csrf-token': csrfToken } : {};
}

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = await supabaseAccessToken();
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    credentials: 'include',
    headers: { accept: 'application/json', ...(await authHeaders()) },
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
      ...(await authHeaders()),
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
      ...(await authHeaders()),
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
      ...(await authHeaders()),
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
      ...(await authHeaders()),
      ...csrfHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(`api_html_response:${response.status}`);
  }
  if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/event-stream')) {
    throw new Error(`api_unexpected_stream_response:${response.status}`);
  }

  if (!response.body) {
    throw new Error('api_stream_unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let hasAcceptedContent = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    if (!hasAcceptedContent && /^(\s*)(<!doctype\s+html|<html[\s>])/i.test(chunk)) {
      throw new Error(`api_html_response:${response.status}`);
    }
    hasAcceptedContent = true;
    onChunk(chunk);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    if (!hasAcceptedContent && /^(\s*)(<!doctype\s+html|<html[\s>])/i.test(finalChunk)) {
      throw new Error(`api_html_response:${response.status}`);
    }
    onChunk(finalChunk);
  }
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
