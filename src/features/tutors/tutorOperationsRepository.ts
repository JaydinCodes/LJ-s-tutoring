import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import { weeklyReportPayload } from '../../lib/schema/json';
import type { Database } from '../../types/database';
import type { Profile, SessionRecord, StudentScoreSnapshotRecord, TutorAllocatedStudentSummary, WeeklyReportPayload, WeeklyReportRecord } from '../../types/lms';

export interface TutorSession {
  id: string;
  assignment_id?: string;
  student_id?: string;
  student_name?: string;
  studentName?: string;
  date?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  duration_minutes?: number;
  mode?: string;
  location?: string | null;
  notes?: string | null;
  status: string;
  attendance_status?: string | null;
  topics_covered?: string | null;
  learner_struggles?: string | null;
  homework_assigned?: string | null;
  student_summary?: string | null;
  tutor_private_notes?: string | null;
}

export interface TutorWeeklyReport {
  id: string;
  student_id?: string;
  student_name?: string;
  week_start?: string;
  weekStart?: string;
  week_end?: string;
  weekEnd?: string;
  created_at?: string;
  createdAt?: string;
  payload?: WeeklyReportPayload;
}

export interface TutorRiskScore {
  id?: string;
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  riskScore?: number;
  risk_score?: number;
  momentumScore?: number;
  momentum_score?: number;
  reasons?: Array<string | { label?: string; detail?: string }>;
  modelReasons?: Array<string | { label?: string; detail?: string }>;
}

async function getCurrentTutorId(): Promise<string> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in with a tutor account before managing sessions.');
  }

  const profileResult = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (profileResult.error) {
    throw profileResult.error;
  }
  const profile = profileResult.data as Profile | null;
  if (!profile || profile.role !== 'tutor') {
    throw new Error('Session management is only available to tutor profiles.');
  }

  const tutorResult = await client.from('tutors').select('id').eq('profile_id', profile.id).single();
  if (tutorResult.error) {
    throw tutorResult.error;
  }
  const tutor = tutorResult.data as { id: string } | null;
  if (!tutor) {
    throw new Error('No tutor record is linked to the current profile.');
  }
  return tutor.id;
}

export async function loadTutorAllocatedStudents(
  client = requireSupabase(),
): Promise<TutorAllocatedStudentSummary[]> {
  const result = await client.rpc('get_tutor_allocated_students');
  if (result.error) {
    throw result.error;
  }
  return (result.data || []) as TutorAllocatedStudentSummary[];
}

// Session status in Supabase (session_status enum) is lowercase; the existing
// component contract (TutorSessionsRoute, SessionReportPanel) was written
// against Fastify's uppercase Prisma-era strings ('DRAFT'/'SUBMITTED'/...).
// Uppercasing here keeps every consumer unchanged.
function mapSessionRow(row: SessionRecord, studentName?: string): TutorSession {
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: studentName,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    mode: row.mode,
    location: row.location,
    notes: row.notes,
    status: row.status.toUpperCase(),
    attendance_status: row.attendance_status,
    topics_covered: row.topics_covered,
    learner_struggles: row.learner_struggles,
    homework_assigned: row.homework_assigned,
    student_summary: row.student_summary,
    tutor_private_notes: row.tutor_private_notes,
  };
}

export async function loadTutorSessions(): Promise<{ sessions: TutorSession[] }> {
  if (isE2EAuthMockEnabled()) {
    return { sessions: [] };
  }

  const client = requireSupabase();
  const tutorId = await getCurrentTutorId();

  const sessionsResult = await client
    .from('sessions')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });
  if (sessionsResult.error) {
    throw sessionsResult.error;
  }
  const rows = (sessionsResult.data || []) as SessionRecord[];

  const allocatedStudents = await loadTutorAllocatedStudents(client);
  const studentNameById = new Map(allocatedStudents.map((student) => [student.student_id, student.full_name]));

  return {
    sessions: rows.map((row) => mapSessionRow(row, studentNameById.get(row.student_id))),
  };
}

export async function saveTutorSessionReport(sessionId: string, input: {
  attendanceStatus?: string;
  topicsCovered?: string;
  learnerStruggles?: string;
  homeworkAssigned?: string;
  studentSummary?: string;
  tutorPrivateNotes?: string;
}): Promise<{ session: TutorSession }> {
  const client = requireSupabase();
  const session = await callRpc(client, 'submit_session_report', {
    p_session_id: sessionId,
    p_attendance_status: input.attendanceStatus ?? '',
    p_topics_covered: input.topicsCovered ?? '',
    p_learner_struggles: input.learnerStruggles ?? '',
    p_homework_assigned: input.homeworkAssigned ?? '',
    p_tutor_private_notes: input.tutorPrivateNotes ?? '',
    p_student_summary: input.studentSummary ?? '',
  });
  return { session: mapSessionRow(session) };
}

