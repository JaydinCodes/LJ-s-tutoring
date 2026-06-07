// Builds admin-visible progress report payloads from Supabase tables without exposing raw report writes.
import { requireSupabase } from '../../lib/supabase/client';
import type {
  Assignment,
  AssignmentSubmission,
  ClassEnrollment,
  ClassRecord,
  Guardian,
  NgoPartner,
  Profile,
  Student,
  StudentGuardian,
  StudentProgress,
  Subject,
} from '../../types/lms';

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
  const [
    studentsResult,
    profilesResult,
    guardiansResult,
    studentGuardiansResult,
    ngoResult,
    classesResult,
    enrollmentsResult,
    assignmentsResult,
    submissionsResult,
    progressResult,
    subjectsResult,
  ] = await Promise.all([
    client.from('students').select('*').order('created_at', { ascending: false }),
    client.from('profiles').select('*'),
    client.from('guardians').select('*').order('created_at', { ascending: false }),
    client.from('student_guardians').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    client.from('ngo_partners').select('*').order('name', { ascending: true }),
    client.from('classes').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    client.from('class_enrollments').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    client.from('assignments').select('*').order('created_at', { ascending: false }),
    client.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }),
    client.from('student_progress').select('*').order('recorded_at', { ascending: false }),
    client.from('subjects').select('*').order('name', { ascending: true }),
  ]);

  for (const result of [
    studentsResult,
    profilesResult,
    guardiansResult,
    studentGuardiansResult,
    ngoResult,
    classesResult,
    enrollmentsResult,
    assignmentsResult,
    submissionsResult,
    progressResult,
    subjectsResult,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const students = (studentsResult.data || []) as Student[];
  const profiles = (profilesResult.data || []) as Profile[];
  const guardians = (guardiansResult.data || []) as Guardian[];
  const studentGuardians = (studentGuardiansResult.data || []) as StudentGuardian[];
  const ngoPartners = (ngoResult.data || []) as NgoPartner[];
  const classes = (classesResult.data || []) as ClassRecord[];
  const enrollments = (enrollmentsResult.data || []) as ClassEnrollment[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const progress = (progressResult.data || []) as StudentProgress[];
  const subjects = (subjectsResult.data || []) as Subject[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const guardianById = new Map(guardians.map((guardian) => [guardian.id, guardian]));
  const ngoById = new Map(ngoPartners.map((partner) => [partner.id, partner]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const releasedSubmissions = submissions.filter((submission) => submission.marks_released && submission.marks_awarded != null);
  const submissionsByStudent = groupBy(submissions, (submission) => submission.student_id);
  const releasedByStudent = groupBy(releasedSubmissions, (submission) => submission.student_id);
  const progressByStudent = groupBy(progress, (item) => item.student_id);
  const guardiansByStudent = groupBy(studentGuardians, (link) => link.student_id);

  const studentReports = students.map<StudentProgressReport>((student) => {
    const profile = profileById.get(student.profile_id);
    const releasedResults = (releasedByStudent.get(student.id) || []).map((submission) => {
      const assignment = assignmentById.get(submission.assignment_id);
      const subject = assignment?.subject_id ? subjectById.get(assignment.subject_id) : undefined;
      return {
        submission_id: submission.id,
        assignment_title: assignment?.title || submission.assignment_id,
        subject_name: subject?.name || assignment?.subject || 'General',
        marks_awarded: Number(submission.marks_awarded),
        feedback: submission.feedback_released ? submission.feedback : null,
        released_at: submission.released_at,
        submitted_at: submission.submitted_at,
      };
    });
    const reportProgress = (progressByStudent.get(student.id) || []).slice(0, 8).map((item) => ({
      topic: item.topic,
      score: Number(item.score),
      subject_name: item.subject_id ? subjectById.get(item.subject_id)?.name || 'General' : item.subject || 'General',
      recorded_at: item.recorded_at,
    }));
    const guardianRecipients = (guardiansByStudent.get(student.id) || [])
      .flatMap<ReportGuardianRecipient>((link) => {
        const guardian = guardianById.get(link.guardian_id);
        if (!guardian) return [];
        return [{
          id: guardian.id,
          full_name: guardian.full_name,
          email: guardian.email,
          phone: guardian.phone,
          relationship_type: link.relationship_type,
          communication_preference: guardian.communication_preference,
          can_receive_reports: link.can_receive_reports,
          is_primary: link.is_primary,
        }];
      });

    return {
      student_id: student.id,
      student_name: profile?.full_name || profile?.email || student.id,
      grade: student.grade,
      school: student.school,
      ngo_partner: student.ngo_partner_id ? ngoById.get(student.ngo_partner_id)?.name || student.ngo_partner_id : null,
      guardians: guardianRecipients,
      released_results: releasedResults,
      progress_topics: reportProgress,
      average_mark: average(releasedResults.map((result) => result.marks_awarded)),
      pending_submissions: (submissionsByStudent.get(student.id) || []).filter((submission) => !submission.marks_released || submission.marks_awarded == null).length,
      latest_released_at: releasedResults[0]?.released_at || null,
    };
  });

  const reportsByNgoId = groupBy(studentReports.filter((report) => {
    const student = students.find((item) => item.id === report.student_id);
    return Boolean(student?.ngo_partner_id);
  }), (report) => students.find((student) => student.id === report.student_id)?.ngo_partner_id || '');
  const enrollmentsByClassId = groupBy(enrollments, (enrollment) => enrollment.class_id);

  const ngoReports = ngoPartners.map<NgoProgressReport>((partner) => {
    const partnerReports = reportsByNgoId.get(partner.id) || [];
    const partnerStudentIds = new Set(partnerReports.map((report) => report.student_id));
    const activeClasses = classes.filter((classRecord) => {
      if (classRecord.ngo_partner_id === partner.id) return true;
      return (enrollmentsByClassId.get(classRecord.id) || []).some((enrollment) => partnerStudentIds.has(enrollment.student_id));
    });

    return {
      ngo_partner_id: partner.id,
      ngo_partner_name: partner.name,
      student_count: partnerReports.length,
      released_results: partnerReports.reduce((total, report) => total + report.released_results.length, 0),
      average_mark: average(partnerReports.flatMap((report) => report.released_results.map((result) => result.marks_awarded))),
      active_classes: activeClasses.length,
      progress_topic_count: partnerReports.reduce((total, report) => total + report.progress_topics.length, 0),
    };
  });

  return {
    students: studentReports,
    ngoReports,
    summary: {
      studentReports: studentReports.length,
      guardianRecipients: studentReports.reduce((total, report) => total + report.guardians.filter((guardian) => guardian.can_receive_reports).length, 0),
      ngoReports: ngoReports.length,
      releasedResults: studentReports.reduce((total, report) => total + report.released_results.length, 0),
    },
  };
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  return grouped;
}

function average(values: number[]) {
  const cleanValues = values.filter(Number.isFinite);
  if (!cleanValues.length) return null;
  return Math.round((cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length) * 10) / 10;
}
