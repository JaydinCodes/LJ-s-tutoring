import { DashboardLayout } from '../components/DashboardLayout';
import { ResultsSummaryCard } from '../components/cards/ResultsSummaryCard';
import { SubjectPerformanceChart } from '../components/charts/SubjectPerformanceChart';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useAsyncData } from '../hooks/useAsyncData';
import { studentApi } from '../lib/api';

export function ResultsPage() {
  const dashboard = useAsyncData(() => studentApi.dashboard(), []);
  const results = useAsyncData(() => studentApi.results(), []);

  return (
    <DashboardLayout title="Results" subtitle="Scores, feedback, and performance context from existing results data." name={dashboard.data?.profile?.name || 'Student'}>
      {results.loading ? <LoadingState lines={5} /> : results.error ? <ErrorState title="Results unavailable" description={results.error} onRetry={() => void results.reload()} /> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            {results.data?.items?.length ? results.data.items.map((result) => <ResultsSummaryCard key={result.id} result={result} />) : <EmptyState title="No marked assignments yet" description="Results and tutor feedback will appear here once released." />}
          </div>
          <SubjectPerformanceChart items={dashboard.data?.progressSnapshot || []} />
        </div>
      )}
    </DashboardLayout>
  );
}
