import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2EParentReports } from '../../lib/e2e/mockRoleData';
import { requireSupabase } from '../../lib/supabase/client';
import type { ParentProgressReportRow } from '../../types/lms';

export interface ParentReportStudent {
  student_id: string;
  student_name: string;
  grade?: string | null;
  school?: string | null;
  released_results: Array<{
    assignment_title: string;
    marks_awarded: number;
    feedback?: string | null;
    released_at?: string | null;
  }>;
  latest_topic?: {
    topic: string;
    score: number;
  } | null;
  average_mark: number | null;
}

export async function loadParentProgressReports(): Promise<{ students: ParentReportStudent[] }> {
  if (isE2EAuthMockEnabled()) {
    return getE2EParentReports();
  }

  const client = requireSupabase();
  const result = await client.rpc('get_parent_progress_reports');
  if (result.error) {
    throw result.error;
  }

  const rows = (result.data || []) as ParentProgressReportRow[];
  const grouped = new Map<string, ParentReportStudent>();

  for (const row of rows) {
    const current = grouped.get(row.student_id) ?? {
      student_id: row.student_id,
      student_name: row.student_name,
      grade: row.grade,
      school: row.school,
      released_results: [],
      latest_topic: row.topic ? { topic: row.topic, score: Number(row.topic_score ?? 0) } : null,
      average_mark: null,
    };

    if (row.assignment_title && row.marks_awarded != null) {
      current.released_results.push({
        assignment_title: row.assignment_title,
        marks_awarded: Number(row.marks_awarded),
        feedback: row.feedback,
        released_at: row.released_at,
      });
    }

    if (!current.latest_topic && row.topic) {
      current.latest_topic = { topic: row.topic, score: Number(row.topic_score ?? 0) };
    }

    grouped.set(row.student_id, current);
  }

  const students = Array.from(grouped.values()).map((student) => ({
    ...student,
    average_mark: average(student.released_results.map((resultRow) => resultRow.marks_awarded)),
  }));

  return { students };
}

function average(values: number[]) {
  const cleanValues = values.filter(Number.isFinite);
  if (!cleanValues.length) return null;
  return Math.round((cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length) * 10) / 10;
}
