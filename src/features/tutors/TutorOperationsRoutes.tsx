import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import {
  loadTutorReport,
  loadTutorReports,
  loadTutorRiskScores,
  loadTutorSessions,
  regenerateTutorReport,
  saveTutorSessionReport,
  submitTutorSession,
  type TutorRiskScore,
  type TutorSession,
  type TutorWeeklyReport,
} from './tutorOperationsRepository';

export function TutorSessionsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorSessions, []);
  const sessions = data?.sessions || data?.items || [];
  const [selected, setSelected] = useState<TutorSession | null>(null);

  return (
    <DashboardShell title="Tutor Sessions" subtitle="Session delivery notes and report submission workflow." section="tutor">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Sessions</h2>
              <p className="mt-1 text-sm text-slate-600">Open a draft session to save report notes or submit for admin review.</p>
            </div>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Refresh</button>
          </div>
          {loading ? <p className="mt-4 text-sm text-slate-600">Loading sessions...</p> : null}
          {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
          <div className="mt-5">
            <DataTable<TutorSession>
              rows={sessions}
              empty="No tutor sessions are available yet."
              columns={[
                { key: 'student', label: 'Student', render: (row) => <span className="font-semibold text-slate-950">{row.student_name || row.studentName || 'Student'}</span> },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                { key: 'time', label: 'Time', render: (row) => `${String(row.start_time || row.startTime || '').slice(0, 5)}-${String(row.end_time || row.endTime || '').slice(0, 5)}` },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'action', label: 'Action', render: (row) => <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800" onClick={() => setSelected(row)}>Open</button> },
              ]}
            />
          </div>
        </Card>

        <SessionReportPanel session={selected} onSaved={async () => { await reload(); }} />
      </section>
    </DashboardShell>
  );
}

