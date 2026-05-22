import { DashboardLayout } from '../components/DashboardLayout';
import { AssignmentCard } from '../components/cards/AssignmentCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useAsyncData } from '../hooks/useAsyncData';
import { studentApi } from '../lib/api';
import { uploadAssignmentSubmission, validateSubmissionFile } from '../lib/assignments';

export function AssignmentsPage() {
  const dashboard = useAsyncData(() => studentApi.dashboard(), []);
  const assignments = useAsyncData(() => studentApi.assignments(), []);

  return (
    <DashboardLayout title="Assignments" subtitle="Due work, uploads, and submission states powered by the LMS." name={dashboard.data?.profile?.name || 'Student'}>
      {assignments.loading ? <LoadingState lines={6} /> : assignments.error ? <ErrorState title="Assignments unavailable" description={assignments.error} onRetry={() => void assignments.reload()} /> : (
        <div className="space-y-4">
          {assignments.data?.items?.length ? assignments.data.items.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              validateUpload={validateSubmissionFile}
              onUpload={async (assignmentId, file) => {
                await uploadAssignmentSubmission(assignmentId, file);
                await assignments.reload();
              }}
            />
          )) : <EmptyState title="No assignments available" description="Tutor-created and admin-created assignments will appear here automatically." />}
        </div>
      )}
    </DashboardLayout>
  );
}
