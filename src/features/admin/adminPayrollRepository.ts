import { apiGet, apiPost } from '../../lib/api/client';

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

export interface PayPeriodIntegrity {
  payPeriod?: { id?: string; status?: string };
  overlaps?: unknown[];
  outsideAssignmentWindow?: unknown[];
  missingInvoiceLines?: unknown[];
  invoiceTotalMismatches?: unknown[];
  pendingSubmissions?: Array<{ tutor_id: string; tutor_name?: string; pending: number }>;
  duplicateSessions?: unknown[];
}

export async function loadAdminPayrollView(weekStart: string) {
  const [adjustments, integrity, tutors] = await Promise.all([
    apiGet<{ adjustments: PayrollAdjustment[] }>(`/admin/pay-periods/${weekStart}/adjustments`),
    apiGet<PayPeriodIntegrity>(`/admin/integrity/pay-period/${weekStart}`),
    apiGet<{ tutors?: PayrollTutor[]; items?: PayrollTutor[] }>('/admin/tutors'),
  ]);

  return {
    adjustments: adjustments.adjustments || [],
    integrity,
    tutors: tutors.tutors || tutors.items || [],
  };
}

export function generatePayrollWeek(weekStart: string) {
  return apiPost<{ invoices: PayrollInvoice[] }>('/admin/payroll/generate-week', { weekStart });
}

export function lockPayPeriod(weekStart: string) {
  return apiPost<{ payPeriod?: { id?: string; status?: string } }>(`/admin/pay-periods/${weekStart}/lock`, {});
}

export function createPayrollAdjustment(weekStart: string, input: {
  tutorId: string;
  type: string;
  amount: number;
  reason: string;
  relatedSessionId?: string;
}) {
  return apiPost<{ adjustment: PayrollAdjustment }>(`/admin/pay-periods/${weekStart}/adjustments`, input);
}
