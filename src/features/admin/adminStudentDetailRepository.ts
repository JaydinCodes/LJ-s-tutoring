import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2EAdminStudentDetail } from '../../lib/e2e/mockRoleData';
import { requireSupabase } from '../../lib/supabase/client';
import { resolveSignedUrls } from '../../lib/supabase/storage';
import type { Assignment, AssignmentSubmission, Profile, Subject, Tutor, TutorStudentAllocation } from '../../types/lms';

export type AdminStudentAllocation = TutorStudentAllocation & {
  tutor_name?: string;
  tutor_email?: string;
};

export type AdminStudentSubmission = AssignmentSubmission & {
  assignment_title: string;
  subject_name: string;
};

export interface AdminStudentDetailView {
  allocations: AdminStudentAllocation[];
  submissions: AdminStudentSubmission[];
  tutors: Array<Tutor & { full_name?: string; email?: string }>;
}

export async function loadAdminStudentDetail(studentId: string): Promise<AdminStudentDetailView> {
  if (isE2EAuthMockEnabled()) {
    return getE2EAdminStudentDetail(studentId);
  }

  const client = requireSupabase();
  const [allocationsResult, submissionsResult, assignmentsResult, subjectsResult, tutorsResult] = await Promise.all([
    client.from('tutor_student_allocations').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
    client.from('assignment_submissions').select('*').eq('student_id', studentId).order('submitted_at', { ascending: false }),
    client.from('assignments').select('*'),
    client.from('subjects').select('*'),
    client.from('tutors').select('*').order('created_at', { ascending: false }),
  ]);

  for (const result of [allocationsResult, submissionsResult, assignmentsResult, subjectsResult, tutorsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const allocations = (allocationsResult.data || []) as TutorStudentAllocation[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const subjects = (subjectsResult.data || []) as Subject[];
  const tutors = (tutorsResult.data || []) as Tutor[];

  const profileIds = Array.from(new Set(tutors.map((tutor) => tutor.profile_id).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const profiles = (profilesResult.data || []) as Profile[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const tutorById = new Map(tutors.map((tutor) => [tutor.id, tutor]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  // assignment-submissions is a private bucket -- resolve the stored path to a
  // short-lived signed URL so admins can actually open the file (see
  // src/lib/supabase/storage.ts / adminDashboardRepository.ts).
  const submissionUrlByPath = await resolveSignedUrls(client, 'assignment-submissions', submissions.map((submission) => submission.file_url));

  return {
    allocations: allocations.map((allocation) => {
      const tutor = tutorById.get(allocation.tutor_id);
      const tutorProfile = tutor ? profileById.get(tutor.profile_id) : undefined;
      return {
        ...allocation,
        tutor_name: tutorProfile?.full_name,
        tutor_email: tutorProfile?.email,
      };
    }),
    submissions: submissions.map((submission) => {
      const assignment = assignmentById.get(submission.assignment_id);
      const subject = assignment?.subject_id ? subjectById.get(assignment.subject_id) : undefined;
      return {
        ...submission,
        assignment_title: assignment?.title || submission.assignment_id,
        subject_name: subject?.name || assignment?.subject || 'General',
        file_url: (submission.file_url && submissionUrlByPath.get(submission.file_url)) || submission.file_url,
      };
    }),
    tutors: tutors.map((tutor) => ({
      ...tutor,
      full_name: profileById.get(tutor.profile_id)?.full_name,
      email: profileById.get(tutor.profile_id)?.email,
    })),
  };
}
