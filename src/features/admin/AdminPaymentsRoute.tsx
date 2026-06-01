import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { FormField, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatCurrency, formatDate } from '../../lib/utils/format';
import type { Payment, Student, Tutor, TutorPayment } from '../../types/lms';
import { createPayment, createTutorPayment, updatePaymentStatus, updateTutorPaymentStatus } from '../payments/paymentMutations';
import { loadAdminDashboard } from './adminDashboardRepository';

export function AdminPaymentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Payments" subtitle="Manage student payments and tutor payouts." section="admin">
      <CreatePaymentForm
        students={data?.students || []}
        onCreated={reload}
      />
      <CreateTutorPaymentForm
        tutors={data?.tutors || []}
        onCreated={reload}
      />
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Student payments</h2>
        <p className="mt-1 text-sm text-slate-600">Track learner invoices, payment arrangements, and status.</p>
        <div className="mt-5">
        {loading ? <p className="text-sm text-slate-600">Loading payments...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="grid gap-4">
            {data.payments.map((payment) => (
              <PaymentRecordCard key={payment.id} payment={payment} onUpdated={reload} />
            ))}
            {!data.payments.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No payment records are available yet.</p> : null}
          </div>
        ) : null}
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Tutor payouts</h2>
        <p className="mt-1 text-sm text-slate-600">Track tutor payment periods, payout status, and notes.</p>
        <div className="mt-5 grid gap-4">
          {data?.tutorPayments.map((payment) => (
            <TutorPaymentRecordCard key={payment.id} payment={payment} onUpdated={reload} />
          ))}
          {data && !data.tutorPayments.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No tutor payout records are available yet.</p> : null}
        </div>
      </Card>
    </DashboardShell>
  );
}

function CreateTutorPaymentForm({
  tutors,
  onCreated,
}: {
  tutors: Array<Tutor & { full_name?: string }>;
  onCreated: () => Promise<void>;
}) {
  const [tutorId, setTutorId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentPeriod, setPaymentPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createTutorPayment({ tutorId, amount, paymentPeriod, notes });
      setAmount('');
      setPaymentPeriod('');
      setNotes('');
      setMessage('Tutor payout created.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tutor payout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Create tutor payout</h2>
          <p className="mt-1 text-sm text-slate-600">Record a tutor payout for the selected payment period.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Tutor">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" required value={tutorId} onChange={(event) => setTutorId(event.target.value)}>
            <option value="">Select tutor</option>
            {tutors.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>
                {[tutor.full_name, tutor.subjects?.join(', '), tutor.grades?.join(', ')].filter(Boolean).join(' | ') || tutor.id}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Amount">
          <TextInput required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1200" />
        </FormField>
        <FormField label="Payment period">
          <TextInput required value={paymentPeriod} onChange={(event) => setPaymentPeriod(event.target.value)} placeholder="2026-05" />
        </FormField>
        <FormField label="Notes">
          <TextInput value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="May sessions, adjustment note, payroll reference..." />
        </FormField>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button disabled={busy || !tutors.length} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Creating...' : 'Create tutor payout'}
          </button>
          {!tutors.length ? <p className="text-sm text-amber-700">Create or migrate tutors before adding payouts.</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </Card>
  );
}

function CreatePaymentForm({
  students,
  onCreated,
}: {
  students: Array<Student & { full_name?: string }>;
  onCreated: () => Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('monthly_tutoring');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createPayment({ studentId, amount, paymentType, dueDate, notes });
      setAmount('');
      setDueDate('');
      setNotes('');
      setMessage('Payment record created.');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Create student payment</h2>
          <p className="mt-1 text-sm text-slate-600">Record a learner payment and its current status.</p>
        </div>
        <StatusBadge value="admin_only" />
      </div>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Student">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" required value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {[student.full_name, student.grade, student.school].filter(Boolean).join(' | ') || student.id}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Amount">
          <TextInput required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="850" />
        </FormField>
        <FormField label="Payment type">
          <TextInput required value={paymentType} onChange={(event) => setPaymentType(event.target.value)} placeholder="monthly_tutoring" />
        </FormField>
        <FormField label="Due date">
          <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </FormField>
        <div className="lg:col-span-2">
          <FormField label="Notes">
            <TextInput value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Invoice reference, payment arrangement, NGO sponsorship note..." />
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button disabled={busy || !students.length} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Creating...' : 'Create payment'}
          </button>
          {!students.length ? <p className="text-sm text-amber-700">Create or migrate students before adding payments.</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </Card>
  );
}

function PaymentRecordCard({
  payment,
  onUpdated,
}: {
  payment: Payment & { student_label?: string };
  onUpdated: () => Promise<void>;
}) {
  const [status, setStatus] = useState<'pending' | 'paid' | 'overdue' | 'voided'>(
    payment.status === 'paid' || payment.status === 'overdue' || payment.status === 'voided' ? payment.status : 'pending',
  );
  const [notes, setNotes] = useState(payment.notes || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updatePaymentStatus({ paymentId: payment.id, status, notes });
      setMessage('Payment updated.');
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{formatCurrency(payment.amount)}</h3>
          <p className="mt-1 text-sm text-slate-600">{payment.student_label || payment.student_id}</p>
          <p className="mt-1 text-sm text-slate-600">{payment.payment_type} | due {formatDate(payment.due_date)}</p>
          <p className="mt-1 text-sm text-slate-600">Paid: {payment.paid_at ? formatDate(payment.paid_at) : 'Not paid'}</p>
        </div>
        <StatusBadge value={payment.status || 'pending'} />
      </div>
      <form className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]" onSubmit={(event) => void submit(event)}>
        <FormField label="Status">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'pending' | 'paid' | 'overdue' | 'voided')}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="voided">Voided</option>
          </select>
        </FormField>
        <FormField label="Notes">
          <TextInput value={notes} onChange={(event) => setNotes(event.target.value)} />
        </FormField>
        <div className="flex items-end">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
      {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </article>
  );
}

function TutorPaymentRecordCard({
  payment,
  onUpdated,
}: {
  payment: TutorPayment & { tutor_label?: string };
  onUpdated: () => Promise<void>;
}) {
  const [status, setStatus] = useState<'pending' | 'paid' | 'overdue' | 'voided'>(
    payment.status === 'paid' || payment.status === 'overdue' || payment.status === 'voided' ? payment.status : 'pending',
  );
  const [notes, setNotes] = useState(payment.notes || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateTutorPaymentStatus({ tutorPaymentId: payment.id, status, notes });
      setMessage('Tutor payout updated.');
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update tutor payout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{formatCurrency(payment.amount)}</h3>
          <p className="mt-1 text-sm text-slate-600">{payment.tutor_label || payment.tutor_id}</p>
          <p className="mt-1 text-sm text-slate-600">Period: {payment.payment_period}</p>
          <p className="mt-1 text-sm text-slate-600">Paid: {payment.paid_at ? formatDate(payment.paid_at) : 'Not paid'}</p>
        </div>
        <StatusBadge value={payment.status || 'pending'} />
      </div>
      <form className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]" onSubmit={(event) => void submit(event)}>
        <FormField label="Status">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'pending' | 'paid' | 'overdue' | 'voided')}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="voided">Voided</option>
          </select>
        </FormField>
        <FormField label="Notes">
          <TextInput value={notes} onChange={(event) => setNotes(event.target.value)} />
        </FormField>
        <div className="flex items-end">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
      {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </article>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Data unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
