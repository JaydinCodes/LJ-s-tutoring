// Admin progress reporting MVP for parent-ready learner reports and anonymized NGO summaries.
import { useMemo, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { DashboardMetric } from '../../types/lms';
import type { NgoProgressReport, StudentProgressReport } from './adminProgressReportsRepository';
import { loadAdminProgressReports } from './adminProgressReportsRepository';

export function AdminReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminProgressReports, []);
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return (data?.students || []).filter((student) => {
      if (!query) return true;
      return [student.student_name, student.grade, student.school, student.ngo_partner].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [data?.students, studentSearch]);
  const selectedStudent = useMemo(() => {
    if (!data?.students.length) return null;
    return data.students.find((student) => student.student_id === studentId) || filteredStudents[0] || data.students[0];
  }, [data?.students, filteredStudents, studentId]);

  return (
    <DashboardShell title="Progress Reports" subtitle="Parent-ready learner reports and anonymized NGO summaries from released Supabase data." section="admin">
      {data ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics(data.summary).map((metric) => <StatCard key={metric.label} metric={metric} />)}
        </section>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Report controls</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Choose one learner for a parent or guardian report. NGO rows stay aggregated so partner views do not expose learner identities.</p>
          </div>
          <StatusBadge value="released_data_only" />
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-600">Loading report data...</p> : null}
        {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
            <FormField label="Learner search">
              <TextInput value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name, grade, school, or NGO" />
            </FormField>
            <FormField label="Learner report">
              <select className="w-full rounded-2xl border border-brand-marble bg-white px-3 py-2 text-sm text-brand-obsidian" value={selectedStudent?.student_id || ''} onChange={(event) => setStudentId(event.target.value)}>
                {filteredStudents.map((student) => <option key={student.student_id} value={student.student_id}>{student.student_name}</option>)}
              </select>
            </FormField>
          </div>
        ) : null}
      </Card>

      {data && !data.students.length ? <EmptyState title="No learner reports yet" description="Reports appear after learners, released marks, progress records, and guardian links are available." /> : null}
      {selectedStudent ? <StudentReportCard report={selectedStudent} /> : null}
      {data ? <NgoReportsSection rows={data.ngoReports} /> : null}
    </DashboardShell>
  );
}

function StudentReportCard({ report }: { report: StudentProgressReport }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-aegean">Parent report</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{report.student_name}</h2>
          <p className="mt-1 text-sm text-slate-600">{[report.grade, report.school, report.ngo_partner].filter(Boolean).join(' | ') || 'Learner profile'}</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" type="button" onClick={() => window.print()}>
          Print report
        </button>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <ReportStat label="Average released mark" value={report.average_mark == null ? '--' : `${report.average_mark}%`} />
        <ReportStat label="Released results" value={String(report.released_results.length)} />
        <ReportStat label="Pending submissions" value={String(report.pending_submissions)} />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Released results</h3>
          <div className="mt-3">
            <DataTable
              rows={report.released_results}
              empty="No released results are ready for this learner."
              columns={[
                { key: 'assignment', label: 'Assignment', render: (row) => <span className="font-semibold text-slate-950">{row.assignment_title}</span> },
                { key: 'subject', label: 'Subject', render: (row) => row.subject_name },
                { key: 'mark', label: 'Mark', render: (row) => `${row.marks_awarded}%` },
                { key: 'released', label: 'Released', render: (row) => formatDate(row.released_at || row.submitted_at) },
              ]}
            />
          </div>
        </div>
        <div className="grid gap-4">
          <GuardianRecipients recipients={report.guardians} />
          <ProgressTopics report={report} />
        </div>
      </section>
    </Card>
  );
}

function GuardianRecipients({ recipients }: { recipients: StudentProgressReport['guardians'] }) {
  const reportRecipients = recipients.filter((recipient) => recipient.can_receive_reports);
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h3 className="text-lg font-semibold text-slate-950">Guardian recipients</h3>
      <div className="mt-3 grid gap-2">
        {reportRecipients.map((recipient) => (
          <div key={recipient.id} className="rounded-xl bg-white p-3">
            <p className="font-semibold text-slate-950">{recipient.full_name}</p>
            <p className="mt-1 text-sm text-slate-600">{[recipient.relationship_type, recipient.communication_preference, recipient.email || recipient.phone].filter(Boolean).join(' | ')}</p>
            {recipient.is_primary ? <p className="mt-1 text-xs font-semibold text-brand-aegean">Primary contact</p> : null}
          </div>
        ))}
        {!reportRecipients.length ? <p className="text-sm text-slate-600">No linked guardian is currently allowed to receive reports.</p> : null}
      </div>
    </div>
  );
}

function ProgressTopics({ report }: { report: StudentProgressReport }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h3 className="text-lg font-semibold text-slate-950">Recent progress signals</h3>
      <div className="mt-3 grid gap-2">
        {report.progress_topics.map((item) => (
          <div key={`${item.topic}-${item.recorded_at}`} className="rounded-xl bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-950">{item.topic}</p>
              <p className="text-sm font-semibold text-brand-aegean">{item.score}%</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">{item.subject_name} | {formatDate(item.recorded_at)}</p>
          </div>
        ))}
        {!report.progress_topics.length ? <p className="text-sm text-slate-600">No progress records are available yet.</p> : null}
      </div>
    </div>
  );
}

function NgoReportsSection({ rows }: { rows: NgoProgressReport[] }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">NGO aggregate reports</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Aggregates are grouped by partner and intentionally exclude learner names, guardian contacts, and submission feedback.</p>
        </div>
        <StatusBadge value="anonymized" />
      </div>
      <div className="mt-5">
        <DataTable<NgoProgressReport>
          rows={rows}
          empty="No NGO partner reports are available yet."
          columns={[
            { key: 'partner', label: 'Partner', render: (row) => <span className="font-semibold text-slate-950">{row.ngo_partner_name}</span> },
            { key: 'students', label: 'Learners', render: (row) => row.student_count },
            { key: 'results', label: 'Released results', render: (row) => row.released_results },
            { key: 'average', label: 'Average mark', render: (row) => row.average_mark == null ? '--' : `${row.average_mark}%` },
            { key: 'classes', label: 'Active classes', render: (row) => row.active_classes },
            { key: 'signals', label: 'Progress signals', render: (row) => row.progress_topic_count },
          ]}
        />
      </div>
    </Card>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function metrics(summary: { studentReports: number; guardianRecipients: number; ngoReports: number; releasedResults: number }): DashboardMetric[] {
  return [
    { label: 'Learner reports', value: String(summary.studentReports), helper: 'Individual reports available to admins.', tone: 'teal' },
    { label: 'Guardian recipients', value: String(summary.guardianRecipients), helper: 'Linked contacts allowed to receive reports.', tone: 'violet' },
    { label: 'NGO reports', value: String(summary.ngoReports), helper: 'Partner aggregate rows.', tone: 'blue' },
    { label: 'Released results', value: String(summary.releasedResults), helper: 'Marks included in external-facing reports.', tone: 'amber' },
  ];
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div className="mt-4 rounded-lg bg-red-50 p-4">
      <h2 className="text-lg font-semibold text-red-900">Report data unavailable</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
