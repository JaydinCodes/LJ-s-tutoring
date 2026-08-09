import { isSupabaseConfigured, requireSupabase, supabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { AuditLogEntry, PrivacyRequestRecord, PrivacyRequestType, Profile, SessionRecord, Student, Tutor } from '../../types/lms';
import type { Database } from '../../types/database';

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

// Session status in Supabase (session_status enum) is lowercase; the existing
// AdminApprovalsRoute contract was written against Fastify's uppercase
// Prisma-era strings ('SUBMITTED'/'APPROVED'/...). Mapping here keeps the
// component unchanged.
function mapAdminSessionRow(row: SessionRecord, tutorName?: string, studentName?: string): AdminSession {
  return {
    id: row.id,
    tutor_name: tutorName,
    student_name: studentName,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    notes: row.notes,
    status: row.status.toUpperCase(),
  };
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

// Student subjects only -- the Supabase schema has no tutor-subject path (see
// process_privacy_request() in docs/supabase/schema.sql, which raises if
// subject_student_id is null). "Closing" a request always runs the real
// export/anonymize action; there is no separate manual-close-with-a-note path.
export interface PrivacyRequest {
  id: string;
  request_type: PrivacyRequestType;
  subject_student_id: string | null;
  subject_student_name?: string;
  reason?: string | null;
  status: string;
  result: Record<string, unknown>;
  processing_state?: PrivacyRequestRecord['processing_state'];
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  storage_files_removed?: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
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

export async function loadApprovalQueue(params: URLSearchParams): Promise<AdminSessionList> {
  const client = requireSupabase();

  const status = params.get('status')?.toLowerCase();
  const sessionStatuses = ['draft', 'submitted', 'approved', 'rejected'] as const;
  const page = Math.max(1, Number(params.get('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(params.get('pageSize') || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const ascending = params.get('order') === 'asc';

  let query = client
    .from('sessions')
    .select('*', { count: 'exact' })
    .order('date', { ascending })
    .order('start_time', { ascending })
    .range(from, to);
  const selectedSessionStatus = sessionStatuses.find((candidate) => candidate === status);
  if (selectedSessionStatus) {
    query = query.eq('status', selectedSessionStatus);
  }

  const sessionsResult = await query;
  if (sessionsResult.error) {
    throw sessionsResult.error;
  }
  const rows = (sessionsResult.data || []) as SessionRecord[];

  const tutorIds = Array.from(new Set(rows.map((row) => row.tutor_id)));
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const [tutorsResult, studentsResult] = await Promise.all([
    tutorIds.length ? client.from('tutors').select('*').in('id', tutorIds) : Promise.resolve({ data: [], error: null }),
    studentIds.length ? client.from('students').select('*').in('id', studentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (tutorsResult.error) {
    throw tutorsResult.error;
  }
  if (studentsResult.error) {
    throw studentsResult.error;
  }
  const tutors = (tutorsResult.data || []) as Tutor[];
  const students = (studentsResult.data || []) as Student[];
  const tutorById = new Map(tutors.map((tutor) => [tutor.id, tutor]));
  const studentById = new Map(students.map((student) => [student.id, student]));

  const profileIds = Array.from(new Set([
    ...tutors.map((tutor) => tutor.profile_id),
    ...students.map((student) => student.profile_id),
  ].filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const profileById = new Map(((profilesResult.data || []) as Profile[]).map((profile) => [profile.id, profile]));

  return {
    // aggregates intentionally omitted: AdminApprovalsRoute already falls back
    // to computing summary counts from the current page when this is undefined.
    items: rows.map((row) => {
      const tutorName = profileById.get(tutorById.get(row.tutor_id)?.profile_id ?? '')?.full_name;
      const studentName = profileById.get(studentById.get(row.student_id)?.profile_id ?? '')?.full_name;
      return mapAdminSessionRow(row, tutorName, studentName);
    }),
    total: sessionsResult.count ?? rows.length,
    page,
    pageSize,
  };
}

export async function approveSession(sessionId: string): Promise<{ session: AdminSession }> {
  const client = requireSupabase();
  const session = await callRpc(client, 'approve_session', { p_session_id: sessionId });
  return { session: mapAdminSessionRow(session) };
}

export async function rejectSession(sessionId: string, reason?: string): Promise<{ session: AdminSession }> {
  const client = requireSupabase();
  const session = await callRpc(client, 'reject_session', { p_session_id: sessionId, p_reason: reason ?? '' });
  return { session: mapAdminSessionRow(session) };
}

// UI keeps Fastify's OPEN/CLOSED filter labels; Supabase's record_status
// distinguishes 'pending' (open, not yet processed) from 'approved' (a
// request that has run its export/correction/deletion and closed).
const PRIVACY_STATUS_FILTER: Record<string, Database['public']['Enums']['record_status']> = { OPEN: 'pending', CLOSED: 'approved' };

function mapPrivacyRequest(row: PrivacyRequestRecord, studentName?: string): PrivacyRequest {
  return {
    id: row.id,
    request_type: row.request_type,
    subject_student_id: row.subject_student_id,
    subject_student_name: studentName,
    reason: row.notes,
    status: row.status,
    result: row.result,
    processing_state: row.processing_state,
    processing_started_at: row.processing_started_at,
    processing_completed_at: row.processing_completed_at,
    storage_files_removed: row.storage_files_removed,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function loadPrivacyRequests(status = ''): Promise<{ requests: PrivacyRequest[]; total: number }> {
  const client = requireSupabase();
  let query = client.from('privacy_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const mappedStatus = PRIVACY_STATUS_FILTER[status];
  if (mappedStatus) {
    query = query.eq('status', mappedStatus);
  }

  const result = await query;
  if (result.error) {
    throw result.error;
  }
  const rows = (result.data || []) as PrivacyRequestRecord[];

  const studentIds = Array.from(new Set(
    rows
      .map((row) => row.subject_student_id)
      .filter((studentId): studentId is string => Boolean(studentId)),
  ));
  const studentsResult = studentIds.length
    ? await client.from('students').select('*').in('id', studentIds)
    : { data: [], error: null };
  if (studentsResult.error) {
    throw studentsResult.error;
  }
  const students = (studentsResult.data || []) as Student[];
  const profileIds = Array.from(new Set(students.map((student) => student.profile_id).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const profileById = new Map(((profilesResult.data || []) as Profile[]).map((profile) => [profile.id, profile]));
  const studentNameById = new Map(students.map((student) => [student.id, profileById.get(student.profile_id)?.full_name || student.id]));

  return {
    requests: rows.map((row) => mapPrivacyRequest(row, studentNameById.get(row.subject_student_id ?? ''))),
    total: result.count ?? rows.length,
  };
}

export async function createPrivacyRequest(input: { requestType: PrivacyRequestType; subjectId: string; reason?: string }): Promise<{ request: PrivacyRequest }> {
  const client = requireSupabase();

  const { data: auth } = await client.auth.getUser();
  const authUserId = auth.user?.id;
  const requestingProfile = authUserId
    ? ((await client.from('profiles').select('*').eq('auth_user_id', authUserId).single()).data as Profile | null)
    : null;

  const result = await (client.from('privacy_requests') as unknown as {
    insert: (payload: {
      subject_student_id: string;
      request_type: PrivacyRequestType;
      notes: string | null;
      requested_by: string | null;
    }) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  }).insert({
    subject_student_id: input.subjectId,
    request_type: input.requestType,
    notes: input.reason ?? null,
    requested_by: requestingProfile?.id ?? null,
  }).select('*').single();
  if (result.error) {
    throw result.error;
  }
  return { request: mapPrivacyRequest(result.data as PrivacyRequestRecord) };
}

async function readPrivacyDeletionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json() as { error?: unknown; stage?: unknown };
      const code = typeof body.error === 'string' ? body.error : null;
      const stage = typeof body.stage === 'string' ? body.stage : null;
      if (code) {
        return stage ? `${code}:${stage}` : code;
      }
    } catch {
      // Fall through to the generic FunctionsHttpError message.
    }
  }
  return error instanceof Error ? error.message : 'privacy_deletion_failed';
}

function readablePrivacyDeletionError(raw: string) {
  if (raw.includes('admin_mfa_required')) {
    return 'Admin MFA is required before deleting learner data.';
  }
  if (raw.includes('admin_required')) {
    return 'Only platform administrators can process deletion requests.';
  }
  if (raw.includes('rate_limited')) {
    return 'Too many deletion attempts were made. Wait a few minutes and retry.';
  }
  if (raw.includes('privacy_request_not_found')) {
    return 'This privacy request no longer exists.';
  }
  if (raw.includes('privacy_request_is_not_deletion')) {
    return 'This request is not a deletion request.';
  }
  if (raw.includes('supabase_bearer_required') || raw.includes('supabase_bearer_invalid')) {
    return 'Your admin session is no longer valid. Sign in again and retry.';
  }
  if (raw.includes('privacy_deletion_failed')) {
    return 'Deletion stopped before completion. The learner remains locked; retry the request after checking the recorded stage.';
  }
  return raw;
}

export async function closePrivacyRequest(
  requestId: string,
  requestType: PrivacyRequestType,
): Promise<{ request: PrivacyRequest }> {
  const client = requireSupabase();

  if (requestType === 'deletion') {
    const invokeResult = await client.functions.invoke('process-privacy-deletion', {
      body: { requestId },
    });
    if (invokeResult.error) {
      const raw = await readPrivacyDeletionError(invokeResult.error);
      throw new Error(readablePrivacyDeletionError(raw));
    }
  } else {
    await callRpc(client, 'process_privacy_request', { p_request_id: requestId });
  }

  const result = await client.from('privacy_requests').select('*').eq('id', requestId).single();
  if (result.error) {
    throw result.error;
  }
  return { request: mapPrivacyRequest(result.data as PrivacyRequestRecord) };
}

export async function loadAuditEntries(params: URLSearchParams): Promise<AuditList> {
  const supabaseList = await loadSupabaseAuditEntries(params);
  if (!supabaseList) {
    throw new Error('supabase_not_configured');
  }
  return supabaseList;
}

export async function loadRetentionSummary(): Promise<RetentionSummary> {
  const client = requireSupabase();
  const raw = await callRpc(client, 'run_retention_cleanup', { p_apply: false }) as unknown as {
    as_of: string;
    windows_years: Record<string, number>;
    eligible: Record<string, number>;
  };

  // run_retention_cleanup() returns window LENGTHS (years), not cutoff dates --
  // derive the same cutoffs it computes internally from as_of, so the UI can
  // show actual dates without a second RPC.
  const asOf = new Date(raw.as_of);
  const cutoffs: Record<string, string> = {};
  for (const [key, years] of Object.entries(raw.windows_years)) {
    const cutoff = new Date(asOf);
    cutoff.setFullYear(cutoff.getFullYear() - years);
    cutoffs[key] = cutoff.toISOString();
  }

  const latestEventResult = await client
    .from('audit_log')
    .select('*')
    .eq('action', 'retention.cleanup_applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRow = latestEventResult.data as AuditLogEntry | null;

  return {
    cutoffs,
    eligible: raw.eligible,
    latestEvent: latestRow ? { id: latestRow.id, ranAt: latestRow.created_at, summary: latestRow.metadata } : null,
  };
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
