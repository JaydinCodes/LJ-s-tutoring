import { useMemo } from 'react';
import { AnimatedProgressBar, ErrorState, InsightCard, PageShell, SkeletonCard, StaggerGrid, StaggerItem, TimelineCard } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  AssignmentsDueSection,
  LatestResultsCard,
  ProgressSummaryCards,
  StudentWelcomeCard,
  SubmittedAssignmentsList,
  TodayBattlePlan,
} from './StudentDashboardComponents';
import { normalizeStudentData, selectCompletionRate, selectDueTasks } from './studentData';
import { selectTodayBattlePlan } from './studentBattlePlan';
import { selectDailyInsight } from './studentDailyInsight';
import { useStudentDashboardQuery } from './studentQueries';

export function StudentDashboardRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const nextAssignment = studentData ? selectDueTasks(studentData, 1)[0]?.assignment : undefined;
  const completionRate = studentData ? selectCompletionRate(studentData) : 0;
  const dailyInsight = useMemo(() => data && studentData ? selectDailyInsight(data, studentData) : null, [data, studentData]);
  const battlePlan = useMemo(() => data && studentData ? selectTodayBattlePlan(data, studentData) : [], [data, studentData]);

  return (
    <PageShell
      title="Student Dashboard"
      subtitle="A React-first learner view for assignments, progress, class context, and submission status."
      section="student"
    >
      {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing dashboard...</p> : null}
      {loading ? <DashboardSkeleton /> : null}
      {error ? (
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void reload()} />
      ) : null}
      {data ? (
        <>
          <StudentWelcomeCard data={data} nextAssignment={nextAssignment} completionRate={completionRate} dailyInsight={dailyInsight!} />
          <ProgressSummaryCards data={data} studentData={studentData!} progress={data.progress} />
          <TodayBattlePlan items={battlePlan} />

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
                <StaggerGrid className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.progress.slice(0, 6).map((item) => (
                    <StaggerItem key={item.id}>
                      <InsightCard title={item.topic}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-600 dark:text-brand-marble">Topic mastery</p>
                          <p className="text-sm font-semibold text-brand-aegean dark:text-brand-gold">{item.score}%</p>
                        </div>
                        <div className="mt-3">
                          <AnimatedProgressBar value={item.score} />
                        </div>
                      </InsightCard>
                    </StaggerItem>
                  ))}
                  {!data.progress.length ? <EmptyState title="No progress records yet" description="Progress records should move into the student_progress table during data migration." /> : null}
                </StaggerGrid>
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
                    <TimelineCard key={label} title={label} meta={value} />
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
    </PageShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonCard className="h-64" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <SkeletonCard key={item} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <SkeletonCard className="h-96" />
        <SkeletonCard className="h-96" />
      </div>
    </div>
  );
}
