import { requireSupabase } from '../../lib/supabase/client';
import type { Payment, PaymentStatus, Profile, TutorPayment } from '../../types/lms';

export interface CreatePaymentInput {
  studentId: string;
  amount: string;
  paymentType: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdatePaymentInput {
  paymentId: string;
  status: Extract<PaymentStatus, 'pending' | 'paid' | 'overdue' | 'voided'>;
  notes?: string;
}

export interface CreateTutorPaymentInput {
  tutorId: string;
  amount: string;
  paymentPeriod: string;
  notes?: string;
}

export interface UpdateTutorPaymentInput {
  tutorPaymentId: string;
  status: Extract<PaymentStatus, 'pending' | 'paid' | 'overdue' | 'voided'>;
  notes?: string;
}

async function getCurrentProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in before using this workflow.');
  }

  const result = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (result.error) {
    throw result.error;
  }

  const profile = result.data as Profile | null;
  if (!profile) {
    throw new Error('No profile is linked to the current account.');
  }
  if (profile.role !== 'admin') {
    throw new Error('Only admins can manage payments.');
  }

  return profile;
}

export async function createPayment(input: CreatePaymentInput) {
  const client = requireSupabase();
  await getCurrentProfile();

  const amount = Number(input.amount);
  if (!input.studentId) {
    throw new Error('Select a student.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!input.paymentType.trim()) {
    throw new Error('Payment type is required.');
  }

  const payload = {
    student_id: input.studentId,
    amount,
    payment_type: input.paymentType.trim(),
    status: 'pending',
    due_date: input.dueDate || null,
    paid_at: null,
    notes: input.notes?.trim() || null,
  };

  const result = await (client.from('payments') as unknown as {
    insert: (row: typeof payload) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(payload).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return result.data as Payment;
}

export async function updatePaymentStatus(input: UpdatePaymentInput) {
  const client = requireSupabase();
  await getCurrentProfile();

  const payload = {
    status: input.status,
    paid_at: input.status === 'paid' ? new Date().toISOString() : null,
    notes: input.notes?.trim() || null,
  };

  const result = await (client.from('payments') as unknown as {
    update: (row: typeof payload) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
      };
    };
  }).update(payload).eq('id', input.paymentId).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return result.data as Payment;
}

export async function createTutorPayment(input: CreateTutorPaymentInput) {
  const client = requireSupabase();
  await getCurrentProfile();

  const amount = Number(input.amount);
  if (!input.tutorId) {
    throw new Error('Select a tutor.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Tutor payment amount must be greater than zero.');
  }
  if (!input.paymentPeriod.trim()) {
    throw new Error('Payment period is required.');
  }

  const payload = {
    tutor_id: input.tutorId,
    amount,
    payment_period: input.paymentPeriod.trim(),
    status: 'pending',
    paid_at: null,
    notes: input.notes?.trim() || null,
  };

  const result = await (client.from('tutor_payments') as unknown as {
    insert: (row: typeof payload) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  }).insert(payload).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return result.data as TutorPayment;
}

export async function updateTutorPaymentStatus(input: UpdateTutorPaymentInput) {
  const client = requireSupabase();
  await getCurrentProfile();

  const payload = {
    status: input.status,
    paid_at: input.status === 'paid' ? new Date().toISOString() : null,
    notes: input.notes?.trim() || null,
  };

  const result = await (client.from('tutor_payments') as unknown as {
    update: (row: typeof payload) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
      };
    };
  }).update(payload).eq('id', input.tutorPaymentId).select('*').single();

  if (result.error) {
    throw result.error;
  }

  return result.data as TutorPayment;
}
