import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { InlineFeedback, InlineLoadingState, RetryButton } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import {
  approveSession,
  closePrivacyRequest,
  createPrivacyRequest,
  loadApprovalQueue,
  loadAuditEntries,
  loadPrivacyRequests,
  loadRetentionSummary,
  rejectSession,
  type AdminSession,
  type AuditEntry,
  type PrivacyRequest,
} from './adminOperationsRepository';

export function AdminApprovalsRoute() {
  const [status, setStatus] = useState('SUBMITTED');
  const [message, setMessage] = useState<string | null>(null);
  const params = useMemo(() => {
    const next = new URLSearchParams({ status, page: '1', pageSize: '25', sort: 'date', order: 'desc' });
    return next;
  }, [status]);
  const { data, loading, error, reload } = useAsyncResource(() => loadApprovalQueue(params), [params]);

  async function runAction(sessionId: string, action: 'approve' | 'reject') {
    setMessage(null);
    if (action === 'approve') {
      await approveSession(sessionId);
      setMessage('Session approved.');
    } else {
      const reason = window.prompt('Reason for rejection?') || undefined;
      await rejectSession(sessionId, reason);
      setMessage('Session rejected.');
    }
    await reload();
  }

  return (
    <DashboardShell title="Approvals" subtitle="Session approval queue migrated from the admin console API." section="admin">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <FormField label="Status">
            <select className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
            </select>
          </FormField>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void reload()}>Refresh</button>
        </div>
        <StatusLine loading={loading} error={error} message={message} onRetry={reload} />
        {data ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Summary label="Total sessions" value={String(data.total || data.items.length)} />
              <Summary label="Submitted" value={String(data.aggregates?.countsByStatus?.SUBMITTED ?? data.items.filter((item) => item.status === 'SUBMITTED').length)} />
              <Summary label="Submitted minutes" value={String(data.aggregates?.totalMinutesSubmitted ?? data.items.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0))} />
            </div>
            <DataTable<AdminSession>
              rows={data.items}
              empty="No sessions found for this filter."
              columns={[
                { key: 'people', label: 'Session', render: (row) => <span className="font-semibold text-slate-950">{row.tutor_name || 'Tutor'} {'->'} {row.student_name || 'Student'}</span> },
                { key: 'schedule', label: 'Schedule', render: (row) => `${row.date || 'Pending'} ${row.start_time || ''}-${row.end_time || ''}` },
                { key: 'duration', label: 'Duration', render: (row) => `${row.duration_minutes || 0} min` },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => row.status === 'SUBMITTED' ? (
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void runAction(row.id, 'approve')}>Approve</button>
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800" onClick={() => void runAction(row.id, 'reject')}>Reject</button>
                    </div>
                  ) : 'No action',
                },
              ]}
            />
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

export function AdminPrivacyRequestsRoute() {
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncResource(() => loadPrivacyRequests(status), [status]);

  return (
    <DashboardShell title="Privacy Requests" subtitle="POPIA request intake, export tracking, and closure workflow." section="admin">
      <CreatePrivacyRequestForm onSaved={async () => { setMessage('Privacy request created.'); await reload(); }} />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <FormField label="Status filter">
            <select className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </FormField>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void reload()}>Refresh</button>
        </div>
        <StatusLine loading={loading} error={error} message={message} onRetry={reload} />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {(data?.requests || []).map((request) => (
            <PrivacyRequestCard key={request.id} request={request} onClosed={async () => { setMessage('Privacy request closed.'); await reload(); }} />
          ))}
          {data && !data.requests.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No privacy requests found.</p> : null}
        </div>
      </Card>
    </DashboardShell>
  );
}

