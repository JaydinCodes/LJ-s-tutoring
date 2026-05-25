import { requireSupabase } from '../../lib/supabase/client';
import type { Profile, Student, Tutor, UserRole } from '../../types/lms';

export interface StudentOnboardingInput {
  fullName: string;
  email: string;
  phone?: string;
  grade: string;
  school?: string;
  parentName?: string;
  parentContact?: string;
}

export interface TutorOnboardingInput {
  fullName: string;
  email: string;
  phone?: string;
  subjects: string;
  grades: string;
  hourlyRate?: string;
}

async function getAuthUserId() {
  const client = requireSupabase();
  const result = await client.auth.getUser();
  if (result.error) {
    throw result.error;
  }
  const user = result.data.user;
  if (!user) {
    throw new Error('Sign in before completing onboarding.');
  }

  return user.id;
}

async function createProfile(input: { fullName: string; email: string; phone?: string; role: UserRole }) {
  const client = requireSupabase();
  const authUserId = await getAuthUserId();
  const payload = {
    auth_user_id: authUserId,
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    role: input.role,
  };

  const result = await (client.from('profiles') as unknown as {
    insert: (row: typeof payload) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(payload).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return result.data as Profile;
}

export async function completeStudentOnboarding(input: StudentOnboardingInput) {
  const client = requireSupabase();
  if (!input.fullName.trim()) {
    throw new Error('Full name is required.');
  }
  if (!input.email.trim()) {
    throw new Error('Email is required.');
  }
  if (!input.grade.trim()) {
    throw new Error('Grade is required.');
  }

  const profile = await createProfile({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    role: 'student',
  });

  const payload = {
    profile_id: profile.id,
    grade: input.grade.trim(),
    school: input.school?.trim() || null,
    parent_name: input.parentName?.trim() || null,
    parent_contact: input.parentContact?.trim() || null,
    status: 'active',
  };

  const result = await (client.from('students') as unknown as {
    insert: (row: typeof payload) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(payload).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return { profile, student: result.data as Student };
}

export async function completeTutorOnboarding(input: TutorOnboardingInput) {
  const client = requireSupabase();
  if (!input.fullName.trim()) {
    throw new Error('Full name is required.');
  }
  if (!input.email.trim()) {
    throw new Error('Email is required.');
  }

  const subjects = input.subjects.split(',').map((item) => item.trim()).filter(Boolean);
  const grades = input.grades.split(',').map((item) => item.trim()).filter(Boolean);
  if (!subjects.length) {
    throw new Error('Add at least one subject.');
  }
  if (!grades.length) {
    throw new Error('Add at least one grade.');
  }

  const profile = await createProfile({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    role: 'tutor',
  });

  const rate = input.hourlyRate ? Number(input.hourlyRate) : null;
  const payload = {
    profile_id: profile.id,
    subjects,
    grades,
    hourly_rate: Number.isFinite(rate) ? rate : null,
    status: 'pending',
  };

  const result = await (client.from('tutors') as unknown as {
    insert: (row: typeof payload) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(payload).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return { profile, tutor: result.data as Tutor };
}
