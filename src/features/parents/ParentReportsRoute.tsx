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
    <DashboardShell title="My child" subtitle="Guardian Reports: a parent-safe learning update with recent evidence and a clear way to support the next step." section="parent">
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
        <section className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">What to focus on now</p>
          <p className="mt-1"><span className="font-semibold">{student.latest_topic.topic}</span> is the current focus area ({student.latest_topic.score}%). Ask your child to explain one worked example, then encourage a short independent practice block.</p>
        </section>
      ) : null}
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent engagement</p><p className="mt-2 font-semibold text-slate-950">{student.session_count} session{student.session_count === 1 ? '' : 's'} · {student.attendance_rate == null ? 'attendance pending' : `${student.attendance_rate}% attendance`}</p><p className="mt-1 text-sm text-slate-600">{student.completed_work_count} task{student.completed_work_count === 1 ? '' : 's'} submitted in the past two weeks.</p></div>
        <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Next tutoring session</p><p className="mt-2 font-semibold text-slate-950">{student.next_session_date ? formatDate(student.next_session_date) : 'Not scheduled yet'}</p><p className="mt-1 text-sm text-slate-600">{student.latest_student_summary || 'Ask your child: “What is the one thing you are fixing next?”'}</p></div>
      </section>
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
