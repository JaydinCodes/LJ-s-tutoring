import { useMemo } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  AssignmentsDueSection,
  LatestResultsCard,
  ProgressSummaryCards,
  StudentWelcomeCard,
  SubmittedAssignmentsList,
} from './StudentDashboardComponents';
import { normalizeStudentData, selectCompletionRate, selectDueTasks } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentDashboardRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const nextAssignment = studentData ? selectDueTasks(studentData, 1)[0]?.assignment : undefined;
  const completionRate = studentData ? selectCompletionRate(studentData) : 0;

  return (
    <DashboardShell
      title="Student Dashboard"
      subtitle="A React-first learner view for assignments, progress, class context, and submission status."
      section="student"
    >
      {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing dashboard...</p> : null}
      {loading ? <DashboardSkeleton /> : null}
      {error ? (
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Dashboard unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
        </Card>
      ) : null}
      {data ? (
        <>
          <StudentWelcomeCard data={data} nextAssignment={nextAssignment} completionRate={completionRate} />
          <ProgressSummaryCards studentData={studentData!} submissions={data.submissions} progress={data.progress} />

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Assignments due</h2>
                    <p className="mt-1 text-sm text-slate-600">Priority ordered by overdue, due soon, review state, and released marks.</p>
                  </div>
                </div>
                <div className="mt-5">
                  <AssignmentsDueSection
                    studentData={studentData!}
                    limit={4}
                  />
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Progress summary</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.progress.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">{item.topic}</p>
                        <p className="text-sm font-semibold text-teal-700">{item.score}%</p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-teal-500" style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} />
                      </div>
                    </div>
                  ))}
                  {!data.progress.length ? <EmptyState title="No progress records yet" description="Progress records should move into the student_progress table during data migration." /> : null}
                </div>
              </Card>
            </div>

            <aside className="space-y-4">
              <LatestResultsCard assignmentsById={studentData!.assignmentsById} submissions={data.submissions} />
              <SubmittedAssignmentsList assignmentsById={studentData!.assignmentsById} submissions={data.submissions} />
              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Profile</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  {[
                    ['Name', data.profile.name],
                    ['Grade', data.profile.grade || 'Pending'],
                    ['School', data.profile.school || 'Pending'],
                    ['Parent', data.profile.parent || 'Pending'],
                    ['NGO partner', data.profile.ngoPartner || 'Direct / pending'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-3 py-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Classes</h2>
                <div className="mt-4 space-y-3">
                  {data.classes.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                      <p className="font-semibold">{item.subject || 'Class'}</p>
                      <p className="mt-1 text-sm text-slate-600">{[item.day_of_week, item.start_time, item.location].filter(Boolean).join(' | ') || 'Schedule pending'}</p>
                    </div>
                  ))}
                  {!data.classes.length ? <EmptyState title="No class records yet" description="Current subject and class information will appear once classes and enrollments are migrated." /> : null}
                </div>
              </Card>
            </aside>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-64 animate-pulse rounded-[2rem] bg-blue-100" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-[1.5rem] bg-white/80" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="h-96 animate-pulse rounded-[1.5rem] bg-white/80" />
        <div className="h-96 animate-pulse rounded-[1.5rem] bg-white/80" />
      </div>
    </div>
  );
}
