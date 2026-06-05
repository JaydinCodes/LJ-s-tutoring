import { requireSupabase } from '../../lib/supabase/client';
import type { ClassEnrollment, ClassRecord, Profile, RecordStatus } from '../../types/lms';

export type ClassInput = {
  name: string;
  tutorId: string;
  subjectId?: string;
  grade?: string;
  location?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  ngoPartnerId?: string;
  status: RecordStatus;
};

async function requireAdminProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in before managing classes.');
  }

  const result = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (result.error) {
    throw result.error;
  }
  const profile = result.data as Profile | null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Only admins can manage classes.');
  }
}

function required(value: string, label: string) {
  const next = value.trim();
  if (!next) {
    throw new Error(`${label} is required.`);
  }
  return next;
}

function optional(value?: string) {
  return value?.trim() || null;
}

function classPayload(input: ClassInput) {
  return {
    name: required(input.name, 'Class name'),
    tutor_id: required(input.tutorId, 'Tutor'),
    subject_id: optional(input.subjectId),
    grade: optional(input.grade),
    location: optional(input.location),
    day_of_week: optional(input.dayOfWeek),
    start_time: optional(input.startTime),
    end_time: optional(input.endTime),
    ngo_partner_id: optional(input.ngoPartnerId),
    status: input.status,
    updated_at: new Date().toISOString(),
  };
}

type ClassPayload = ReturnType<typeof classPayload>;
type EnrollmentPayload = { class_id: string; student_id: string; status: RecordStatus };

export async function createClassRecord(input: ClassInput) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('classes') as unknown as {
    insert: (row: ClassPayload) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  }).insert(classPayload(input)).select('*').single();
  if (result.error) {
    throw result.error;
  }
  return result.data as ClassRecord;
}

export async function updateClassRecord(classId: string, input: ClassInput) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('classes') as unknown as {
    update: (row: ClassPayload) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } };
  }).update(classPayload(input)).eq('id', classId).select('*').single();
  if (result.error) {
    throw result.error;
  }
  return result.data as ClassRecord;
}

export async function archiveClassRecord(classId: string) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('classes') as unknown as {
    update: (row: { status: RecordStatus; updated_at: string }) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } };
  }).update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', classId).select('*').single();
  if (result.error) {
    throw result.error;
  }
  return result.data as ClassRecord;
}

export async function assignStudentToClass(classId: string, studentId: string) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('class_enrollments') as unknown as {
    upsert: (row: EnrollmentPayload, options: { onConflict: string }) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  })
    .upsert({ class_id: classId, student_id: required(studentId, 'Student'), status: 'active' }, { onConflict: 'class_id,student_id' })
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  return result.data as ClassEnrollment;
}

export async function removeStudentFromClass(classId: string, studentId: string) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('class_enrollments') as unknown as {
    update: (row: { status: RecordStatus }) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } } };
  })
    .update({ status: 'inactive' })
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  return result.data as ClassEnrollment;
}
