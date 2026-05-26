import { apiGet, apiPatch, apiPost } from '../../lib/api/client';

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

export function loadTutorSessions() {
  return optionalTutorGet<{ sessions: TutorSession[]; items?: TutorSession[]; total?: number }>('/tutor/sessions', { sessions: [] });
}

export function saveTutorSessionReport(sessionId: string, input: {
  attendanceStatus?: string;
  topicsCovered?: string;
  learnerStruggles?: string;
  homeworkAssigned?: string;
  studentSummary?: string;
  tutorPrivateNotes?: string;
}) {
  return apiPatch<{ session: TutorSession }>(`/tutor/sessions/${sessionId}/report`, input);
}

export function submitTutorSession(sessionId: string) {
  return apiPost<{ session: TutorSession }>(`/tutor/sessions/${sessionId}/submit`, {});
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
