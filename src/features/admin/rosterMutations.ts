import { recordAuditEvent } from '../../lib/audit/auditLog';
import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
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

export type TutorVettingStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface RecordTutorVettingInput {
  tutorId: string;
  status: TutorVettingStatus;
  reviewedAt: string;
  expiresAt?: string;
  evidenceReference?: string;
}

async function requireAdminProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in before managing roster records.');
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
  const student = studentResult.data as Student;
  await recordAuditEvent({
    action: 'user_profile.created',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      role: 'student',
      student_id: student.id,
      status: student.status,
      ngo_partner_id: student.ngo_partner_id,
    },
  });
  if (student.ngo_partner_id) {
    await recordAuditEvent({
      action: 'ngo_cohort_access.updated',
      entityType: 'student',
      entityId: student.id,
      metadata: { ngo_partner_id: student.ngo_partner_id, status: student.status },
    });
  }
  return student;
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
  const student = studentResult.data as Student;
  await recordAuditEvent({
    action: 'user_profile.updated',
    entityType: 'profile',
    entityId: input.profileId,
    metadata: {
      role: 'student',
      student_id: student.id,
      status: student.status,
      ngo_partner_id: student.ngo_partner_id,
    },
  });
  await recordAuditEvent({
    action: 'ngo_cohort_access.updated',
    entityType: 'student',
    entityId: student.id,
    metadata: { ngo_partner_id: student.ngo_partner_id, status: student.status },
  });
  return student;
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
  const tutor = tutorResult.data as Tutor;
  await recordAuditEvent({
    action: 'user_profile.created',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      role: 'tutor',
      tutor_id: tutor.id,
      status: tutor.status,
      subjects: tutor.subjects,
      grades: tutor.grades,
    },
  });
  return tutor;
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
  const tutor = tutorResult.data as Tutor;
  await recordAuditEvent({
    action: 'user_profile.updated',
    entityType: 'profile',
    entityId: input.profileId,
    metadata: {
      role: 'tutor',
      tutor_id: tutor.id,
      status: tutor.status,
      subjects: tutor.subjects,
      grades: tutor.grades,
    },
  });
  return tutor;
}

export async function recordTutorVetting(input: RecordTutorVettingInput) {
  const client = requireSupabase();
  await requireAdminProfile();

  const status = input.status;
  const reviewedAt = required(input.reviewedAt, 'Review date');
  const expiresAt = optional(input.expiresAt);
  const evidenceReference = optional(input.evidenceReference);
  if (status === 'approved' && (!expiresAt || !evidenceReference)) {
    throw new Error('Approved vetting requires an expiry date and restricted-register reference.');
  }

  return callRpc(client, 'record_tutor_vetting', {
    p_tutor_id: input.tutorId,
    p_status: status,
    p_reviewed_at: new Date(reviewedAt).toISOString(),
    p_expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`).toISOString() : undefined,
    p_evidence_reference: evidenceReference ?? undefined,
  });
}

async function readTutorDeletionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json() as { error?: unknown; stage?: unknown };
      if (typeof body.error === 'string') {
        return typeof body.stage === 'string' ? `${body.error} (${body.stage})` : body.error;
      }
    } catch {
      // Fall through to the normal Error message.
    }
  }
  return error instanceof Error ? error.message : 'tutor_deletion_failed';
}

export async function deleteTutorAccount(input: { tutorId: string; reason?: string }) {
  const client = requireSupabase();
  await requireAdminProfile();

  const requestId = await callRpc(
    client,
    'request_tutor_deletion',
    { p_tutor_id: input.tutorId, p_reason: input.reason?.trim() || undefined },
  );
  if (!requestId) throw new Error('Could not create the tutor deletion request.');

  const deletionResult = await client.functions.invoke('process-tutor-deletion', {
    body: { requestId },
  });
  if (deletionResult.error) {
    throw new Error(await readTutorDeletionError(deletionResult.error));
  }

  return deletionResult.data;
}
