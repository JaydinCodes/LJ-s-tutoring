import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { TutorSubmissionReviewCard } from './TutorSubmissionReviewCard';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorSubmissionsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Tutor Submissions" subtitle="Review, mark, and return learner submissions for assignments created by this tutor." section="tutor">
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Submission review queue</h2>
        <p className="mt-1 text-sm text-slate-600">Review learner work for assignments linked to your tutor account.</p>
        {loading ? <LoadingState title="Loading submissions" description="Fetching learner work assigned to your tutor profile..." /> : null}
        {error ? <ErrorState title="Submissions unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/tutor" /> : null}
        {data ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {data.submissions.map((submission) => (
              <TutorSubmissionReviewCard key={submission.id} submission={submission} onSaved={reload} />
            ))}
            {!data.submissions.length ? <EmptyState title="No submissions yet" description="Submitted learner work for tutor-created assignments will appear here." /> : null}
          </div>
        ) : null}
      </Card>
    </DashboardShell>
  );
}