export async function submitTutorSession(sessionId: string): Promise<{ session: TutorSession }> {
  const client = requireSupabase();
  const session = await callRpc(client, 'submit_session', { p_session_id: sessionId });
  return { session: mapSessionRow(session) };
}

// Monday of the week containing `date`, matching generate_weekly_report()'s
// own date_trunc('week', ...) math (ISO weeks start on Monday).
function mondayOf(date: Date): string {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

type DbWeeklyReport = Database['public']['Tables']['weekly_reports']['Row'];
type DbStudentScoreSnapshot = Database['public']['Tables']['student_score_snapshots']['Row'];

function mapReport(row: DbWeeklyReport, studentName?: string): TutorWeeklyReport {
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: studentName,
    week_start: row.week_start,
    week_end: row.week_end,
    created_at: row.created_at,
    payload: weeklyReportPayload(row.payload_json),
  };
}

export async function loadTutorReports(): Promise<{ items: TutorWeeklyReport[] }> {
  const client = requireSupabase();

  // RLS already scopes weekly_reports to the caller's own active-allocation
  // students (see docs/supabase/schema.sql), so no explicit tutor_id filter is needed.
  const reportsResult = await client.from('weekly_reports').select('*').order('week_start', { ascending: false });
  if (reportsResult.error) {
    throw reportsResult.error;
  }
  const rows = reportsResult.data || [];

  const allocatedStudents = await loadTutorAllocatedStudents(client);
  const studentNameById = new Map(allocatedStudents.map((student) => [student.student_id, student.full_name]));

  return {
    items: rows.map((row) => mapReport(row, studentNameById.get(row.student_id))),
  };
}

export async function loadTutorReport(reportId: string): Promise<{ report: TutorWeeklyReport }> {
  const client = requireSupabase();
  const result = await client.from('weekly_reports').select('*').eq('id', reportId).single();
  if (result.error) {
    throw result.error;
  }
  return { report: mapReport(result.data) };
}

export async function regenerateTutorReport(studentId: string): Promise<{ report: TutorWeeklyReport }> {
  const client = requireSupabase();
  const report = await callRpc(client, 'generate_weekly_report', {
    p_student_id: studentId,
    p_week_start: mondayOf(new Date()),
  });
  return { report: mapReport(report) };
}

export async function loadTutorRiskScores(): Promise<{ items: TutorRiskScore[] }> {
  const client = requireSupabase();
  const tutorId = await getCurrentTutorId();

  const allocationsResult = await client
    .from('tutor_student_allocations')
    .select('student_id')
    .eq('tutor_id', tutorId)
    .eq('status', 'active');
  if (allocationsResult.error) {
    throw allocationsResult.error;
  }
  const allocationRows = (allocationsResult.data || []) as Array<{ student_id: string }>;
  const studentIds = Array.from(new Set(allocationRows.map((row) => row.student_id)));
  if (!studentIds.length) {
    return { items: [] };
  }

  // No RPC needed here -- GET /tutor/scores never triggers a recompute, it
  // only ever reads the latest existing snapshot per student. RLS already
  // scopes student_score_snapshots to the caller's own active-allocation
  // students. There's no "distinct on"/"top-1-per-group" via PostgREST, so
  // the latest-per-student reduction happens client-side after ordering by
  // score_date desc -- fine at this scale (one row per student per day).
  const snapshotsResult = await client
    .from('student_score_snapshots')
    .select('*')
    .in('student_id', studentIds)
    .order('score_date', { ascending: false });
  if (snapshotsResult.error) {
    throw snapshotsResult.error;
  }
  const snapshots = snapshotsResult.data || [];
  const latestByStudent = new Map<string, DbStudentScoreSnapshot>();
  for (const snapshot of snapshots) {
    if (!latestByStudent.has(snapshot.student_id)) {
      latestByStudent.set(snapshot.student_id, snapshot);
    }
  }

  const allocatedStudents = await loadTutorAllocatedStudents(client);
  const studentNameById = new Map(allocatedStudents.map((student) => [student.student_id, student.full_name]));

  return {
    items: studentIds.map((studentId) => {
      const snapshot = latestByStudent.get(studentId);
      return {
        id: snapshot?.id,
        student_id: studentId,
        student_name: studentNameById.get(studentId),
        risk_score: snapshot?.risk_score,
        momentum_score: snapshot?.momentum_score,
        reasons: Array.isArray(snapshot?.reasons_json)
          ? snapshot.reasons_json
            .map((reason): string | { label?: string; detail?: string } | null => {
              if (typeof reason === 'string') return reason;
              if (reason && !Array.isArray(reason) && typeof reason === 'object') {
                return { label: typeof reason.label === 'string' ? reason.label : undefined, detail: typeof reason.detail === 'string' ? reason.detail : undefined };
              }
              return null;
            })
            .filter((reason): reason is string | { label?: string; detail?: string } => reason !== null)
          : undefined,
      };
    }),
  };
}
