import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
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
      {loading ? <Card><p className="text-sm text-slate-600">Loading NGO cohort reports...</p></Card> : null}
      {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
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

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <h2 className="text-lg font-semibold text-red-950">NGO reports unavailable</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void onRetry()}>Retry</button>
    </Card>
  );
}
