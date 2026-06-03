import { Brain } from 'lucide-react';
import { ErrorState, PageShell, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils/format';
import type { StudentProgress } from '../../types/lms';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentProgressRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();

  return (
    <PageShell
      title="Student Progress"
      subtitle="Subject, topic, score, and cognitive-level tracking for learner support and reporting."
      section="student"
    >
      {data ? (
        <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => <StaggerItem key={metric.label}><StatCard metric={metric} /></StaggerItem>)}
        </StaggerGrid>
      ) : null}
      <Card>
        {loading ? <SkeletonCard /> : null}
        {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing progress...</p> : null}
        {error ? (
          <ErrorState title="Progress unavailable" description={error} onRetry={() => void reload()} />
        ) : null}
        {data && data.progress.length ? (
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
        {data && !data.progress.length ? (
          <EmptyState
            title="No topic mastery yet"
            description="Progress appears after marks, quizzes, or tutor updates. Start with your next assignment so the dashboard has something real to learn from."
            actionLabel="Open assignments"
            actionHref="/dashboard/student/assignments"
            icon={Brain}
          />
        ) : null}
      </Card>
    </PageShell>
  );
}
