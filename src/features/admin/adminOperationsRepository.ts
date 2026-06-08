import { apiGet, apiPost } from '../../lib/api/client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import type { AuditLogEntry, Profile } from '../../types/lms';

export interface AdminSession {
  id: string;
  tutor_name?: string;
  student_name?: string;
  subject?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  rate?: number | null;
  notes?: string | null;
  status: string;
}

export interface AdminSessionList {
  items: AdminSession[];
  total: number;
  page?: number;
  pageSize?: number;
  aggregates?: {
    countsByStatus?: Record<string, number>;
    totalMinutesSubmitted?: number;
  };
}

export interface PrivacyRequest {
  id: string;
  request_type: string;
  subject_type: string;
  subject_id: string;
  reason?: string | null;
  status: string;
  outcome?: string | null;
  created_at: string;
  closed_at?: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  actor?: { id: string; email?: string | null; role?: string | null } | null;
}

export interface RetentionSummary {
  config: Record<string, unknown>;
  cutoffs: Record<string, string>;
  eligible: Record<string, number>;
  latestEvent?: {
    id: string;
    ranAt: string;
    summary?: Record<string, unknown>;
  } | null;
}

export interface AuditList {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function loadApprovalQueue(params: URLSearchParams) {
  return apiGet<AdminSessionList>(`/admin/sessions?${params.toString()}`);
}

export function approveSession(sessionId: string) {
  return apiPost<{ session: AdminSession }>(`/admin/sessions/${sessionId}/approve`);
}

export function rejectSession(sessionId: string, reason?: string) {
  return apiPost<{ session: AdminSession }>(`/admin/sessions/${sessionId}/reject`, { reason });
}

export function loadPrivacyRequests(status = '') {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  return apiGet<{ requests: PrivacyRequest[]; total: number }>(`/admin/privacy-requests?${params.toString()}`);
}

export function createPrivacyRequest(input: { requestType: string; subjectType: string; subjectId: string; reason?: string }) {
  return apiPost<{ request: PrivacyRequest }>('/admin/privacy-requests', input);
}

export function closePrivacyRequest(requestId: string, input: { outcome?: string; note?: string }) {
  return apiPost<{ request: PrivacyRequest }>(`/admin/privacy-requests/${requestId}/close`, input);
}

export async function loadAuditEntries(params: URLSearchParams) {
  const supabaseList = await loadSupabaseAuditEntries(params);
  if (supabaseList) {
    return supabaseList;
  }
  return apiGet<AuditList>(`/admin/audit?${params.toString()}`);
}

export function loadRetentionSummary() {
  return apiGet<RetentionSummary>('/admin/retention/summary');
}

async function loadSupabaseAuditEntries(params: URLSearchParams): Promise<AuditList | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const page = Math.max(1, Number(params.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const action = params.get('action')?.trim();
  const entityType = params.get('entityType')?.trim();
  const actor = params.get('actor')?.trim();
  const dateFrom = params.get('dateFrom')?.trim();
  const dateTo = params.get('dateTo')?.trim();

  if (action) {
    query = query.ilike('action', `%${action}%`);
  }
  if (entityType) {
    query = query.ilike('entity_type', `%${entityType}%`);
  }
  if (actor) {
    query = query.eq('actor_user_id', actor);
  }
  if (dateFrom) {
    query = query.gte('created_at', new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte('created_at', end.toISOString());
  }

  const result = await query;
  if (result.error) {
    throw result.error;
  }

  const rows = (result.data || []) as AuditLogEntry[];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_user_id).filter(Boolean))) as string[];
  const profilesResult = actorIds.length
    ? await supabase.from('profiles').select('*').in('auth_user_id', actorIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const profilesByAuthId = new Map(((profilesResult.data || []) as Profile[]).map((profile) => [profile.auth_user_id, profile]));

  return {
    items: rows.map((row) => {
      const profile = row.actor_user_id ? profilesByAuthId.get(row.actor_user_id) : undefined;
      return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        correlationId: row.id,
        createdAt: row.created_at,
        metadata: row.metadata,
        actor: row.actor_user_id ? {
          id: row.actor_user_id,
          email: profile?.email ?? null,
          role: row.actor_role ?? profile?.role ?? null,
        } : null,
      };
    }),
    total: result.count ?? rows.length,
    page,
    pageSize,
  };
}
