import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { ClassRecord } from '../../types/lms';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorClassesRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Tutor Classes" subtitle="Scheduled classes and delivery context linked to the current tutor profile." section="tutor">
      <Card>
        {loading ? <LoadingState title="Loading classes" description="Fetching classes linked to your tutor profile..." /> : null}
        {error ? <ErrorState title="Classes unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/tutor" /> : null}
        {data ? (
          <DataTable<ClassRecord>
            rows={data.classes}
            empty="No classes are linked to this tutor profile yet."
            columns={[
              { key: 'subject', label: 'Subject', render: (row) => <span className="font-semibold text-slate-950">{row.name || row.subject || row.subject_id || 'Class'}</span> },
              { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
              { key: 'schedule', label: 'Schedule', render: (row) => [row.day_of_week, row.start_time, row.end_time].filter(Boolean).join(' | ') || 'Pending' },
              { key: 'location', label: 'Location', render: (row) => row.location || 'Pending' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'active'} /> },
            ]}
          />
        ) : null}
      </Card>
    </DashboardShell>
  );
}
