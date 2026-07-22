import { apiGet, apiPost } from '../../lib/api/client';
import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { Profile, SessionRecord, Student } from '../../types/lms';

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
  payload?: {
    sessionsAttended?: number;
    minutesStudied?: number;
    summary?: string;
  };
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

async function optionalTutorGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('501') ||
      message.includes('Failed to fetch')
    ) {
      return fallback;
    }
    throw error;
  }
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

  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const studentsResult = studentIds.length
    ? await client.from('students').select('*').in('id', studentIds)
    : { data: [], error: null };
  if (studentsResult.error) {
    throw studentsResult.error;
  }
  const students = (studentsResult.data || []) as Student[];
  const studentById = new Map(students.map((student) => [student.id, student]));

  const profileIds = Array.from(new Set(students.map((student) => student.profile_id).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const profileById = new Map(((profilesResult.data || []) as Profile[]).map((profile) => [profile.id, profile]));

  return {
    sessions: rows.map((row) => {
      const student = studentById.get(row.student_id);
      const studentName = student ? profileById.get(student.profile_id)?.full_name : undefined;
      return mapSessionRow(row, studentName);
    }),
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
    p_attendance_status: input.attendanceStatus ?? null,
    p_topics_covered: input.topicsCovered ?? null,
    p_learner_struggles: input.learnerStruggles ?? null,
    p_homework_assigned: input.homeworkAssigned ?? null,
    p_tutor_private_notes: input.tutorPrivateNotes ?? null,
    p_student_summary: input.studentSummary ?? null,
  });
  return { session: mapSessionRow(session) };
}

export async function submitTutorSession(sessionId: string): Promise<{ session: TutorSession }> {
  const client = requireSupabase();
  const session = await callRpc(client, 'submit_session', { p_session_id: sessionId });
  return { session: mapSessionRow(session) };
}

export function loadTutorReports() {
  return optionalTutorGet<{ items: TutorWeeklyReport[]; total?: number }>('/tutor/reports', { items: [] });
}

export function loadTutorReport(reportId: string) {
  return apiGet<{ report: TutorWeeklyReport }>(`/reports/${encodeURIComponent(reportId)}`);
}

export function regenerateTutorReport(studentId: string) {
  return apiPost<{ report: TutorWeeklyReport }>('/reports/generate', { studentId });
}

export function loadTutorRiskScores() {
  return optionalTutorGet<{ items: TutorRiskScore[]; total?: number }>('/tutor/scores?page=1&pageSize=25', { items: [] });
}