export function TutorReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorReports, []);
  const [selectedReport, setSelectedReport] = useState<TutorWeeklyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function openReport(reportId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await loadTutorReport(reportId);
      setSelectedReport(result.report);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not load report.');
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(studentId?: string) {
    if (!studentId) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      const result = await regenerateTutorReport(studentId);
      setSelectedReport(result.report);
      setMessage('Report regenerated.');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not regenerate report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Tutor Reports" subtitle="Weekly learner reports for tutor-linked students." section="tutor">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Report history</h2>
              <p className="mt-1 text-sm text-slate-600">Review generated weekly reports and regenerate for linked students when needed.</p>
            </div>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Refresh</button>
          </div>
          {loading ? <p className="mt-4 text-sm text-slate-600">Loading reports...</p> : null}
          {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
          {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
          {actionError ? <p className="mt-4 text-sm font-semibold text-red-700">{actionError}</p> : null}
          <div className="mt-5 space-y-3">
            {(data?.items || []).map((report) => (
              <article key={report.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{report.student_name || 'Student report'}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(report.week_start || report.weekStart)} - {formatDate(report.week_end || report.weekEnd)}</p>
                    <p className="mt-1 text-xs text-slate-500">Created {formatDate(report.created_at || report.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60" onClick={() => void openReport(report.id)}>View</button>
                    <button disabled={busy || !report.student_id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void regenerate(report.student_id)}>Regenerate</button>
                  </div>
                </div>
              </article>
            ))}
            {data && !data.items.length ? <EmptyState title="No reports yet" description="Weekly reports will appear for linked students once generated." /> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Report details</h2>
          {selectedReport ? <ReportDetail report={selectedReport} /> : <EmptyState title="No report selected" description="Open a report to inspect its weekly summary." />}
        </Card>
      </section>
    </DashboardShell>
  );
}

export function TutorRiskRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorRiskScores, []);

  return (
    <DashboardShell title="Learner Risk Monitor" subtitle="Risk and momentum signals for students linked to the current tutor." section="tutor">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Risk scores</h2>
            <p className="mt-1 text-sm text-slate-600">Use these as support prompts, not as labels for learners.</p>
          </div>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Refresh</button>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-600">Loading risk scores...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {(data?.items || []).map((score, index) => <RiskCard key={score.id || score.studentId || score.student_id || index} score={score} />)}
          {data && !data.items.length ? <EmptyState title="No risk scores available" description="Predictive signals will appear once enough learner activity exists." /> : null}
        </div>
      </Card>
    </DashboardShell>
  );
}

function SessionReportPanel({ session, onSaved }: { session: TutorSession | null; onSaved: () => Promise<void> }) {
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [learnerStruggles, setLearnerStruggles] = useState('');
  const [homeworkAssigned, setHomeworkAssigned] = useState('');
  const [studentSummary, setStudentSummary] = useState('');
  const [tutorPrivateNotes, setTutorPrivateNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate(session);
  }, [session]);

  function hydrate(next: TutorSession | null) {
    setAttendanceStatus(next?.attendance_status || 'present');
    setTopicsCovered(next?.topics_covered || '');
    setLearnerStruggles(next?.learner_struggles || '');
    setHomeworkAssigned(next?.homework_assigned || '');
    setStudentSummary(next?.student_summary || next?.notes || '');
    setTutorPrivateNotes(next?.tutor_private_notes || '');
    setMessage(null);
    setError(null);
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!session) {
      setError('Select a session first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await saveTutorSessionReport(session.id, { attendanceStatus, topicsCovered, learnerStruggles, homeworkAssigned, studentSummary, tutorPrivateNotes });
      setMessage('Report draft saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save report.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!session) {
      setError('Select a session first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await submitTutorSession(session.id);
      setMessage('Report submitted for admin review.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Session report</h2>
      {session ? (
        <p className="mt-1 text-sm text-slate-600">{session.student_name || session.studentName || 'Student'} | {formatDate(session.date)} | <StatusBadge value={session.status} /></p>
      ) : <p className="mt-1 text-sm text-slate-600">Select a session to edit its report.</p>}
      <form className="mt-5 grid gap-4" onSubmit={(event) => void save(event)}>
        <FormField label="Attendance">
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value)}>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </FormField>
        <FormField label="Topics covered"><TextArea value={topicsCovered} onChange={(event) => setTopicsCovered(event.target.value)} /></FormField>
        <FormField label="Learner struggles"><TextArea value={learnerStruggles} onChange={(event) => setLearnerStruggles(event.target.value)} /></FormField>
        <FormField label="Homework assigned"><TextArea value={homeworkAssigned} onChange={(event) => setHomeworkAssigned(event.target.value)} /></FormField>
        <FormField label="Student summary"><TextArea value={studentSummary} onChange={(event) => setStudentSummary(event.target.value)} /></FormField>
        <FormField label="Private tutor notes"><TextArea value={tutorPrivateNotes} onChange={(event) => setTutorPrivateNotes(event.target.value)} /></FormField>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy || !session || session.status !== 'DRAFT'} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save draft'}
          </button>
          <button disabled={busy || !session || session.status !== 'DRAFT'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void submit()}>
            Submit report
          </button>
        </div>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </form>
    </Card>
  );
}

function ReportDetail({ report }: { report: TutorWeeklyReport }) {
  const payload = report.payload || {};
  return (
    <dl className="mt-4 grid gap-3 text-sm">
      <DetailLine label="Week" value={`${formatDate(report.weekStart || report.week_start)} - ${formatDate(report.weekEnd || report.week_end)}`} />
      <DetailLine label="Generated" value={formatDate(report.createdAt || report.created_at)} />
      <DetailLine label="Sessions" value={String(payload.sessionsAttended ?? 0)} />
      <DetailLine label="Minutes" value={String(payload.minutesStudied ?? 0)} />
      {payload.summary ? <p className="rounded-lg bg-slate-50 p-4 leading-6 text-slate-700">{payload.summary}</p> : null}
    </dl>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RiskCard({ score }: { score: TutorRiskScore }) {
  const reasons = score.reasons || score.modelReasons || [];
  const risk = score.riskScore ?? score.risk_score;
  const momentum = score.momentumScore ?? score.momentum_score;
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{score.studentName || score.student_name || 'Student'}</h3>
          <p className="mt-1 text-sm text-slate-600">Momentum: {momentum ?? 'Pending'}</p>
        </div>
        <StatusBadge value={risk == null ? 'pending' : risk >= 70 ? 'high_risk' : risk >= 40 ? 'watch' : 'stable'} />
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, Number(risk || 0)))}%` }} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        {reasons.map((reason, index) => (
          <p key={index} className="rounded-lg bg-slate-50 p-3">
            {typeof reason === 'string' ? reason : reason.label || reason.detail || 'Support signal'}
          </p>
        ))}
        {!reasons.length ? <p>No model reasons supplied yet.</p> : null}
      </div>
    </article>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div className="mt-4 rounded-lg bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">{message}</p>
      <button className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
