import { requireSupabase } from '../../lib/supabase/client';
import type { ClassEnrollment, ClassRecord, NgoPartner, Profile, RecordStatus, Student, Subject, Tutor } from '../../types/lms';

export type AdminClassRecord = ClassRecord & {
  tutor_name?: string;
  subject_name?: string;
  ngo_partner?: string;
  enrolled_students: Array<Student & { full_name?: string; email?: string; enrollment_status?: RecordStatus }>;
};

export type AdminClassManagementView = {
  classes: AdminClassRecord[];
  students: Array<Student & { full_name?: string; email?: string }>;
  tutors: Array<Tutor & { full_name?: string; email?: string }>;
  subjects: Subject[];
  ngoPartners: NgoPartner[];
};

export async function loadAdminClassManagement(): Promise<AdminClassManagementView> {
  const client = requireSupabase();
  const [classesResult, enrollmentsResult, studentsResult, tutorsResult, subjectsResult, ngoResult] = await Promise.all([
    client.from('classes').select('*').order('created_at', { ascending: false }),
    client.from('class_enrollments').select('*').order('created_at', { ascending: false }),
    client.from('students').select('*').order('created_at', { ascending: false }),
    client.from('tutors').select('*').order('created_at', { ascending: false }),
    client.from('subjects').select('*').order('name', { ascending: true }),
    client.from('ngo_partners').select('*').order('name', { ascending: true }),
  ]);

  for (const result of [classesResult, enrollmentsResult, studentsResult, tutorsResult, subjectsResult, ngoResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const classes = (classesResult.data || []) as ClassRecord[];
  const enrollments = (enrollmentsResult.data || []) as ClassEnrollment[];
  const students = (studentsResult.data || []) as Student[];
  const tutors = (tutorsResult.data || []) as Tutor[];
  const subjects = (subjectsResult.data || []) as Subject[];
  const ngoPartners = (ngoResult.data || []) as NgoPartner[];
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
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const ngoById = new Map(ngoPartners.map((partner) => [partner.id, partner.name]));
  const enrollmentsByClass = new Map<string, ClassEnrollment[]>();

  for (const enrollment of enrollments) {
    const current = enrollmentsByClass.get(enrollment.class_id) || [];
    current.push(enrollment);
    enrollmentsByClass.set(enrollment.class_id, current);
  }

  return {
    classes: classes.map((classRecord) => {
      const tutor = tutorById.get(classRecord.tutor_id);
      return {
        ...classRecord,
        tutor_name: tutor ? profileById.get(tutor.profile_id)?.full_name : undefined,
        subject_name: classRecord.subject_id ? subjectById.get(classRecord.subject_id)?.name : undefined,
        ngo_partner: classRecord.ngo_partner_id ? ngoById.get(classRecord.ngo_partner_id) : undefined,
        enrolled_students: (enrollmentsByClass.get(classRecord.id) || [])
          .map((enrollment) => {
            const student = studentById.get(enrollment.student_id);
            if (!student) {
              return null;
            }
            const profile = profileById.get(student.profile_id);
            return {
              ...student,
              full_name: profile?.full_name,
              email: profile?.email,
              enrollment_status: enrollment.status,
            };
          })
          .filter(Boolean) as AdminClassRecord['enrolled_students'],
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
    subjects,
    ngoPartners,
  };
}
