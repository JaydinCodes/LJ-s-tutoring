import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { AssignmentsDueSection, SubmittedAssignmentsList } from './StudentDashboardComponents';
import { loadStudentDashboard } from './studentDashboardRepository';

export function StudentAssignmentsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadStudentDashboard, []);
  const submissionByAssignment = new Map((data?.submissions || []).map((item) => [item.assignment_id, item]));
  const assignmentsById = new Map((data?.assignments || []).map((item) => [item.id, item]));

  return (
    <DashboardShell
      title="Student Assignments"
      subtitle="Learner assignment status from Supabase first, with the current LMS API as a migration fallback."
      section="student"
    >
      <Card>
        {loading ? <p className="text-sm text-slate-600">Loading assignments...</p> : null}
        {error ? (
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Assignments unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
          </div>
        ) : null}
        {data ? (
          <AssignmentsDueSection
            assignments={data.assignments}
            submissionsByAssignment={submissionByAssignment}
            onSubmitted={reload}
          />
        ) : null}
      </Card>
      {data ? <SubmittedAssignmentsList assignmentsById={assignmentsById} submissions={data.submissions} /> : null}
    </DashboardShell>
  );
}
