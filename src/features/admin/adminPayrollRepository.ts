import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '../../lib/schema/json';
import type { AdjustmentRecord, AdjustmentType, InvoiceRecord, PayPeriodIntegritySnapshot } from '../../types/lms';

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

type PayrollViewRpc = {
  tutors: PayrollTutor[];
  adjustments: Array<Pick<AdjustmentRecord, 'id' | 'tutor_id' | 'type' | 'amount' | 'reason' | 'voided_at'> & { tutor_name?: string }>;
};

function decodePayrollView(value: import('../../types/database').Json): PayrollViewRpc {
  const root = jsonObject(value, 'admin payroll view');
  return {
    tutors: jsonArray(root.tutors, 'admin payroll view.tutors').map((item) => {
      const tutor = jsonObject(item, 'payroll tutor');
      return { id: jsonString(tutor.id, 'payroll tutor.id'), full_name: typeof tutor.full_name === 'string' ? tutor.full_name : undefined };
    }),
    adjustments: jsonArray(root.adjustments, 'admin payroll view.adjustments').map((item) => {
      const adjustment = jsonObject(item, 'payroll adjustment');
      const type = jsonString(adjustment.type, 'payroll adjustment.type');
      if (type !== 'bonus' && type !== 'correction' && type !== 'penalty') throw new Error('Invalid payroll adjustment type.');
      return {
        id: jsonString(adjustment.id, 'payroll adjustment.id'),
        tutor_id: jsonString(adjustment.tutor_id, 'payroll adjustment.tutor_id'),
        type,
        amount: jsonNumber(adjustment.amount, 'payroll adjustment.amount'),
        reason: jsonString(adjustment.reason, 'payroll adjustment.reason'),
        voided_at: typeof adjustment.voided_at === 'string' ? adjustment.voided_at : null,
        tutor_name: typeof adjustment.tutor_name === 'string' ? adjustment.tutor_name : undefined,
      };
    }),
  };
}

function decodePayPeriodIntegrity(value: import('../../types/database').Json): PayPeriodIntegritySnapshot {
  const root = jsonObject(value, 'pay period integrity');
  for (const key of ['payPeriod', 'overlaps', 'outsideAssignmentWindow', 'missingInvoiceLines', 'invoiceTotalMismatches', 'pendingSubmissions', 'missingRates', 'duplicateSessions']) {
    if (!(key in root)) throw new Error(`pay period integrity.${key} is missing.`);
  }
  // The response is JSON by design. Round-tripping only after the required
  // envelope is present prevents an untyped RPC result entering the UI.
  return JSON.parse(JSON.stringify(root)) as PayPeriodIntegritySnapshot;
}

function normalizePayrollWeekStart(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

// Adjustment.type/invoice status are lowercase in Supabase (adjustment_type
// enum); the existing form ('BONUS'/'PENALTY'/'CORRECTION') and DataTable
// column both display Fastify's uppercase Prisma-era strings, so map at the
// boundary rather than touching AdminPayrollRoute.
function mapAdjustment(row: Pick<AdjustmentRecord, 'id' | 'tutor_id' | 'type' | 'amount' | 'reason' | 'voided_at'>, tutorName?: string): PayrollAdjustment {
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
  const normalizedWeekStart = normalizePayrollWeekStart(weekStart);

  const [payrollViewJson, integrityJson] = await Promise.all([
    callRpc(client, 'get_admin_payroll_view', { p_week_start: normalizedWeekStart }),
    callRpc(client, 'get_pay_period_integrity', { p_week_start: normalizedWeekStart }),
  ]);

  const payrollView = decodePayrollView(payrollViewJson);
  const integrity = decodePayPeriodIntegrity(integrityJson);
  return {
    adjustments: payrollView.adjustments.map((row) => mapAdjustment(row, row.tutor_name)),
    integrity,
    tutors: payrollView.tutors,
  };
}

export async function generatePayrollWeek(weekStart: string) {
  const client = requireSupabase();
  const invoices = await callRpc(client, 'generate_payroll_week', { p_week_start: normalizePayrollWeekStart(weekStart) });
  return { invoices: (invoices || []).map(mapInvoice) };
}

export async function lockPayPeriod(weekStart: string) {
  const client = requireSupabase();
  const payPeriod = await callRpc(client, 'lock_pay_period', { p_week_start: normalizePayrollWeekStart(weekStart) });
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
    p_related_session_id: input.relatedSessionId || '',
    p_week_start: normalizePayrollWeekStart(weekStart),
  });
  return { adjustment: mapAdjustment(adjustment) };
}
