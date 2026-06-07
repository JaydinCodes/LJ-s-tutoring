import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { DashboardMetric } from '../../types/lms';
import { loadParentProgressReports, type ParentReportStudent } from './parentReportsRepository';

export function ParentReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadParentProgressReports, []);

  const students = data?.students || [];
  const metrics: DashboardMetric[] = [
    { label: 'Linked learners', value: String(students.length), helper: 'Learners linked to your guardian profile.', tone: 'teal' },
    { label: 'Released results', value: String(students.reduce((total, student) => total + student.released_results.length, 0)), helper: 'Only tutor/admin released results are shown.', tone: 'amber' },
    { label: 'Average mark', value: formatAverage(students.flatMap((student) => student.released_results.map((resultRow) => resultRow.marks_awarded))), helper: 'Across visible released marks.', tone: 'blue' },
  ];

  return (
    <DashboardShell title="Guardian Reports" subtitle="Released learner progress available through your linked guardian record." section="parent">
      {data ? <section className="grid gap-4 md:grid-cols-3">{metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}</section> : null}
      {loading ? <LoadingState title="Loading guardian reports" description="Checking linked learners and released results..." /> : null}
      {error ? <ErrorState title="Guardian reports unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/parent/reports" /> : null}
      {data && !students.length ? (
        <EmptyState title="No reports available" description="Reports appear after an admin links your guardian profile to an active learner and releases results for guardian access." />
      ) : null}
      <section className="grid gap-4">
        {students.map((student) => <ParentStudentReport key={student.student_id} student={student} />)}
      </section>
    </DashboardShell>
  );
}

function ParentStudentReport({ student }: { student: ParentReportStudent }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-aegean">Parent report</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{student.student_name}</h2>
          <p className="mt-1 text-sm text-slate-600">{[student.grade, student.school].filter(Boolean).join(' | ') || 'Learner profile'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Average released mark</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{student.average_mark == null ? '--' : `${student.average_mark}%`}</p>
        </div>
      </div>
      {student.latest_topic ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Latest progress signal: <span className="font-semibold">{student.latest_topic.topic}</span> at {student.latest_topic.score}%.
        </p>
      ) : null}
      <div className="mt-5">
        <DataTable
          rows={student.released_results}
          empty="No released results are visible for this learner yet."
          columns={[
            { key: 'assignment', label: 'Assignment', render: (row) => <span className="font-semibold text-slate-950">{row.assignment_title}</span> },
            { key: 'mark', label: 'Mark', render: (row) => `${row.marks_awarded}%` },
            { key: 'feedback', label: 'Feedback', render: (row) => row.feedback || 'Not released' },
            { key: 'released', label: 'Released', render: (row) => formatDate(row.released_at) },
          ]}
        />
      </div>
    </Card>
  );
}

function formatAverage(values: number[]) {
  const cleanValues = values.filter(Number.isFinite);
  if (!cleanValues.length) return '--';
  return `${Math.round((cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length) * 10) / 10}%`;
}
