import { requireSupabase } from '../../lib/supabase/client';
import type { Assignment, AssignmentSubmission, ClassRecord, Profile, Student, Tutor, TutorDashboardView, TutorStudentAllocation } from '../../types/lms';

async function getCurrentTutor() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in with a tutor account before opening the tutor dashboard.');
  }

  const profileResult = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (profileResult.error) {
    throw profileResult.error;
  }
  const profile = profileResult.data as Profile | null;
  if (!profile || profile.role !== 'tutor') {
    throw new Error('This dashboard is only available to tutor profiles.');
  }

  const tutorResult = await client.from('tutors').select('*').eq('profile_id', profile.id).single();
  if (tutorResult.error) {
    throw tutorResult.error;
  }
  const tutor = tutorResult.data as Tutor | null;
  if (!tutor) {
    throw new Error('No tutor record is linked to the current profile.');
  }

  return { profile, tutor };
}

export async function loadTutorDashboard(): Promise<TutorDashboardView> {
  const client = requireSupabase();
  const { profile, tutor } = await getCurrentTutor();

  const [classesResult, assignmentsResult, allocationsResult] = await Promise.all([
    client.from('classes').select('*').eq('tutor_id', tutor.id).neq('status', 'inactive').order('day_of_week', { ascending: true }),
    client.from('assignments').select('*').eq('created_by', profile.id).order('created_at', { ascending: false }),
    client.from('tutor_student_allocations').select('*').eq('tutor_id', tutor.id).eq('status', 'active').order('created_at', { ascending: false }),
  ]);

  if (classesResult.error) {
    throw classesResult.error;
  }
  if (assignmentsResult.error) {
    throw assignmentsResult.error;
  }
  if (allocationsResult.error) {
    throw allocationsResult.error;
  }

  const classes = (classesResult.data || []) as ClassRecord[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const allocations = (allocationsResult.data || []) as TutorStudentAllocation[];
  const assignmentIds = assignments.map((assignment) => assignment.id);

  let submissions: AssignmentSubmission[] = [];
  if (assignmentIds.length) {
    const submissionsResult = await client
      .from('assignment_submissions')
      .select('*')
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });
    if (submissionsResult.error) {
      throw submissionsResult.error;
    }
    submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  }

  const studentIds = Array.from(new Set([
    ...submissions.map((submission) => submission.student_id),
    ...allocations.map((allocation) => allocation.student_id),
  ]));
  let students: Student[] = [];
  if (studentIds.length) {
    const studentsResult = await client.from('students').select('*').in('id', studentIds);
    if (!studentsResult.error) {
      students = (studentsResult.data || []) as Student[];
    }
  }

  const studentProfileIds = Array.from(new Set(students.map((student) => student.profile_id).filter(Boolean)));
  const studentProfilesResult = studentProfileIds.length
    ? await client.from('profiles').select('*').in('id', studentProfileIds)
    : { data: [], error: null };
  const studentProfiles = (studentProfilesResult.data || []) as Profile[];
  const studentProfileById = new Map(studentProfiles.map((studentProfile) => [studentProfile.id, studentProfile]));
  const assignmentTitleById = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const studentLabelById = new Map(students.map((student) => [
    student.id,
    studentProfileById.get(student.profile_id)?.full_name || [student.grade, student.school].filter(Boolean).join(' | ') || student.id,
  ]));
  const allocationByStudentId = new Map(allocations.map((allocation) => [allocation.student_id, allocation]));
  const markedCount = submissions.filter((submission) => submission.status === 'marked').length;

  return {
    profile: {
      name: profile.full_name,
      email: profile.email,
      subjects: tutor.subjects || [],
      grades: tutor.grades || [],
      status: tutor.status,
    },
    metrics: [
      { label: 'Learners', value: String(allocations.length), helper: 'Active students allocated to you.', tone: 'teal' },
      { label: 'Assignments', value: String(assignments.length), helper: 'Assignments created by your tutor account.', tone: 'violet' },
      { label: 'Submissions', value: String(submissions.length), helper: 'Student work received for your assignments.', tone: 'amber' },
      { label: 'Marked', value: String(markedCount), helper: 'Submissions with completed feedback.', tone: 'blue' },
    ],
    classes,
    allocatedStudents: allocations
      .map((allocation) => {
        const student = studentById.get(allocation.student_id);
        const studentProfile = student ? studentProfileById.get(student.profile_id) : undefined;
        return student ? {
          ...student,
          full_name: studentProfile?.full_name,
          email: studentProfile?.email,
          allocation_status: allocation.status,
          focus_notes: allocation.focus_notes,
        } : null;
      })
      .filter(Boolean) as TutorDashboardView['allocatedStudents'],
    assignments,
    submissions: submissions.map((submission) => ({
      ...submission,
      assignment_title: assignmentTitleById.get(submission.assignment_id),
      student_label: studentLabelById.get(submission.student_id),
    })),
  };
}
