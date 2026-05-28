import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { AssignmentSubmission, StudentProgress } from '../../types/lms';
import { calculateAssignmentStatus } from '../assignments/assignmentStatus';
import { loadStudentDashboard } from './studentDashboardRepository';

export function StudentResultsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadStudentDashboard, []);
  const markedSubmissions = (data?.submissions || []).filter((submission) => submission.status === 'marked' || submission.marks_awarded != null);
  const assignmentsById = new Map((data?.assignments || []).map((assignment) => [assignment.id, assignment]));

  return (
    <DashboardShell
      title="Results"
      subtitle="Marked submissions, tutor feedback, and subject-level progress in the unified React student dashboard."
      section="student"
    >
      {data ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Marked work</h2>
          <p className="mt-1 text-sm text-slate-600">Feedback appears here once an admin or tutor marks an assignment submission.</p>
          <div className="mt-5">
            {loading ? <p className="text-sm text-slate-600">Loading results...</p> : null}
            {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
            {data ? (
              <DataTable<AssignmentSubmission>
                rows={markedSubmissions}
                empty="No marked submissions have been released yet."
                columns={[
                  { key: 'assignment', label: 'Assignment', render: (row) => assignmentsById.get(row.assignment_id)?.title || row.assignment_id },
                  { key: 'marks', label: 'Marks', render: (row) => row.marks_awarded == null ? 'Pending' : `${row.marks_awarded}%` },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge value={calculateAssignmentStatus({ assignment: assignmentsById.get(row.assignment_id) || { status: 'published', due_date: null, id: '', title: '', created_at: '' }, submission: row })} /> },
                  { key: 'submitted', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
                ]}
              />
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Feedback</h2>
          <div className="mt-4 space-y-3">
            {markedSubmissions.slice(0, 6).map((submission) => (
              <div key={submission.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{assignmentsById.get(submission.assignment_id)?.title || submission.assignment_id}</p>
                  <p className="text-sm font-semibold text-teal-700">{submission.marks_awarded == null ? 'Pending' : `${submission.marks_awarded}%`}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{submission.feedback || 'No written feedback was supplied.'}</p>
              </div>
            ))}
            {data && !markedSubmissions.length ? <EmptyState title="No feedback yet" description="Tutor and admin comments will appear here after marking." /> : null}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Progress records</h2>
        <div className="mt-5">
          {data ? (
            <DataTable<StudentProgress>
              rows={data.progress}
              empty="No progress records are available yet."
              columns={[
                { key: 'topic', label: 'Topic', render: (row) => <span className="font-semibold text-slate-950">{row.topic}</span> },
                { key: 'subject', label: 'Subject', render: (row) => row.subject || 'Subject pending' },
                { key: 'score', label: 'Score', render: (row) => `${row.score}%` },
                { key: 'recorded', label: 'Recorded', render: (row) => formatDate(row.recorded_at) },
              ]}
            />
          ) : null}
        </div>
      </Card>
    </DashboardShell>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Results unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </div>
  );
}
