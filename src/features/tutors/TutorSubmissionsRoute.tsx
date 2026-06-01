import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
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
        {loading ? <p className="mt-4 text-sm text-slate-600">Loading submissions...</p> : null}
        {error ? (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-slate-950">Submissions unavailable</h3>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
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
