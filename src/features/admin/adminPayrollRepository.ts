import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { AdjustmentRecord, AdjustmentType, InvoiceRecord, PayPeriodIntegritySnapshot, PayPeriodRecord, Profile, Tutor } from '../../types/lms';

export interface PayrollInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
}

export interface PayrollAdjustment {
  id: string;
  tutor_id: string;
  tutor_name?: string;
  type: string;
  amount?: number;
  signed_amount?: number;
  reason: string;
  voided_at?: string | null;
}

export interface PayrollTutor {
  id: string;
  full_name?: string;
  name?: string;
}

export type PayPeriodIntegrity = PayPeriodIntegritySnapshot;

// Adjustment.type/invoice status are lowercase in Supabase (adjustment_type
// enum); the existing form ('BONUS'/'PENALTY'/'CORRECTION') and DataTable
// column both display Fastify's uppercase Prisma-era strings, so map at the
// boundary rather than touching AdminPayrollRoute.
function mapAdjustment(row: AdjustmentRecord, tutorName?: string): PayrollAdjustment {
  return {
    id: row.id,
    tutor_id: row.tutor_id,
    tutor_name: tutorName,
    type: row.type.toUpperCase(),
    amount: row.amount,
    signed_amount: row.type === 'penalty' ? -Math.abs(row.amount) : Math.abs(row.amount),
    reason: row.reason,
    voided_at: row.voided_at,
  };
}

function mapInvoice(row: InvoiceRecord): PayrollInvoice {
  return { id: row.id, invoice_number: row.invoice_number, total_amount: row.total_amount };
}

export async function loadAdminPayrollView(weekStart: string) {
  const client = requireSupabase();

  const [tutorsResult, payPeriodResult, integrity] = await Promise.all([
    client.from('tutors').select('*'),
    client.from('pay_periods').select('*').eq('period_start_date', weekStart).maybeSingle(),
    callRpc(client, 'get_pay_period_integrity', { p_week_start: weekStart }) as Promise<PayPeriodIntegritySnapshot>,
  ]);
  if (tutorsResult.error) {
    throw tutorsResult.error;
  }
  if (payPeriodResult.error) {
    throw payPeriodResult.error;
  }
  const tutors = (tutorsResult.data || []) as Tutor[];
  const payPeriod = payPeriodResult.data as PayPeriodRecord | null;

  const profileIds = Array.from(new Set(tutors.map((tutor) => tutor.profile_id).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await client.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const profileById = new Map(((profilesResult.data || []) as Profile[]).map((profile) => [profile.id, profile]));
  const tutorNameById = new Map(tutors.map((tutor) => [tutor.id, profileById.get(tutor.profile_id)?.full_name]));

  const adjustmentsResult = payPeriod
    ? await client.from('adjustments').select('*').eq('pay_period_id', payPeriod.id).order('created_at', { ascending: true })
    : { data: [], error: null };
  if (adjustmentsResult.error) {
    throw adjustmentsResult.error;
  }
  const adjustments = ((adjustmentsResult.data || []) as AdjustmentRecord[]).map((row) => mapAdjustment(row, tutorNameById.get(row.tutor_id)));

  return {
    adjustments,
    integrity,
    tutors: tutors.map((tutor) => ({ id: tutor.id, full_name: tutorNameById.get(tutor.id) })) as PayrollTutor[],
  };
}

export async function generatePayrollWeek(weekStart: string) {
  const client = requireSupabase();
  const invoices = await callRpc(client, 'generate_payroll_week', { p_week_start: weekStart });
  return { invoices: (invoices || []).map(mapInvoice) };
}

export async function lockPayPeriod(weekStart: string) {
  const client = requireSupabase();
  const payPeriod = await callRpc(client, 'lock_pay_period', { p_week_start: weekStart });
  return { payPeriod: { id: payPeriod.id, status: payPeriod.status } };
}

export async function createPayrollAdjustment(weekStart: string, input: {
  tutorId: string;
  type: string;
  amount: number;
  reason: string;
  relatedSessionId?: string;
}) {
  const client = requireSupabase();
  const adjustment = await callRpc(client, 'create_adjustment', {
    p_tutor_id: input.tutorId,
    p_type: input.type.toLowerCase() as AdjustmentType,
    p_amount: input.amount,
    p_reason: input.reason,
    p_related_session_id: input.relatedSessionId || null,
    p_week_start: weekStart,
  });
  return { adjustment: mapAdjustment(adjustment) };
}
