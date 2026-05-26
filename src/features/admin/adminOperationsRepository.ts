import { apiGet, apiPost } from '../../lib/api/client';

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

export function loadAuditEntries(params: URLSearchParams) {
  return apiGet<AuditList>(`/admin/audit?${params.toString()}`);
}

export function loadRetentionSummary() {
  return apiGet<RetentionSummary>('/admin/retention/summary');
}
