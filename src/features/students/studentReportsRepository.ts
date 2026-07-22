import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { WeeklyReportPayload, WeeklyReportRecord } from '../../types/lms';

export interface WeeklyReportListItem {
  id: string;
  week_start?: string;
  weekStart?: string;
  week_end?: string;
  weekEnd?: string;
  created_at?: string;
  createdAt?: string;
}

export interface WeeklyReport {
  id: string;
  weekStart?: string;
  weekEnd?: string;
  week_start?: string;
  week_end?: string;
  createdAt?: string;
  created_at?: string;
  payload?: WeeklyReportPayload;
}

function mapReport(row: WeeklyReportRecord): WeeklyReport {
  return {
    id: row.id,
    week_start: row.week_start,
    week_end: row.week_end,
    created_at: row.created_at,
    payload: row.payload_json,
  };
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

async function getCurrentStudentId(): Promise<string> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in with a student account before viewing reports.');
  }

  const profileResult = await client.from('profiles').select('id').eq('auth_user_id', authUserId).single();
  if (profileResult.error) {
    throw profileResult.error;
  }
  const profile = profileResult.data as { id: string };

  const studentResult = await client.from('students').select('id').eq('profile_id', profile.id).single();
  if (studentResult.error) {
    throw studentResult.error;
  }
  const student = studentResult.data as { id: string };
  return student.id;
}

export async function loadWeeklyReports(): Promise<{ items: WeeklyReportListItem[] }> {
  const client = requireSupabase();
  const studentId = await getCurrentStudentId();

  const result = await client
    .from('weekly_reports')
    .select('id, week_start, week_end, created_at')
    .eq('student_id', studentId)
    .order('week_start', { ascending: false });
  if (result.error) {
    throw result.error;
  }

  return { items: (result.data || []) as WeeklyReportListItem[] };
}

export async function loadWeeklyReport(reportId: string): Promise<{ report: WeeklyReport }> {
  const client = requireSupabase();
  const result = await client.from('weekly_reports').select('*').eq('id', reportId).single();
  if (result.error) {
    throw result.error;
  }
  return { report: mapReport(result.data as WeeklyReportRecord) };
}

export async function generateWeeklyReport(): Promise<{ report: WeeklyReport }> {
  const client = requireSupabase();
  const studentId = await getCurrentStudentId();
  const report = await callRpc(client, 'generate_weekly_report', {
    p_student_id: studentId,
    p_week_start: mondayOf(new Date()),
  });
  return { report: mapReport(report) };
}
