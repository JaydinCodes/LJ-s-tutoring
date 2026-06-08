import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2EAdminMarkbook } from '../../lib/e2e/mockRoleData';
import { requireSupabase } from '../../lib/supabase/client';
import type { Assignment, AssignmentSubmission, ClassEnrollment, ClassRecord, Profile, Student, Subject } from '../../types/lms';

export type AdminMarkbookRow = AssignmentSubmission & {
  assignment_title: string;
  assignment_grade?: string | null;
  subject_name: string;
  student_name: string;
  student_grade?: string | null;
  student_school?: string | null;
  class_ids: string[];
  class_names: string[];
};

export interface AdminMarkbookSummary {
  totalSubmissions: number;
  markedSubmissions: number;
  pendingSubmissions: number;
  averageMark: number | null;
}

export interface AdminMarkbookView {
  rows: AdminMarkbookRow[];
  assignments: Assignment[];
  classes: ClassRecord[];
  students: Array<Student & { full_name?: string; email?: string }>;
  summary: AdminMarkbookSummary;
}

export async function loadAdminMarkbook(): Promise<AdminMarkbookView> {
  if (isE2EAuthMockEnabled()) {
    return getE2EAdminMarkbook();
  }

  const client = requireSupabase();
  const [studentsResult, profilesResult, classesResult, enrollmentsResult, assignmentsResult, submissionsResult, subjectsResult] = await Promise.all([
    client.from('students').select('*').order('created_at', { ascending: false }),
    client.from('profiles').select('*'),
    client.from('classes').select('*').order('created_at', { ascending: false }),
    client.from('class_enrollments').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    client.from('assignments').select('*').order('created_at', { ascending: false }),
    client.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }),
    client.from('subjects').select('*').order('name', { ascending: true }),
  ]);

  for (const result of [studentsResult, profilesResult, classesResult, enrollmentsResult, assignmentsResult, submissionsResult, subjectsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const students = (studentsResult.data || []) as Student[];
  const profiles = (profilesResult.data || []) as Profile[];
  const classes = (classesResult.data || []) as ClassRecord[];
  const enrollments = (enrollmentsResult.data || []) as ClassEnrollment[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const subjects = (subjectsResult.data || []) as Subject[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const classById = new Map(classes.map((classRecord) => [classRecord.id, classRecord]));
  const enrollmentsByStudentId = new Map<string, ClassEnrollment[]>();

  for (const enrollment of enrollments) {
    enrollmentsByStudentId.set(enrollment.student_id, [...(enrollmentsByStudentId.get(enrollment.student_id) || []), enrollment]);
  }

  const rows = submissions.map<AdminMarkbookRow>((submission) => {
    const student = studentById.get(submission.student_id);
    const profile = student ? profileById.get(student.profile_id) : undefined;
    const assignment = assignmentById.get(submission.assignment_id);
    const subject = assignment?.subject_id ? subjectById.get(assignment.subject_id) : undefined;
    const studentEnrollments = enrollmentsByStudentId.get(submission.student_id) || [];
    return {
      ...submission,
      assignment_title: assignment?.title || submission.assignment_id,
      assignment_grade: assignment?.grade,
      subject_name: subject?.name || assignment?.subject || 'General',
      student_name: profile?.full_name || profile?.email || submission.student_id,
      student_grade: student?.grade,
      student_school: student?.school,
      class_ids: studentEnrollments.map((enrollment) => enrollment.class_id),
      class_names: studentEnrollments.map((enrollment) => classById.get(enrollment.class_id)?.name || enrollment.class_id),
    };
  });

  return {
    rows,
    assignments,
    classes,
    students: students.map((student) => ({
      ...student,
      full_name: profileById.get(student.profile_id)?.full_name,
      email: profileById.get(student.profile_id)?.email,
    })),
    summary: summarizeRows(rows),
  };
}

export function summarizeRows(rows: AdminMarkbookRow[]): AdminMarkbookSummary {
  const marked = rows.filter((row) => row.marks_awarded != null);
  return {
    totalSubmissions: rows.length,
    markedSubmissions: marked.length,
    pendingSubmissions: rows.length - marked.length,
    averageMark: marked.length
      ? Math.round((marked.reduce((total, row) => total + Number(row.marks_awarded || 0), 0) / marked.length) * 10) / 10
      : null,
  };
}
