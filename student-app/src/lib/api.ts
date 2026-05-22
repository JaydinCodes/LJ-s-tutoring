import type { AssignmentItem, CareerOverview, DashboardData, OptionalItemsResult, ResultsItem } from '../types';

const isLocalHost = (value: string) => value === 'localhost' || value === '127.0.0.1';

export function resolveApiBase() {
  const raw = String(window.__PO_API_BASE__ || '').replace(/\/$/, '');
  const host = window.location.hostname;

  if (!raw || raw === '__PO_API_BASE__') {
    return isLocalHost(host) ? `${window.location.protocol}//${host}:3001` : '/api';
  }

  if (isLocalHost(host) && raw === '/api') {
    return `${window.location.protocol}//${host}:3001`;
  }

  try {
    const parsed = new URL(raw);
    if (isLocalHost(host) && isLocalHost(parsed.hostname) && parsed.hostname !== host) {
      parsed.hostname = host;
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return raw;
  }

  return raw;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: 'include',
  });
  return response;
}

export async function loadJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `request_failed:${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function optionalJson<T>(path: string, keys: string[]): Promise<OptionalItemsResult<T>> {
  try {
    const payload = await loadJson<Record<string, unknown>>(path);
    const items = keys.flatMap((key) => Array.isArray(payload[key]) ? [payload[key] as T[]] : [])[0] || [];
    return { available: true, items, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('404') || message.includes('501')) {
      return { available: false, items: [] };
    }
    throw error;
  }
}

export const studentApi = {
  session: () => window.__PO_STUDENT_AUTH__ ?? Promise.resolve(null),
  dashboard: () => loadJson<DashboardData>('/dashboard'),
  assignments: () => optionalJson<AssignmentItem>('/student/assignments', ['assignments', 'items']),
  results: () => optionalJson<ResultsItem>('/student/results', ['results', 'items']),
  classStats: () => optionalJson<Record<string, unknown>>('/student/class-stats', ['stats', 'items']),
  careersOverview: () => loadJson<CareerOverview>('/odie-careers/overview'),
  careersChat: (body: { message: string; conversationId?: string | null }) =>
    loadJson<{ conversationId?: string | null; message?: string; text?: string }>('/assistant/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'student',
        persona: 'study_coach',
        subject: 'Career pathways',
        careerPathwayContext: 'The learner is using the new student careers dashboard for pathway advice, APS planning, and study planning.',
        ...body,
      }),
    }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};
