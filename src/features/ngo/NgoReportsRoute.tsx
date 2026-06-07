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
    { label: 'Released results', value: String(reports.reduce((total, report) => total + report.released_results, 0)), helper: 'Released mark count across visible cohorts.', tone: 'amber' },
  ];

  return (
    <DashboardShell title="NGO Cohort Reports" subtitle="Anonymized cohort summaries for partner-linked learners." section="ngo">
      {data ? <section className="grid gap-4 md:grid-cols-3">{metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}</section> : null}
      {loading ? <LoadingState title="Loading NGO cohort reports" description="Preparing anonymized aggregate rows for visible cohorts..." /> : null}
      {error ? <ErrorState title="NGO reports unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/ngo/reports" /> : null}
      {data && !reports.length ? (
        <EmptyState title="No cohort reports available" description="Aggregate reports appear after an NGO partner, linked learners, and released results are visible to your account." />
      ) : null}
      {data && reports.length ? (
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
                { key: 'results', label: 'Released results', render: (row) => row.released_results },
                { key: 'average', label: 'Average mark', render: (row) => row.average_mark == null ? '--' : `${row.average_mark}%` },
                { key: 'classes', label: 'Active classes', render: (row) => row.active_classes },
                { key: 'signals', label: 'Progress signals', render: (row) => row.progress_topic_count },
              ]}
            />
          </div>
        </Card>
      ) : null}
    </DashboardShell>
  );
}
