import { requireSupabase } from '../../lib/supabase/client';
import type { Guardian, RecordStatus, StudentGuardian } from '../../types/lms';

export interface GuardianInput {
  guardianId?: string;
  profileId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  communicationPreference: string;
  notes?: string;
  status: RecordStatus;
}

export interface StudentGuardianInput {
  studentId: string;
  guardianId: string;
  relationshipType: string;
  isPrimary: boolean;
  canReceiveReports: boolean;
  status: RecordStatus;
}

function optional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function guardianPayload(input: GuardianInput) {
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error('Guardian name is required.');
  }

  return {
    profile_id: optional(input.profileId),
    full_name: fullName,
    email: optional(input.email),
    phone: optional(input.phone),
    communication_preference: input.communicationPreference.trim() || 'email',
    notes: optional(input.notes),
    status: input.status,
    updated_at: new Date().toISOString(),
  };
}

export async function createGuardianRecord(input: GuardianInput) {
  const client = requireSupabase();
  const created = await (client.from('guardians') as unknown as {
    insert: (payload: ReturnType<typeof guardianPayload>) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(guardianPayload(input)).select('*').single();

  if (created.error) {
    throw created.error;
  }

  return created.data as Guardian;
}

export async function updateGuardianRecord(input: GuardianInput & { guardianId: string }) {
  const client = requireSupabase();
  const updated = await (client.from('guardians') as unknown as {
    update: (payload: ReturnType<typeof guardianPayload>) => {
      eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
    };
  }).update(guardianPayload(input)).eq('id', input.guardianId).select('*').single();

  if (updated.error) {
    throw updated.error;
  }

  return updated.data as Guardian;
}

export async function linkGuardianToStudent(input: StudentGuardianInput) {
  const client = requireSupabase();
  if (!input.studentId || !input.guardianId) {
    throw new Error('Choose a student and guardian before linking.');
  }

  const linked = await (client.from('student_guardians') as unknown as {
    upsert: (payload: {
      student_id: string;
      guardian_id: string;
      relationship_type: string;
      is_primary: boolean;
      can_receive_reports: boolean;
      status: RecordStatus;
      updated_at: string;
    }, options: { onConflict: string }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).upsert({
    student_id: input.studentId,
    guardian_id: input.guardianId,
    relationship_type: input.relationshipType.trim() || 'guardian',
    is_primary: input.isPrimary,
    can_receive_reports: input.canReceiveReports,
    status: input.status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,guardian_id' }).select('*').single();

  if (linked.error) {
    throw linked.error;
  }

  return linked.data as StudentGuardian;
}

export async function deactivateGuardianLink(linkId: string) {
  const client = requireSupabase();
  const updated = await (client.from('student_guardians') as unknown as {
    update: (payload: { status: 'inactive'; updated_at: string }) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  }).update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', linkId);

  if (updated.error) {
    throw updated.error;
  }
}
