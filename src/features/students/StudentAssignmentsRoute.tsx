import { useMemo } from 'react';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { AssignmentsDueSection, SubmittedAssignmentsList } from './StudentDashboardComponents';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);

  return (
    <PageShell
      title="Student Assignments"
      subtitle="Track assigned work, due dates, submissions, and tutor feedback."
      section="student"
    >
      <Card>
        {loading ? <SkeletonCard /> : null}
        {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing assignments...</p> : null}
        {error ? (
          <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} />
        ) : null}
        {data ? (
          <AssignmentsDueSection
            studentData={studentData!}
          />
        ) : null}
      </Card>
      {data ? <SubmittedAssignmentsList assignmentsById={studentData!.assignmentsById} submissions={data.submissions} /> : null}
    </PageShell>
  );
}
