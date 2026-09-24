// The report is built in PostgreSQL. A PostgREST table response is capped at
// 1,000 rows, so browser-side aggregation would silently undercount at scale.
import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import { jsonArray, jsonObject } from '../../lib/schema/json';
import type { Json } from '../../../supabase/types/public.generated';

export interface ReportGuardianRecipient {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  relationship_type: string;
  communication_preference: string;
  can_receive_reports: boolean;
  is_primary: boolean;
}

export interface StudentProgressReport {
  student_id: string;
  student_name: string;
  grade?: string | null;
  school?: string | null;
  ngo_partner?: string | null;
  guardians: ReportGuardianRecipient[];
  released_results: Array<{
    submission_id: string;
    assignment_title: string;
    subject_name: string;
    marks_awarded: number;
    feedback?: string | null;
    released_at?: string | null;
    submitted_at?: string | null;
  }>;
  progress_topics: Array<{
    topic: string;
    score: number;
    subject_name: string;
    recorded_at: string;
  }>;
  average_mark: number | null;
  pending_submissions: number;
  latest_released_at?: string | null;
}

export interface NgoProgressReport {
  ngo_partner_id: string;
  ngo_partner_name: string;
  student_count: number;
  released_results: number;
  average_mark: number | null;
  active_classes: number;
  progress_topic_count: number;
}

export interface AdminProgressReportsView {
  students: StudentProgressReport[];
  ngoReports: NgoProgressReport[];
  summary: {
    studentReports: number;
    guardianRecipients: number;
    ngoReports: number;
    releasedResults: number;
  };
}

export async function loadAdminProgressReports(): Promise<AdminProgressReportsView> {
  const client = requireSupabase();
  const value = await callRpc(client, 'get_admin_progress_reports', {});
  const report = jsonObject(value, 'admin progress report');
  // The database is the aggregation authority; validate the top-level shape
  // before passing it to the presentation DTO.
  if (!Array.isArray(report.students) || !Array.isArray(report.ngoReports) || !report.summary || Array.isArray(report.summary) || typeof report.summary !== 'object') {
    throw new Error('Admin progress report has an invalid shape.');
  }
  jsonArray(report.students, 'admin progress report.students');
  jsonArray(report.ngoReports, 'admin progress report.ngoReports');
  return JSON.parse(JSON.stringify(report)) as AdminProgressReportsView;
}

export type AdminLearningAggregate = {
  masteryDistribution: Record<string, number>;
  activitiesCompleted: number;
  manualReviewsPending: number;
  retention: { due: number; completed: number; passed: number; failed: number };
};

export async function loadAdminLearningAggregate(): Promise<AdminLearningAggregate> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_admin_learning_aggregate') => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_admin_learning_aggregate');
  if (error) throw error;
  const value = jsonObject(data as Json | undefined, 'admin learning aggregate');
  return {
    masteryDistribution: typeof value.masteryDistribution === 'object' && value.masteryDistribution && !Array.isArray(value.masteryDistribution) ? value.masteryDistribution as Record<string, number> : {},
    activitiesCompleted: Number(value.activitiesCompleted ?? 0),
    manualReviewsPending: Number(value.manualReviewsPending ?? 0),
    retention: typeof value.retention === 'object' && value.retention && !Array.isArray(value.retention) ? value.retention as AdminLearningAggregate['retention'] : { due: 0, completed: 0, passed: 0, failed: 0 },
  };
}
