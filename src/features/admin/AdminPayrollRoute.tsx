import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextInput } from '../../components/ui/FormField';
import { ErrorState, InlineFeedback, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatCurrency } from '../../lib/utils/format';
import {
  createPayrollAdjustment,
  generatePayrollWeek,
  loadAdminPayrollView,
  lockPayPeriod,
  type PayrollAdjustment,
  type PayrollInvoice,
} from './adminPayrollRepository';

export function AdminPayrollRoute() {
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [generatedInvoices, setGeneratedInvoices] = useState<PayrollInvoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loader = useMemo(() => () => loadAdminPayrollView(weekStart), [weekStart]);
  const { data, loading, error, reload } = useAsyncResource(loader, [loader]);

  async function generate() {
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      const result = await generatePayrollWeek(weekStart);
      setGeneratedInvoices(result.invoices || []);
      setMessage(`Generated ${(result.invoices || []).length} invoice(s).`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not generate payroll week.');
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      await lockPayPeriod(weekStart);
      setMessage(`Week ${weekStart} locked.`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not lock pay period.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Payroll" subtitle="Pay-period generation, lock controls, adjustments, and integrity checks." section="admin">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <FormField label="Week start">
            <TextInput type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
          </FormField>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || !weekStart} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void generate()}>Generate invoices</button>
            <button disabled={busy || !weekStart} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60" onClick={() => void lock()}>Lock week</button>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" onClick={() => void reload()}>Refresh</button>
          </div>
        </div>
        {loading ? <LoadingState title="Loading payroll" description="Checking pay period, invoices, adjustments, and integrity signals..." /> : null}
        {error ? <ErrorState title="Payroll unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
        {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {actionError ? <InlineFeedback>{actionError}</InlineFeedback> : null}
      </Card>

      {data ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Integrity snapshot</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <IntegrityTile label="Status" value={data.integrity.payPeriod?.status || 'OPEN'} />
                <IntegrityTile label="Pending submissions" value={String(data.integrity.pendingSubmissions?.reduce((sum, item) => sum + Number(item.pending || 0), 0) || 0)} />
                <IntegrityTile label="Missing invoice lines" value={String(data.integrity.missingInvoiceLines?.length || 0)} />
                <IntegrityTile label="Overlaps" value={String(data.integrity.overlaps?.length || 0)} />
                <IntegrityTile label="Duplicate sessions" value={String(data.integrity.duplicateSessions?.length || 0)} />
                <IntegrityTile label="Invoice mismatches" value={String(data.integrity.invoiceTotalMismatches?.length || 0)} />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Generated invoices</h2>
              <div className="mt-5">
                <DataTable<PayrollInvoice>
                  rows={generatedInvoices}
                  empty="No invoices generated in this browser session yet."
                  columns={[
                    { key: 'number', label: 'Invoice', render: (row) => <span className="font-semibold text-slate-950">{row.invoice_number}</span> },
                    { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.total_amount) },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Adjustments</h2>
              <div className="mt-5">
                <DataTable<PayrollAdjustment>
                  rows={data.adjustments}
                  empty="No adjustments for this pay period."
                  columns={[
                    { key: 'tutor', label: 'Tutor', render: (row) => row.tutor_name || row.tutor_id },
                    { key: 'type', label: 'Type', render: (row) => row.type },
                    { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.signed_amount ?? row.amount ?? 0) },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.voided_at ? 'voided' : 'active'} /> },
                  ]}
                />
              </div>
            </Card>
          </div>

          <CreateAdjustmentPanel weekStart={weekStart} tutors={data.tutors} onSaved={reload} />
        </section>
      ) : null}
    </DashboardShell>
  );
}

function CreateAdjustmentPanel({
  weekStart,
  tutors,
  onSaved,
}: {
  weekStart: string;
  tutors: Array<{ id: string; full_name?: string; name?: string }>;
  onSaved: () => Promise<void>;
}) {
  const [tutorId, setTutorId] = useState('');
  const [type, setType] = useState('BONUS');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [relatedSessionId, setRelatedSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createPayrollAdjustment(weekStart, {
        tutorId,
        type,
        amount: Number(amount),
        reason,
        relatedSessionId: relatedSessionId || undefined,
      });
      setAmount('');
      setReason('');
      setRelatedSessionId('');
      setMessage('Adjustment saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create adjustment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Create adjustment</h2>
      <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
        <FormField label="Tutor">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" required value={tutorId} onChange={(event) => setTutorId(event.target.value)}>
            <option value="">Select tutor</option>
            {tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.full_name || tutor.name || tutor.id}</option>)}
          </select>
        </FormField>
        <FormField label="Type">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="BONUS">Bonus</option>
            <option value="PENALTY">Penalty</option>
            <option value="CORRECTION">Correction</option>
          </select>
        </FormField>
        <FormField label="Amount"><TextInput required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></FormField>
        <FormField label="Reason"><TextInput required value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
        <FormField label="Related session ID"><TextInput value={relatedSessionId} onChange={(event) => setRelatedSessionId(event.target.value)} /></FormField>
        <button disabled={busy || !weekStart} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" type="submit">
          {busy ? 'Saving...' : 'Save adjustment'}
        </button>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        {!tutors.length ? <EmptyState title="No tutors loaded" description="Create or migrate tutors before payroll adjustments can be added." /> : null}
      </form>
    </Card>
  );
}

function IntegrityTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function currentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}
