import { requireSupabase } from '../../lib/supabase/client';
import type { Profile, RecordStatus, Student, Tutor } from '../../types/lms';

export interface CreateStudentInput {
  authUserId: string;
  fullName: string;
  email: string;
  phone?: string;
  grade?: string;
  school?: string;
  parentName?: string;
  parentContact?: string;
  ngoPartnerId?: string;
  status: RecordStatus;
}

export interface UpdateStudentInput extends Omit<CreateStudentInput, 'authUserId' | 'status'> {
  profileId: string;
  studentId: string;
  status: RecordStatus;
}

export interface CreateTutorInput {
  authUserId: string;
  fullName: string;
  email: string;
  phone?: string;
  subjects: string;
  grades: string;
  hourlyRate?: string;
  status: RecordStatus;
}

export interface UpdateTutorInput extends Omit<CreateTutorInput, 'authUserId' | 'status'> {
  profileId: string;
  tutorId: string;
  status: RecordStatus;
}

async function requireAdminProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in with Supabase before managing roster records.');
  }

  const result = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (result.error) {
    throw result.error;
  }
  const profile = result.data as Profile | null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Only admins can manage roster records.');
  }

  return profile;
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

function listFromCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseHourlyRate(value?: string) {
  if (!value?.trim()) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Hourly rate must be a valid non-negative number.');
  }
  return amount;
}

export async function createStudentRecord(input: CreateStudentInput) {
  const client = requireSupabase();
  await requireAdminProfile();

  const profileResult = await (client.from('profiles') as unknown as {
    insert: (row: { auth_user_id: string; full_name: string; email: string; phone: string | null; role: string }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  })
    .insert({
      auth_user_id: required(input.authUserId, 'Auth user ID'),
      full_name: required(input.fullName, 'Student name'),
      email: required(input.email, 'Email'),
      phone: optional(input.phone),
      role: 'student',
    })
    .select('*')
    .single();

  if (profileResult.error) {
    throw profileResult.error;
  }
  const profile = profileResult.data as Profile;

  const studentResult = await (client.from('students') as unknown as {
    insert: (row: {
      profile_id: string;
      grade: string | null;
      school: string | null;
      parent_name: string | null;
      parent_contact: string | null;
      ngo_partner_id: string | null;
      status: RecordStatus;
    }) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  })
    .insert({
      profile_id: profile.id,
      grade: optional(input.grade),
      school: optional(input.school),
      parent_name: optional(input.parentName),
      parent_contact: optional(input.parentContact),
      ngo_partner_id: optional(input.ngoPartnerId),
      status: input.status,
    })
    .select('*')
    .single();

  if (studentResult.error) {
    throw studentResult.error;
  }
  return studentResult.data as Student;
}

export async function updateStudentRecord(input: UpdateStudentInput) {
  const client = requireSupabase();
  await requireAdminProfile();

  const profilePayload = {
    full_name: required(input.fullName, 'Student name'),
    email: required(input.email, 'Email'),
    phone: optional(input.phone),
    updated_at: new Date().toISOString(),
  };
  const profileResult = await (client.from('profiles') as unknown as {
    update: (row: typeof profilePayload) => { eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }> };
  })
    .update({
      full_name: required(input.fullName, 'Student name'),
      email: required(input.email, 'Email'),
      phone: optional(input.phone),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.profileId);
  if (profileResult.error) {
    throw profileResult.error;
  }

  const studentResult = await (client.from('students') as unknown as {
    update: (row: {
      grade: string | null;
      school: string | null;
      parent_name: string | null;
      parent_contact: string | null;
      ngo_partner_id: string | null;
      status: RecordStatus;
    }) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } };
  })
    .update({
      grade: optional(input.grade),
      school: optional(input.school),
      parent_name: optional(input.parentName),
      parent_contact: optional(input.parentContact),
      ngo_partner_id: optional(input.ngoPartnerId),
      status: input.status,
    })
    .eq('id', input.studentId)
    .select('*')
    .single();

  if (studentResult.error) {
    throw studentResult.error;
  }
  return studentResult.data as Student;
}

export async function createTutorRecord(input: CreateTutorInput) {
  const client = requireSupabase();
  await requireAdminProfile();

  const subjects = listFromCsv(input.subjects);
  const grades = listFromCsv(input.grades);

  const profileResult = await (client.from('profiles') as unknown as {
    insert: (row: { auth_user_id: string; full_name: string; email: string; phone: string | null; role: string }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  })
    .insert({
      auth_user_id: required(input.authUserId, 'Auth user ID'),
      full_name: required(input.fullName, 'Tutor name'),
      email: required(input.email, 'Email'),
      phone: optional(input.phone),
      role: 'tutor',
    })
    .select('*')
    .single();

  if (profileResult.error) {
    throw profileResult.error;
  }
  const profile = profileResult.data as Profile;

  const tutorResult = await (client.from('tutors') as unknown as {
    insert: (row: { profile_id: string; subjects: string[]; grades: string[]; hourly_rate: number | null; status: RecordStatus }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  })
    .insert({
      profile_id: profile.id,
      subjects,
      grades,
      hourly_rate: parseHourlyRate(input.hourlyRate),
      status: input.status,
    })
    .select('*')
    .single();

  if (tutorResult.error) {
    throw tutorResult.error;
  }
  return tutorResult.data as Tutor;
}

export async function updateTutorRecord(input: UpdateTutorInput) {
  const client = requireSupabase();
  await requireAdminProfile();

  const profilePayload = {
    full_name: required(input.fullName, 'Tutor name'),
    email: required(input.email, 'Email'),
    phone: optional(input.phone),
    updated_at: new Date().toISOString(),
  };
  const profileResult = await (client.from('profiles') as unknown as {
    update: (row: typeof profilePayload) => { eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }> };
  })
    .update({
      full_name: required(input.fullName, 'Tutor name'),
      email: required(input.email, 'Email'),
      phone: optional(input.phone),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.profileId);
  if (profileResult.error) {
    throw profileResult.error;
  }

  const tutorResult = await (client.from('tutors') as unknown as {
    update: (row: { subjects: string[]; grades: string[]; hourly_rate: number | null; status: RecordStatus }) => {
      eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
    };
  })
    .update({
      subjects: listFromCsv(input.subjects),
      grades: listFromCsv(input.grades),
      hourly_rate: parseHourlyRate(input.hourlyRate),
      status: input.status,
    })
    .eq('id', input.tutorId)
    .select('*')
    .single();

  if (tutorResult.error) {
    throw tutorResult.error;
  }
  return tutorResult.data as Tutor;
}
