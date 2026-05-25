import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { ClassRecord } from '../../types/lms';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorClassesRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Tutor Classes" subtitle="Scheduled classes and delivery context linked to the current tutor profile." section="tutor">
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading classes...</p> : null}
        {error ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Classes unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
        {data ? (
          <DataTable<ClassRecord>
            rows={data.classes}
            empty="No classes are linked to this tutor profile yet."
            columns={[
              { key: 'subject', label: 'Subject', render: (row) => <span className="font-semibold text-slate-950">{row.subject || row.subject_id || 'Class'}</span> },
              { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
              { key: 'schedule', label: 'Schedule', render: (row) => [row.day_of_week, row.start_time, row.end_time].filter(Boolean).join(' | ') || 'Pending' },
              { key: 'location', label: 'Location', render: (row) => row.location || 'Pending' },
              { key: 'status', label: 'Status', render: () => <StatusBadge value="active" /> },
            ]}
          />
        ) : null}
      </Card>
    </DashboardShell>
  );
}
