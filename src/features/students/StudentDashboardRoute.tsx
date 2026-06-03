import { useMemo } from 'react';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import {
  LearningTimeline,
  SubjectProgressBands,
  TodayOdyssey,
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
      title="Today"
      subtitle="Your next useful learning step, ordered by urgency, revision value, and momentum."
      section="student"
    >
      {refetching ? <p className="academy-chip w-fit text-academy-aegean dark:text-academy-gold">Refreshing today&apos;s plan...</p> : null}
      {loading ? <DashboardSkeleton /> : null}
      {error ? (
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void reload()} />
      ) : null}
      {data ? (
        <div className="space-y-6">
          <TodayOdyssey
            data={data}
            nextAssignment={nextAssignment}
            completionRate={completionRate}
            dailyInsight={dailyInsight!}
            battlePlan={battlePlan}
          />
          <LearningTimeline items={battlePlan} />
          <SubjectProgressBands progress={data.progress} />
        </div>
      ) : null}
    </PageShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-72" />
      {[0, 1, 2].map((item) => <SkeletonCard key={item} className="h-24" />)}
      <SkeletonCard className="h-64" />
    </div>
  );
}
