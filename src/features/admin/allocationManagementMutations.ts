import { recordAuditEvent } from '../../lib/audit/auditLog';
import { requireSupabase } from '../../lib/supabase/client';
import type { Profile, RecordStatus, TutorStudentAllocation } from '../../types/lms';

export type AllocationInput = {
  tutorId: string;
  studentId: string;
  status: RecordStatus;
  startDate?: string;
  endDate?: string;
  focusNotes?: string;
};

async function requireAdminProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in before managing tutor allocations.');
  }

  const result = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (result.error) {
    throw result.error;
  }
  const profile = result.data as Profile | null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Only admins can manage tutor allocations.');
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

function allocationPayload(input: AllocationInput) {
  return {
    tutor_id: required(input.tutorId, 'Tutor'),
    student_id: required(input.studentId, 'Student'),
    status: input.status,
    start_date: optional(input.startDate),
    end_date: optional(input.endDate),
    focus_notes: optional(input.focusNotes),
    updated_at: new Date().toISOString(),
  };
}

type AllocationPayload = ReturnType<typeof allocationPayload>;

export async function assignTutorToStudent(input: AllocationInput) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('tutor_student_allocations') as unknown as {
    upsert: (row: AllocationPayload, options: { onConflict: string }) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  })
    .upsert(allocationPayload(input), { onConflict: 'tutor_id,student_id' })
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  const allocation = result.data as TutorStudentAllocation;
  await recordAuditEvent({
    action: 'tutor_student_allocation.upserted',
    entityType: 'tutor_student_allocation',
    entityId: allocation.id,
    metadata: {
      tutor_id: allocation.tutor_id,
      student_id: allocation.student_id,
      status: allocation.status,
      start_date: allocation.start_date,
      end_date: allocation.end_date,
    },
  });
  return allocation;
}

export async function updateTutorStudentAllocation(allocationId: string, input: AllocationInput) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('tutor_student_allocations') as unknown as {
    update: (row: AllocationPayload) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } };
  })
    .update(allocationPayload(input))
    .eq('id', allocationId)
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  const allocation = result.data as TutorStudentAllocation;
  await recordAuditEvent({
    action: 'tutor_student_allocation.updated',
    entityType: 'tutor_student_allocation',
    entityId: allocation.id,
    metadata: {
      tutor_id: allocation.tutor_id,
      student_id: allocation.student_id,
      status: allocation.status,
      start_date: allocation.start_date,
      end_date: allocation.end_date,
    },
  });
  return allocation;
}

export async function deactivateTutorStudentAllocation(allocationId: string) {
  const client = requireSupabase();
  await requireAdminProfile();
  const result = await (client.from('tutor_student_allocations') as unknown as {
    update: (row: { status: RecordStatus; end_date: string; updated_at: string }) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } } };
  })
    .update({ status: 'inactive', end_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq('id', allocationId)
    .select('*')
    .single();
  if (result.error) {
    throw result.error;
  }
  const allocation = result.data as TutorStudentAllocation;
  await recordAuditEvent({
    action: 'tutor_student_allocation.deactivated',
    entityType: 'tutor_student_allocation',
    entityId: allocation.id,
    metadata: {
      tutor_id: allocation.tutor_id,
      student_id: allocation.student_id,
      status: allocation.status,
      end_date: allocation.end_date,
    },
  });
  return allocation;
}
