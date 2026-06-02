import { useMemo } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { AssignmentsDueSection, SubmittedAssignmentsList } from './StudentDashboardComponents';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);

  return (
    <DashboardShell
      title="Student Assignments"
      subtitle="Track assigned work, due dates, submissions, and tutor feedback."
      section="student"
    >
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading assignments...</p> : null}
        {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing assignments...</p> : null}
        {error ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Assignments unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
        {data ? (
          <AssignmentsDueSection
            studentData={studentData!}
          />
        ) : null}
      </Card>
      {data ? <SubmittedAssignmentsList assignmentsById={studentData!.assignmentsById} submissions={data.submissions} /> : null}
    </DashboardShell>
  );
}
