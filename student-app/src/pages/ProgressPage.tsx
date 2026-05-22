import { DashboardLayout } from '../components/DashboardLayout';
import { StatCard } from '../components/cards/StatCard';
import { SubjectPerformanceChart } from '../components/charts/SubjectPerformanceChart';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useAsyncData } from '../hooks/useAsyncData';
import { studentApi } from '../lib/api';

export function ProgressPage() {
  const dashboard = useAsyncData(() => studentApi.dashboard(), []);

  const attendanceRate = dashboard.data?.attendance?.total ? Math.round((dashboard.data.attendance.attended / dashboard.data.attendance.total) * 100) : 0;

  return (
    <DashboardLayout title="Progress" subtitle="Subject trends, learning rhythm, and improvement signals." name={dashboard.data?.profile?.name || 'Student'}>
      {dashboard.loading ? <LoadingState lines={6} /> : dashboard.error ? <ErrorState title="Progress unavailable" description={dashboard.error} onRetry={() => void dashboard.reload()} /> : (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="Study minutes" value={String(dashboard.data?.thisWeek?.minutesStudied ?? 0)} helper="Focused minutes recorded this week." tone="teal" />
            <StatCard label="Sessions attended" value={String(dashboard.data?.thisWeek?.sessionsAttended ?? 0)} helper="Approved sessions contributing to your progress." tone="blue" />
            <StatCard label="Attendance rate" value={`${attendanceRate}%`} helper="Attendance across completed sessions." tone="gold" />
          </section>
          <SubjectPerformanceChart items={dashboard.data?.progressSnapshot || []} />
          {!dashboard.data?.progressSnapshot?.length ? <EmptyState title="No progress data yet" description="Once approved sessions and tracked activity build up, this page will show subject-level movement." /> : null}
        </div>
      )}
    </DashboardLayout>
  );
}
