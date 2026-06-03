import type { Assignment, StudentDashboardView, StudentProgress } from './lms';
import type { CareerOverview, StudentCareerProfile } from '../features/students/studentCareersRepository';
import type { StudentResultsAnalyticsView } from '../features/students/studentResultsRepository';

type RecordValue = Record<string, unknown>;

export interface StudentAssignmentsApiResponse {
  assignments: Array<Assignment & {
    submission_id?: string;
    submission_status?: string;
    submitted_at?: string;
    original_filename?: string;
    mime_type?: string;
    size_bytes?: number;
    version_number?: number;
    is_latest?: boolean;
    submission_versions?: Array<{
      id: string;
      status?: string;
      submitted_at?: string;
      original_filename?: string;
      mime_type?: string;
      size_bytes?: number;
      version_number?: number;
      is_latest?: boolean;
      file_url?: string;
    }>;
  }>;
}

export interface StudentDashboardApiResponse {
  profile?: {
    id?: string;
    name?: string;
    grade?: string;
    school?: string;
    guardian?: { name?: string };
    partnerAffiliation?: string;
  };
  academicProfile?: { grade?: string; school?: string };
  attendance?: { attended?: number; total?: number };
  streak?: { current?: number };
  progressSnapshot?: Array<{ topic: string; completion: number }>;
  examCalendar?: StudentDashboardView['examCalendar'];
  supportStatus?: StudentDashboardView['supportStatus'];
  recommendedNext?: StudentDashboardView['recommendedNext'];
  recommendedQuiz?: StudentDashboardView['recommendedQuiz'];
  careerGoals?: StudentDashboardView['careerGoals'];
  dailyInsightContext?: StudentDashboardView['dailyInsightContext'];
}

export interface StudentResultsApiResponse extends StudentResultsAnalyticsView {}
export interface StudentMasteryApiItem extends StudentProgress {}

export interface StudentQuizApiItem {
  id: string;
  title: string;
  topic: string;
  estimatedMinutes?: number;
  createdAt?: string;
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asArray<T>(value: unknown, mapper: (item: unknown, index: number) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((item): item is T => item != null);
}

function parseAssignment(item: unknown): StudentAssignmentsApiResponse['assignments'][number] | null {
  if (!isRecord(item)) return null;
  const id = asString(item.id);
  if (!id) return null;
  return {
    ...(item as unknown as Assignment),
    id,
    title: asString(item.title) || 'Assignment',
    status: asString(item.status) || 'published',
    created_at: asString(item.created_at) || asString(item.createdAt) || new Date(0).toISOString(),
    submission_versions: asArray(item.submission_versions, (version) => {
      if (!isRecord(version) || !asString(version.id)) return null;
      return {
        id: asString(version.id)!,
        status: asString(version.status),
        submitted_at: asString(version.submitted_at),
        original_filename: asString(version.original_filename),
        mime_type: asString(version.mime_type),
        size_bytes: asNumber(version.size_bytes),
        version_number: asNumber(version.version_number),
        is_latest: typeof version.is_latest === 'boolean' ? version.is_latest : undefined,
        file_url: asString(version.file_url),
      };
    }),
  };
}

export function parseStudentAssignmentsApiResponse(value: unknown): StudentAssignmentsApiResponse {
  const payload = isRecord(value) ? value : {};
  const source = Array.isArray(payload.assignments) ? payload.assignments : payload.items;
  return { assignments: asArray(source, parseAssignment) };
}

export function parseStudentDashboardApiResponse(value: unknown): StudentDashboardApiResponse {
  const payload = isRecord(value) ? value : {};
  return {
    profile: isRecord(payload.profile) ? payload.profile as StudentDashboardApiResponse['profile'] : undefined,
    academicProfile: isRecord(payload.academicProfile) ? payload.academicProfile as StudentDashboardApiResponse['academicProfile'] : undefined,
    attendance: isRecord(payload.attendance) ? payload.attendance as StudentDashboardApiResponse['attendance'] : undefined,
    streak: isRecord(payload.streak) ? payload.streak as StudentDashboardApiResponse['streak'] : undefined,
    progressSnapshot: asArray(payload.progressSnapshot, (item) => {
      if (!isRecord(item)) return null;
      const topic = asString(item.topic);
      const completion = asNumber(item.completion);
      return topic && completion != null ? { topic, completion } : null;
    }),
    examCalendar: isRecord(payload.examCalendar) ? payload.examCalendar as StudentDashboardApiResponse['examCalendar'] : undefined,
    supportStatus: isRecord(payload.supportStatus) ? payload.supportStatus as StudentDashboardApiResponse['supportStatus'] : undefined,
    recommendedNext: isRecord(payload.recommendedNext) ? payload.recommendedNext as StudentDashboardApiResponse['recommendedNext'] : undefined,
    recommendedQuiz: isRecord(payload.recommendedQuiz) ? payload.recommendedQuiz as StudentDashboardApiResponse['recommendedQuiz'] : undefined,
    careerGoals: Array.isArray(payload.careerGoals) ? payload.careerGoals as StudentDashboardApiResponse['careerGoals'] : [],
    dailyInsightContext: isRecord(payload.dailyInsightContext) ? payload.dailyInsightContext as StudentDashboardApiResponse['dailyInsightContext'] : undefined,
  };
}

export function parseStudentResultsApiResponse(value: unknown): StudentResultsApiResponse | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.summary)) return null;
  return value as unknown as StudentResultsApiResponse;
}

export function parseStudentCareersApiResponse(value: unknown, fallback: CareerOverview): CareerOverview {
  const payload = isRecord(value) ? value : {};
  const profile = isRecord(payload.profile) ? payload.profile as unknown as StudentCareerProfile : fallback.profile;
  return {
    careers: Array.isArray(payload.careers) ? payload.careers as CareerOverview['careers'] : fallback.careers,
    institutions: Array.isArray(payload.institutions) ? payload.institutions as CareerOverview['institutions'] : fallback.institutions,
    supportedSubjects: Array.isArray(payload.supportedSubjects) ? payload.supportedSubjects as string[] : fallback.supportedSubjects,
    profile,
  };
}

export function parseStudentMasteryItems(value: unknown): StudentMasteryApiItem[] {
  return asArray(value, (item, index) => {
    if (!isRecord(item)) return null;
    const topic = asString(item.topic);
    const score = asNumber(item.score ?? item.completion);
    if (!topic || score == null) return null;
    return {
      id: asString(item.id) || `mastery-${index}`,
      student_id: asString(item.student_id) || 'current',
      subject: asString(item.subject),
      topic,
      score,
      cognitive_level: asString(item.cognitive_level) || null,
      recorded_at: asString(item.recorded_at) || new Date(0).toISOString(),
    };
  });
}

export function parseStudentQuizItems(value: unknown): StudentQuizApiItem[] {
  return asArray(value, (item) => {
    if (!isRecord(item)) return null;
    const id = asString(item.id);
    const topic = asString(item.topic);
    if (!id || !topic) return null;
    return {
      id,
      title: asString(item.title) || `${topic} quiz`,
      topic,
      estimatedMinutes: asNumber(item.estimatedMinutes),
      createdAt: asString(item.createdAt),
    };
  });
}
