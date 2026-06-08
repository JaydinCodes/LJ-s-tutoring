import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2ENgoReports } from '../../lib/e2e/mockRoleData';
import { captureAppError } from '../../lib/monitoring/errorReporting';
import { requireSupabase } from '../../lib/supabase/client';
import type { Assignment, AssignmentSubmission, ClassEnrollment, ClassRecord, NgoPartner, Student, StudentProgress } from '../../types/lms';

export interface NgoAggregateReport {
  ngo_partner_id: string;
  ngo_partner_name: string;
  student_count: number;
  released_results: number;
  average_mark: number | null;
  active_classes: number;
  progress_topic_count: number;
}

export async function loadNgoReports(): Promise<{ reports: NgoAggregateReport[] }> {
  if (isE2EAuthMockEnabled()) {
    return getE2ENgoReports();
  }

  const client = requireSupabase();
  const [partnersResult, studentsResult, submissionsResult, assignmentsResult, classesResult, enrollmentsResult, progressResult] = await Promise.all([
    client.from('ngo_partners').select('*').order('name', { ascending: true }),
    client.from('students').select('*'),
    client.from('assignment_submissions').select('id,assignment_id,student_id,marks_awarded,marks_released'),
    client.from('assignments').select('id'),
    client.from('classes').select('*').eq('status', 'active'),
    client.from('class_enrollments').select('*').eq('status', 'active'),
    client.from('student_progress').select('id,student_id'),
  ]);

  for (const result of [partnersResult, studentsResult, submissionsResult, assignmentsResult, classesResult, enrollmentsResult, progressResult]) {
    if (result.error) {
      captureAppError(result.error, {
        featureArea: 'ngo',
        action: 'ngo_reports.load_failed',
        role: 'ngo_partner',
      });
      throw result.error;
    }
  }

  const partners = (partnersResult.data || []) as NgoPartner[];
  const students = (studentsResult.data || []) as Student[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const classes = (classesResult.data || []) as ClassRecord[];
  const enrollments = (enrollmentsResult.data || []) as ClassEnrollment[];
  const progress = (progressResult.data || []) as StudentProgress[];
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));

  const reports = partners.map<NgoAggregateReport>((partner) => {
    const partnerStudents = students.filter((student) => student.ngo_partner_id === partner.id);
    const studentIds = new Set(partnerStudents.map((student) => student.id));
    const releasedSubmissions = submissions.filter((submission) => (
      studentIds.has(submission.student_id)
      && assignmentIds.has(submission.assignment_id)
      && submission.marks_released
      && submission.marks_awarded != null
    ));
    const activeClassIds = new Set(classes
      .filter((classRecord) => classRecord.ngo_partner_id === partner.id)
      .map((classRecord) => classRecord.id));
    for (const enrollment of enrollments) {
      if (studentIds.has(enrollment.student_id)) {
        activeClassIds.add(enrollment.class_id);
      }
    }

    return {
      ngo_partner_id: partner.id,
      ngo_partner_name: partner.name,
      student_count: partnerStudents.length,
      released_results: releasedSubmissions.length,
      average_mark: average(releasedSubmissions.map((submission) => Number(submission.marks_awarded))),
      active_classes: activeClassIds.size,
      progress_topic_count: progress.filter((item) => studentIds.has(item.student_id)).length,
    };
  });

  return { reports };
}

function average(values: number[]) {
  const cleanValues = values.filter(Number.isFinite);
  if (!cleanValues.length) return null;
  return Math.round((cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length) * 10) / 10;
}
