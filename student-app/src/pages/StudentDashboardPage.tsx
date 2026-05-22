import { DashboardLayout } from '../components/DashboardLayout';
import { AssignmentCard } from '../components/cards/AssignmentCard';
import { QuickActionsPanel } from '../components/cards/QuickActionsPanel';
import { ResultsSummaryCard } from '../components/cards/ResultsSummaryCard';
import { StatCard } from '../components/cards/StatCard';
import { UpcomingTasksCard } from '../components/cards/UpcomingTasksCard';
import { SubjectPerformanceChart } from '../components/charts/SubjectPerformanceChart';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useAsyncData } from '../hooks/useAsyncData';
import { studentApi } from '../lib/api';
import { average, formatDate } from '../lib/format';
import { uploadAssignmentSubmission, validateSubmissionFile } from '../lib/assignments';

export function StudentDashboardPage() {
  const dashboard = useAsyncData(() => studentApi.dashboard(), []);
  const assignments = useAsyncData(() => studentApi.assignments(), []);
  const results = useAsyncData(() => studentApi.results(), []);
  const stats = useAsyncData(() => studentApi.classStats(), []);

  const sessionName = dashboard.data?.profile?.name || 'Student';
  const sessionPicture = undefined;

  const subtitle = dashboard.data?.recommendedNext?.description || 'Track progress, stay ahead of due work, and move confidently through the week.';

  const percentageAverage = average((results.data?.items || []).map((item) => Number(item.percentage)).filter(Number.isFinite));
  const pendingAssignments = (assignments.data?.items || []).filter((item) => !['submitted', 'marked'].includes(String(item.submission_status || item.status || '').toLowerCase()));
  const completedAssignments = (assignments.data?.items || []).filter((item) => ['submitted', 'marked'].includes(String(item.submission_status || item.status || '').toLowerCase()));
  const attendanceRate = dashboard.data?.attendance?.total ? Math.round((dashboard.data.attendance.attended / dashboard.data.attendance.total) * 100) : 0;
  const upcomingItems = [
    ...(dashboard.data?.today?.session ? [{
      title: dashboard.data.today.session.subject || 'Upcoming lesson',
      meta: `${formatDate(dashboard.data.today.session.date, { weekday: 'short', day: 'numeric', month: 'short' })} | ${dashboard.data.today.session.startTime}`,
      tone: 'lesson' as const,
    }] : []),
    ...pendingAssignments.slice(0, 3).map((item) => ({
      title: item.title || item.topic || 'Assignment due',
      meta: item.due_date || item.dueDate ? `Due ${formatDate(item.due_date || item.dueDate)}` : 'Due date pending',
      tone: 'task' as const,
    })),
  ];

  const rightRailItems = [
    ...(dashboard.data?.goals || []).slice(0, 2).map((goal) => ({
      title: goal.title,
      meta: goal.due_date ? `Goal due ${formatDate(goal.due_date)}` : goal.status || 'Active goal',
      tone: 'goal' as const,
    })),
  ];

  const loading = dashboard.loading || assignments.loading || results.loading || stats.loading;
  const error = dashboard.error || assignments.error || results.error || stats.error;

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle={subtitle}
      name={sessionName}
      avatar={sessionPicture}
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LoadingState />
          <LoadingState />
          <LoadingState />
          <LoadingState />
        </div>
      ) : error ? (
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => { void dashboard.reload(); void assignments.reload(); void results.reload(); void stats.reload(); }} />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Overall score" value={percentageAverage == null ? '--' : `${percentageAverage}%`} helper="Recent academic average across available results." tone="violet" />
            <StatCard label="Assignments completed" value={String(completedAssignments.length)} helper="Submitted or marked work confirmed by the LMS." tone="teal" />
            <StatCard label="Pending assignments" value={String(pendingAssignments.length)} helper="Open learner tasks that still need action." tone="gold" />
            <StatCard label="Study streak / attendance" value={`${dashboard.data?.streak?.current ?? 0}d / ${attendanceRate}%`} helper="Consistency and session attendance in one view." tone="blue" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_380px]">
            <div className="space-y-4">
              <article className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.3),_transparent_24rem),linear-gradient(135deg,_#091427_0%,_#12203c_55%,_#1a2854_100%)] p-6 text-white shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-200">Focused next step</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{dashboard.data?.recommendedNext?.title || 'Build one strong study block'}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">{dashboard.data?.recommendedNext?.description || 'Choose one subject, focus deeply, and leave the next session better prepared than this one.'}</p>
              </article>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Assignments due</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Live learner tasks with direct upload actions.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {pendingAssignments.length ? pendingAssignments.slice(0, 3).map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        validateUpload={validateSubmissionFile}
                        onUpload={async (assignmentId, file) => {
                          await uploadAssignmentSubmission(assignmentId, file);
                          await assignments.reload();
                        }}
                      />
                    )) : <EmptyState title="No assignments due right now" description="When tutors or admins publish work for you, it will appear here automatically." />}
                  </div>
                </div>

                <div className="space-y-4">
                  <UpcomingTasksCard title="Upcoming lessons and tasks" items={upcomingItems.length ? upcomingItems : [{ title: 'No upcoming events yet', meta: 'Sessions, assignments, and visible milestones will appear here.', tone: 'task' }]} />
                  <UpcomingTasksCard title="Goals and milestones" items={rightRailItems.length ? rightRailItems : [{ title: 'No goals yet', meta: 'Academic and attendance goals will appear once assigned.', tone: 'goal' }]} />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <SubjectPerformanceChart items={dashboard.data?.progressSnapshot || []} />
                <div className="space-y-4">
                  {(results.data?.items || []).slice(0, 2).map((result) => <ResultsSummaryCard key={result.id} result={result} />)}
                  {!results.data?.items?.length ? <EmptyState title="No marked assignments yet" description="Results will surface here once tutors finish marking and release feedback." /> : null}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Learner summary</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                    <p className="font-semibold text-slate-900 dark:text-white">{dashboard.data?.profile?.name || 'Learner'}</p>
                    <p className="mt-1">{[dashboard.data?.academicProfile?.grade, dashboard.data?.academicProfile?.school].filter(Boolean).join(' | ') || 'Academic profile loading from LMS.'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                    <p className="font-semibold text-slate-900 dark:text-white">Support status</p>
                    <p className="mt-1">{dashboard.data?.supportStatus?.explanation || 'Support signals will appear once enough activity is recorded.'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                    <p className="font-semibold text-slate-900 dark:text-white">Tutor coverage</p>
                    <p className="mt-1">{dashboard.data?.assignedTutors?.length ? dashboard.data.assignedTutors.map((item) => `${item.full_name}${item.subject ? ` (${item.subject})` : ''}`).join(', ') : 'No tutor assigned yet.'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                    <p className="font-semibold text-slate-900 dark:text-white">Recent activity</p>
                    <p className="mt-1">{dashboard.data?.sessionSummaries?.[0]?.student_summary || 'Approved sessions and tutor notes will appear here.'}</p>
                  </div>
                </div>
              </article>
              <QuickActionsPanel />
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
