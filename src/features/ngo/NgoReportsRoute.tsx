import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { DashboardMetric } from '../../types/lms';
import { loadNgoReports, type NgoAggregateReport } from './ngoReportsRepository';

export function NgoReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadNgoReports, []);
  const reports = data?.reports || [];
  const metrics: DashboardMetric[] = [
    { label: 'Partner reports', value: String(reports.length), helper: 'Aggregate rows visible to your partner role.', tone: 'teal' },
    { label: 'Learners', value: String(reports.reduce((total, report) => total + report.student_count, 0)), helper: 'Learner count only, no names exposed.', tone: 'blue' },
    { label: 'Marked submissions', value: String(reports.reduce((total, report) => total + report.released_results, 0)), helper: 'Aggregate marked work, not a learner outcome count.', tone: 'amber' },
  ];

  return (
    <DashboardShell title="Cohort impact" subtitle="NGO Cohort Reports: privacy-protected programme evidence for partner-linked learner cohorts." section="ngo">
      {data ? <section className="grid gap-4 md:grid-cols-3">{metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}</section> : null}
      {loading ? <LoadingState title="Loading NGO cohort reports" description="Preparing anonymized aggregate rows for visible cohorts..." /> : null}
      {error ? <ErrorState title="NGO reports unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/ngo/reports" /> : null}
      {data && !reports.length ? (
        <EmptyState title="No cohort reports available" description="Aggregate reports appear after an NGO partner, linked learners, and released results are visible to your account." />
      ) : null}
      {data && reports.length ? (
        <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ImpactMetric label="Session delivery" value={String(reports.reduce((total, report) => total + (report.session_count || 0), 0))} helper="Scheduled tutor sessions captured across visible cohorts." />
          <ImpactMetric label="Attendance" value={formatRate(reports)} helper="Present or late sessions as a share of recorded sessions." />
          <ImpactMetric label="Competency evidence" value={String(reports.reduce((total, report) => total + (report.competency_evidence_count || 0), 0))} helper="Released rubric criteria supporting the learning view." />
          <ImpactMetric label="Interventions shared" value={String(reports.reduce((total, report) => total + (report.intervention_count || 0), 0))} helper="Released feedback items with a next learning action." />
        </section>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Aggregate reports</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Rows intentionally exclude learner names, guardian contacts, individual feedback, and raw submission details.</p>
            </div>
          </div>
          <div className="mt-5">
            <DataTable<NgoAggregateReport>
              rows={reports}
              empty="No NGO cohort reports are available yet."
              columns={[
                { key: 'partner', label: 'Partner', render: (row) => <span className="font-semibold text-slate-950">{row.ngo_partner_name}</span> },
                { key: 'learners', label: 'Learners', render: (row) => row.student_count },
                { key: 'results', label: 'Marked work', render: (row) => row.released_results },
                { key: 'average', label: 'Average mark', render: (row) => row.average_mark == null ? '--' : `${row.average_mark}%` },
                { key: 'classes', label: 'Active classes', render: (row) => row.active_classes },
                { key: 'signals', label: 'Progress signals', render: (row) => row.progress_topic_count },
                { key: 'attendance', label: 'Attendance', render: (row) => row.attendance_rate == null ? '--' : `${row.attendance_rate}%` },
                { key: 'evidence', label: 'Competency evidence', render: (row) => row.competency_evidence_count || 0 },
              ]}
            />
          </div>
        </Card>
        </>
      ) : null}
    </DashboardShell>
  );
}

function ImpactMetric({ label, value, helper }: { label: string; value: string; helper: string }) { return <Card><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-aegean">Delivery & outcomes</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 font-semibold text-slate-950">{label}</p><p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p></Card>; }
function formatRate(reports: NgoAggregateReport[]) { const sessions = reports.reduce((total, report) => total + (report.session_count || 0), 0); const attended = reports.reduce((total, report) => total + (report.attended_session_count || 0), 0); return sessions ? `${Math.round(attended / sessions * 100)}%` : '--'; }
