import { requireSupabase } from '../../lib/supabase/client';
import type { Profile, Student, Tutor, TutorStudentAllocation } from '../../types/lms';

export type AdminTutorStudentAllocation = TutorStudentAllocation & {
  tutor_name?: string;
  tutor_email?: string;
  student_name?: string;
  student_email?: string;
  student_grade?: string | null;
  student_school?: string | null;
};

export type AdminAllocationManagementView = {
  allocations: AdminTutorStudentAllocation[];
  students: Array<Student & { full_name?: string; email?: string }>;
  tutors: Array<Tutor & { full_name?: string; email?: string }>;
};

export async function loadAdminAllocationManagement(): Promise<AdminAllocationManagementView> {
  const client = requireSupabase();
  const [allocationsResult, studentsResult, tutorsResult] = await Promise.all([
    client.from('tutor_student_allocations').select('*').order('created_at', { ascending: false }),
    client.from('students').select('*').order('created_at', { ascending: false }),
    client.from('tutors').select('*').order('created_at', { ascending: false }),
  ]);

  for (const result of [allocationsResult, studentsResult, tutorsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const allocations = (allocationsResult.data || []) as TutorStudentAllocation[];
  const students = (studentsResult.data || []) as Student[];
  const tutors = (tutorsResult.data || []) as Tutor[];
  const profileIds = Array.from(new Set([
    ...students.map((student) => student.profile_id),
    ...tutors.map((tutor) => tutor.profile_id),
  ].filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const profiles = (profilesResult.data || []) as Profile[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const tutorById = new Map(tutors.map((tutor) => [tutor.id, tutor]));

  return {
    allocations: allocations.map((allocation) => {
      const student = studentById.get(allocation.student_id);
      const tutor = tutorById.get(allocation.tutor_id);
      const studentProfile = student ? profileById.get(student.profile_id) : undefined;
      const tutorProfile = tutor ? profileById.get(tutor.profile_id) : undefined;
      return {
        ...allocation,
        tutor_name: tutorProfile?.full_name,
        tutor_email: tutorProfile?.email,
        student_name: studentProfile?.full_name,
        student_email: studentProfile?.email,
        student_grade: student?.grade,
        student_school: student?.school,
      };
    }),
    students: students.map((student) => ({
      ...student,
      full_name: profileById.get(student.profile_id)?.full_name,
      email: profileById.get(student.profile_id)?.email,
    })),
    tutors: tutors.map((tutor) => ({
      ...tutor,
      full_name: profileById.get(tutor.profile_id)?.full_name,
      email: profileById.get(tutor.profile_id)?.email,
    })),
  };
}