export function AdminAuditRoute() {
  const [entityType, setEntityType] = useState('');
  const params = useMemo(() => {
    const next = new URLSearchParams({ page: '1', pageSize: '25' });
    if (entityType) {
      next.set('entityType', entityType);
    }
    return next;
  }, [entityType]);
  const { data, loading, error, reload } = useAsyncResource(() => loadAuditEntries(params), [params]);

  return (
    <DashboardShell title="Audit" subtitle="Immutable audit trail reader for admin actions and operational evidence." section="admin">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <FormField label="Entity type">
            <TextInput value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="session, payment, privacy_request" />
          </FormField>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void reload()}>Refresh</button>
        </div>
        <StatusLine loading={loading} error={error} onRetry={reload} />
        {data ? (
          <div className="mt-5">
            <DataTable<AuditEntry>
              rows={data.items}
              empty="No audit entries found."
              columns={[
                { key: 'created', label: 'Created', render: (row) => formatDate(row.createdAt) },
                { key: 'action', label: 'Action', render: (row) => <span className="font-semibold text-slate-950">{row.action}</span> },
                { key: 'entity', label: 'Entity', render: (row) => [row.entityType, row.entityId].filter(Boolean).join(':') || 'System' },
                { key: 'actor', label: 'Actor', render: (row) => row.actor?.email || row.actor?.role || 'System' },
                { key: 'correlation', label: 'Correlation', render: (row) => row.correlationId || '-' },
              ]}
            />
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

export function AdminRetentionRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadRetentionSummary, []);

  return (
    <DashboardShell title="Retention" subtitle="Retention policy visibility and cleanup eligibility summary." section="admin">
      <Card>
        <StatusLine loading={loading} error={error} onRetry={reload} />
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(data.eligible).map(([key, value]) => <Summary key={key} label={labelize(key)} value={String(value)} />)}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <JsonPanel title="Cutoffs" data={data.cutoffs} />
              <JsonPanel title="Latest event" data={data.latestEvent || { status: 'No retention event recorded' }} />
            </div>
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}

export function AdminReconciliationRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadRetentionSummary, []);

  return (
    <DashboardShell title="Reconciliation" subtitle="Operational reconciliation surface while finance parity moves into React." section="admin">
      <Card>
        <StatusLine loading={loading} error={error} onRetry={reload} />
        <div className="grid gap-4 xl:grid-cols-3">
          <Summary label="Legacy finance API" value="Connected" />
          <Summary label="Retention events" value={data?.latestEvent ? 'Available' : 'Pending'} />
          <Summary label="Next migration" value="Invoice parity" />
        </div>
      </Card>
    </DashboardShell>
  );
}

export function AdminResultsRoute() {
  return (
    <DashboardShell title="Results Analytics" subtitle="Learner result aggregation and reporting overview." section="admin">
      <Card>
        <div className="grid gap-4 xl:grid-cols-3">
          <Summary label="React route" value="Ready" />
          <Summary label="Data source" value="student_progress" />
          <Summary label="Cutover status" value="Pending charts" />
        </div>
      </Card>
    </DashboardShell>
  );
}

export function AdminOpsRunbookRoute() {
  return (
    <DashboardShell title="Ops Runbook" subtitle="Operational checklist route for release, incident, privacy, and rollback procedures." section="admin">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          {['Release evidence', 'Audit export', 'Privacy requests', 'Retention cleanup', 'Rollback plan', 'Monitoring alerts'].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{item}</p>
              <p className="mt-1 text-sm text-slate-600">Runbook item preserved for React cutover tracking.</p>
            </div>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

function CreatePrivacyRequestForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [requestType, setRequestType] = useState('EXPORT');
  const [subjectType, setSubjectType] = useState('STUDENT');
  const [subjectId, setSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await createPrivacyRequest({ requestType, subjectType, subjectId, reason: reason || undefined });
      setSubjectId('');
      setReason('');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create privacy request.');
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Create privacy request</h2>
      <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <FormField label="Request type">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={requestType} onChange={(event) => setRequestType(event.target.value)}>
            <option value="EXPORT">Export</option>
            <option value="CORRECTION">Correction</option>
            <option value="DELETE">Delete</option>
          </select>
        </FormField>
        <FormField label="Subject type">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={subjectType} onChange={(event) => setSubjectType(event.target.value)}>
            <option value="STUDENT">Student</option>
            <option value="TUTOR">Tutor</option>
          </select>
        </FormField>
        <FormField label="Subject ID"><TextInput required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} /></FormField>
        <FormField label="Reason"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">Create request</button>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </Card>
  );
}

function PrivacyRequestCard({ request, onClosed }: { request: PrivacyRequest; onClosed: () => Promise<void> }) {
  const [outcome, setOutcome] = useState(request.outcome || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setError(null);
    try {
      await closePrivacyRequest(request.id, { outcome: outcome || undefined, note: note || undefined });
      await onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close privacy request.');
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{request.request_type} | {request.subject_type}</h3>
          <p className="mt-1 break-all text-sm text-slate-600">{request.subject_id}</p>
        </div>
        <StatusBadge value={request.status} />
      </div>
      <p className="mt-3 text-sm text-slate-600">Created {formatDate(request.created_at)}. {request.reason || 'No reason supplied.'}</p>
      {request.status !== 'CLOSED' ? (
        <div className="mt-4 grid gap-3">
          <FormField label="Outcome"><TextInput value={outcome} onChange={(event) => setOutcome(event.target.value)} /></FormField>
          <FormField label="Close note"><TextArea value={note} onChange={(event) => setNote(event.target.value)} /></FormField>
          <button className="w-fit rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void close()}>Close request</button>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value.startsWith('R') ? value : value}</p>
    </div>
  );
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-white">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function StatusLine({ loading, error, message, onRetry }: { loading: boolean; error?: string | null; message?: string | null; onRetry: () => Promise<void> }) {
  if (loading) {
    return <InlineLoadingState label="Loading operational data..." />;
  }
  if (error) {
    return (
      <div className="mt-4 space-y-3">
        <InlineFeedback>{error}</InlineFeedback>
        <RetryButton onRetry={() => void onRetry()} />
      </div>
    );
  }
  return message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
