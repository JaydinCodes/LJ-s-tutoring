import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate } from '../../lib/utils/format';
import type { StudentProgress } from '../../types/lms';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentProgressRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();

  return (
    <DashboardShell
      title="Student Progress"
      subtitle="Subject, topic, score, and cognitive-level tracking for learner support and reporting."
      section="student"
    >
      {data ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
        </section>
      ) : null}
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading progress...</p> : null}
        {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing progress...</p> : null}
        {error ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Progress unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
        {data ? (
          <DataTable<StudentProgress>
            rows={data.progress}
            empty="No progress records have been captured yet."
            columns={[
              { key: 'topic', label: 'Topic', render: (row) => <span className="font-semibold text-slate-950">{row.topic}</span> },
              { key: 'subject', label: 'Subject', render: (row) => row.subject || 'Subject pending' },
              { key: 'score', label: 'Score', render: (row) => `${row.score}%` },
              { key: 'level', label: 'Cognitive level', render: (row) => row.cognitive_level || 'Pending' },
              { key: 'recorded', label: 'Recorded', render: (row) => formatDate(row.recorded_at) },
            ]}
          />
        ) : null}
      </Card>
    </DashboardShell>
  );
}
