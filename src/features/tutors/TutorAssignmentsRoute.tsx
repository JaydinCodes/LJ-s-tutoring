import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment } from '../../types/lms';
import { AssignmentLifecycleCard, CreateAssignmentForm } from '../admin/AdminAssignmentsRoute';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorAssignmentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Assignments" subtitle="Create worksheets, attach resources, set due dates, and manage work you have assigned." section="tutor">
      <CreateAssignmentForm role="tutor" onCreated={reload} />
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Your assignments</h2>
        <p className="mt-1 text-sm text-slate-600">Only assignments created by your tutor account are shown here. Student submissions are reviewed from the Submissions page.</p>
        {loading ? <LoadingState title="Loading assignments" description="Fetching assignments created by your tutor account..." /> : null}
        {error ? <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/tutor" /> : null}
        {data ? (
          <div className="mt-5 space-y-5">
            <DataTable<Assignment>
              rows={data.assignments}
              empty="You have not created an assignment yet."
              columns={[
                { key: 'title', label: 'Title', render: (row) => <span className="font-semibold text-slate-950">{row.title || row.id}</span> },
                { key: 'subject', label: 'Subject', render: (row) => row.subject || row.subject_id || 'Pending' },
                { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'draft'} /> },
              ]}
            />
            {data.assignments.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {data.assignments.map((assignment) => <AssignmentLifecycleCard key={assignment.id} assignment={assignment} onSaved={reload} />)}
              </div>
            ) : <EmptyState title="No assignments yet" description="Publish your first worksheet or assessment above." />}
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}
