import { requireSupabase } from '../../lib/supabase/client';
import type { Profile, Student, Tutor } from '../../types/lms';

interface OnboardingRpcArgs {
  p_role: 'student' | 'tutor';
  p_full_name: string;
  p_phone: string | null;
  p_grade: string | null;
  p_school: string | null;
  p_parent_name: string | null;
  p_parent_contact: string | null;
  p_subjects: string[] | null;
  p_grades: string[] | null;
}

interface OnboardingRpcResult {
  profile: Profile;
  student: Student | null;
  tutor: Tutor | null;
}

async function callOnboardingRpc(args: OnboardingRpcArgs) {
  // This repository's Database type is hand-maintained rather than generated;
  // use the same narrow RPC-client contract employed by other mutations.
  const client = requireSupabase() as unknown as {
    rpc: (
      name: 'onboard_current_user',
      rpcArgs: OnboardingRpcArgs,
    ) => Promise<{ data: OnboardingRpcResult | null; error: Error | null }>;
  };
  const result = await client.rpc('onboard_current_user', args);

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export interface StudentOnboardingInput {
  fullName: string;
  phone?: string;
  grade: string;
  school?: string;
  parentName?: string;
  parentContact?: string;
}

export interface TutorOnboardingInput {
  fullName: string;
  phone?: string;
  subjects: string;
  grades: string;
}

function listFromCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export async function completeStudentOnboarding(input: StudentOnboardingInput) {
  if (!input.fullName.trim()) {
    throw new Error('Full name is required.');
  }
  if (!input.grade.trim()) {
    throw new Error('Grade is required.');
  }

  return callOnboardingRpc({
    p_role: 'student',
    p_full_name: input.fullName.trim(),
    p_phone: input.phone?.trim() || null,
    p_grade: input.grade.trim(),
    p_school: input.school?.trim() || null,
    p_parent_name: input.parentName?.trim() || null,
    p_parent_contact: input.parentContact?.trim() || null,
    p_subjects: null,
    p_grades: null,
  });
}

export async function completeTutorOnboarding(input: TutorOnboardingInput) {
  if (!input.fullName.trim()) {
    throw new Error('Full name is required.');
  }

  const subjects = listFromCsv(input.subjects);
  const grades = listFromCsv(input.grades);
  if (!subjects.length) {
    throw new Error('Add at least one subject.');
  }
  if (!grades.length) {
    throw new Error('Add at least one grade.');
  }

  return callOnboardingRpc({
    p_role: 'tutor',
    p_full_name: input.fullName.trim(),
    p_phone: input.phone?.trim() || null,
    p_grade: null,
    p_school: null,
    p_parent_name: null,
    p_parent_contact: null,
    p_subjects: subjects,
    p_grades: grades,
  });
}
