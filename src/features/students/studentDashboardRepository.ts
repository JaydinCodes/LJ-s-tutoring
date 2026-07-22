import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2EStudentDashboard } from '../../lib/e2e/mockRoleData';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { resolveSignedUrls } from '../../lib/supabase/storage';
import type { Assignment, AssignmentSubmission, ClassRecord, Profile, Student, StudentDashboardView, StudentProgress, Tutor, TutorStudentAllocation } from '../../types/lms';

function average(values: number[]) {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function academicStatus(score: number | null) {
  if (score == null) return 'Awaiting results';
  if (score >= 80) return 'Excellent progress';
  if (score >= 70) return 'Strong progress';
  if (score >= 50) return 'On track';
  if (score >= 40) return 'Needs support';
  return 'Urgent support';
}

// Single-stack migration: the legacy /dashboard, /student/assignments and
// /student/results APIs are retired. When Supabase can't produce a view (not
// configured, or no auth/profile/student record) we render an empty dashboard
// rather than calling the dead API, which only returned empty fallbacks in prod.
function emptyStudentDashboard(): StudentDashboardView {
  return {
    profile: { name: 'Student' },
    metrics: [
      { label: 'Overall score', value: '--', helper: 'No progress records yet.', tone: 'violet' },
      { label: 'Assignments completed', value: '0', helper: 'No submissions yet.', tone: 'teal' },
      { label: 'Open assignments', value: '0', helper: 'No published work yet.', tone: 'amber' },
      { label: 'Classes', value: '0', helper: 'No classes yet.', tone: 'blue' },
    ],
    assignments: [],
    progress: [],
    classes: [],
    submissions: [],
    recommendedNext: null,
    recommendedQuiz: null,
    careerGoals: [],
    supportStatus: {
      band: 'awaiting_results',
      label: academicStatus(null),
      explanation: 'No progress records available yet.',
      recommendedAction: 'Start with your next assignment.',
    },
    dailyInsightContext: {
      studentId: 'current',
      currentAcademicStatus: academicStatus(null),
    },
  };
}

async function loadFromSupabase(): Promise<StudentDashboardView | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) {
    return null;
  }

  const profileResult = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  const profile = profileResult.data as Profile | null;
  if (!profile) {
    return null;
  }

  const studentResult = await supabase.from('students').select('*').eq('profile_id', profile.id).single();
  const student = studentResult.data as Student | null;
  if (!student) {
    return null;
  }

  const [assignmentsResult, progressResult, enrollmentsResult, submissionsResult, allocationsResult] = await Promise.all([
    supabase.from('assignments').select('*').eq('grade', student.grade || '').neq('status', 'draft').order('due_date', { ascending: true }),
    supabase.from('student_progress').select('*').eq('student_id', student.id).order('recorded_at', { ascending: false }),
    supabase.from('class_enrollments').select('class_id').eq('student_id', student.id).eq('status', 'active'),
    // Student submission reads must go through the redacted RPC so unreleased marks and feedback stay hidden.
    supabase.rpc('get_student_assignment_submissions'),
    // Explicit column list (NOT select('*')): tutor_student_allocations now carries
    // `rate_override` (the tutor's negotiated pay rate for this engagement), which must
    // never reach a student's own dashboard response. Schedule/subject fields are fine.
    supabase
      .from('tutor_student_allocations')
      .select('id, tutor_id, student_id, status, start_date, end_date, focus_notes, subject_id, allowed_days_json, allowed_time_ranges_json')
      .eq('student_id', student.id)
      .eq('status', 'active'),
  ]);

  const assignments = (assignmentsResult.data || []) as Assignment[];
  const progress = (progressResult.data || []) as StudentProgress[];
  const enrolledClassIds = ((enrollmentsResult.data || []) as Array<{ class_id: string }>).map((item) => item.class_id);
  const classesResult = enrolledClassIds.length
    ? await supabase.from('classes').select('*').in('id', enrolledClassIds).neq('status', 'inactive')
    : { data: [], error: null };
  const classes = (classesResult.data || []) as ClassRecord[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const allocations = (allocationsResult.data || []) as TutorStudentAllocation[];
  const tutorIds = allocations.map((allocation) => allocation.tutor_id);
  // Explicit column list (NOT select('*')): tutors now carries approval/qualification
  // vetting fields (approval_status, approval_note, qualification_band, ...) that must
  // never reach a student's own dashboard response -- approval_note in particular can
  // carry a reviewer's internal commentary about the tutor. See the EXPOSURE NOTE in
  // docs/supabase/schema.sql. This is exactly the original (pre-vetting-migration)
  // column set.
  const tutorsResult = tutorIds.length
    ? await supabase.from('tutors').select('id, profile_id, subjects, grades, hourly_rate, status, created_at').in('id', tutorIds)
    : { data: [], error: null };
  const tutors = (tutorsResult.data || []) as Tutor[];
  const tutorProfileIds = Array.from(new Set(tutors.map((tutor) => tutor.profile_id).filter(Boolean)));
  const tutorProfilesResult = tutorProfileIds.length
    ? await supabase.from('profiles').select('*').in('id', tutorProfileIds)
    : { data: [], error: null };
  const tutorProfiles = (tutorProfilesResult.data || []) as Profile[];
  const tutorProfileById = new Map(tutorProfiles.map((tutorProfile) => [tutorProfile.id, tutorProfile]));
  const submittedIds = new Set(submissions.map((item) => item.assignment_id));
  const score = average(progress.map((item) => Number(item.score)).filter(Number.isFinite));
  const subjectIds = Array.from(new Set(assignments.map((assignment) => assignment.subject_id).filter(Boolean)));
  const subjectsResult = subjectIds.length
    ? await supabase.from('subjects').select('*').in('id', subjectIds)
    : { data: [], error: null };
  const subjectNameById = new Map(((subjectsResult.data || []) as Array<{ id: string; name?: string }>).map((subject) => [subject.id, subject.name]));

  // Both storage buckets are private (see docs/supabase/schema.sql), so the
  // raw paths stored in attachment_url/file_url can't be opened directly --
  // resolve them to short-lived signed URLs here so the existing component
  // contract (assignment.attachment_url / submission.file_url as a working
  // href) keeps working unchanged.
  const [attachmentUrlByPath, submissionUrlByPath] = await Promise.all([
    resolveSignedUrls(supabase, 'assignment-files', assignments.map((assignment) => assignment.attachment_url)),
    resolveSignedUrls(supabase, 'assignment-submissions', submissions.map((submission) => submission.file_url)),
  ]);
  const submissionsWithSignedUrls = submissions.map((submission) => ({
    ...submission,
    file_url: (submission.file_url && submissionUrlByPath.get(submission.file_url)) || submission.file_url,
  }));
  const assignmentsWithSubjects = assignments.map((assignment) => ({
    ...assignment,
    subject: assignment.subject || (assignment.subject_id ? subjectNameById.get(assignment.subject_id) : undefined),
    attachment_url: (assignment.attachment_url && attachmentUrlByPath.get(assignment.attachment_url)) || assignment.attachment_url,
  }));
  const weakestProgress = [...progress]
    .filter((item) => Number.isFinite(Number(item.score)))
    .sort((left, right) => Number(left.score) - Number(right.score) || left.topic.localeCompare(right.topic))[0];

  return {
    profile: {
      name: profile.full_name,
      grade: student.grade || undefined,
      school: student.school || undefined,
      parent: student.parent_name || undefined,
    },
    metrics: [
      { label: 'Overall score', value: score == null ? '--' : `${score}%`, helper: 'Average from recent progress records.', tone: 'violet' },
      { label: 'Assignments completed', value: String(submittedIds.size), helper: 'Submitted assignment records.', tone: 'teal' },
      { label: 'Open assignments', value: String(assignmentsWithSubjects.filter((item) => !submittedIds.has(item.id)).length), helper: 'Published work not yet submitted.', tone: 'amber' },
      { label: 'Classes', value: String(classes.length), helper: 'Current classes for this learner.', tone: 'blue' },
    ],
    assignments: assignmentsWithSubjects,
    progress,
    classes,
    assignedTutors: tutors.map((tutor) => ({
      ...tutor,
      full_name: tutorProfileById.get(tutor.profile_id)?.full_name,
      email: tutorProfileById.get(tutor.profile_id)?.email,
    })),
    submissions: submissionsWithSignedUrls,
    recommendedNext: weakestProgress ? {
      title: `Recommended next: ${weakestProgress.topic}`,
      description: `Spend one focused block on ${weakestProgress.topic}.`,
      action: 'Open progress',
    } : null,
    recommendedQuiz: weakestProgress ? {
      id: `quiz-${weakestProgress.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'focus'}`,
      title: `${weakestProgress.topic} quick check`,
      topic: weakestProgress.topic,
      estimatedMinutes: 12,
    } : null,
    careerGoals: [],
    supportStatus: {
      band: score == null ? 'awaiting_results' : score >= 50 ? 'on_track' : 'needs_support',
      label: academicStatus(score),
      explanation: 'Based on available progress records.',
      recommendedAction: 'Keep using the next task and progress summary to guide study time.',
    },
    dailyInsightContext: {
      studentId: student.id,
      currentAcademicStatus: academicStatus(score),
      averageScore: score ?? undefined,
    },
  };
}

export async function loadStudentDashboard(): Promise<StudentDashboardView> {
  if (isE2EAuthMockEnabled()) {
    return getE2EStudentDashboard();
  }

  const supabaseView = await loadFromSupabase();
  return supabaseView ?? emptyStudentDashboard();
}
