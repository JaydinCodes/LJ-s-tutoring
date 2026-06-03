import { useMemo, useState } from 'react';
import { Clock, ScrollText, Trophy, UploadCloud, type LucideIcon } from 'lucide-react';
import { ErrorState, PageShell, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { AssignmentDueCard } from './StudentDashboardComponents';
import { normalizeStudentData, type AssignmentStatusBucket } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

const assignmentTabs: Array<{
  key: AssignmentStatusBucket;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction: string;
  icon: LucideIcon;
}> = [
  {
    key: 'due-now',
    label: 'Due Now',
    description: 'Assignments that still need action, including overdue work and returned corrections.',
    emptyTitle: 'No assignments need action',
    emptyDescription: 'Your active assignment lane is clear. Use this time for revision or check progress for the next weak topic.',
    emptyAction: 'Open progress',
    icon: Clock,
  },
  {
    key: 'submitted',
    label: 'Submitted',
    description: 'Work sent in and waiting for tutor review or final marking.',
    emptyTitle: 'No submitted work waiting',
    emptyDescription: 'When you upload work, it will move here with its review status so you know it was received.',
    emptyAction: 'Go to due work',
    icon: UploadCloud,
  },
  {
    key: 'marked',
    label: 'Marked',
    description: 'Released feedback, marks, and completed assignment outcomes.',
    emptyTitle: 'No marked assignments yet',
    emptyDescription: 'Released feedback and marks will collect here so you can see what improved and what to fix next.',
    emptyAction: 'Open results',
    icon: Trophy,
  },
  {
    key: 'archived',
    label: 'Archived',
    description: 'Closed, draft, or archived assignments kept out of your active workflow.',
    emptyTitle: 'No archived assignments',
    emptyDescription: 'Older or closed assignments will collect here without cluttering your active work lane.',
    emptyAction: 'Back to due work',
    icon: ScrollText,
  },
];

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [activeBucket, setActiveBucket] = useState<AssignmentStatusBucket>('due-now');
  const activeTab = assignmentTabs.find((tab) => tab.key === activeBucket) || assignmentTabs[0];
  const activeAssignments = studentData?.assignmentBuckets.get(activeBucket) || [];

  return (
    <PageShell
      title="Student Assignments"
      subtitle="Track assigned work, due dates, submissions, and tutor feedback."
      section="student"
    >
      <Card>
        {loading ? <SkeletonCard /> : null}
        {error ? (
          <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} />
        ) : null}
        {studentData ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">Assignment desk</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">Work sorted by status</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">Each assignment appears in one tab only, so your next action is easier to find.</p>
              </div>
              {refetching ? <p className="text-sm font-semibold text-blue-700">Refreshing assignments...</p> : null}
            </div>

            <div className="grid gap-2 rounded-[1.5rem] border border-white/70 bg-white/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Assignment status buckets">
              {assignmentTabs.map((tab) => {
                const isActive = tab.key === activeBucket;
                const count = studentData.assignmentBuckets.get(tab.key)?.length || 0;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    aria-controls={`assignment-panel-${tab.key}`}
                    aria-selected={isActive}
                    className={`rounded-2xl px-4 py-3 text-left transition ${isActive ? 'bg-white/82 text-brand-navy shadow-sm dark:bg-white/[0.08] dark:text-brand-parchment' : 'text-slate-600 hover:bg-white/55 dark:text-brand-marble dark:hover:bg-white/[0.06]'}`}
                    id={`assignment-tab-${tab.key}`}
                    role="tab"
                    type="button"
                    onClick={() => setActiveBucket(tab.key)}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-current" aria-hidden="true" />
                      {tab.label}
                    </span>
                    <span className="mt-1 block text-xs">{count} assignment{count === 1 ? '' : 's'}</span>
                  </button>
                );
              })}
            </div>

            <section
              aria-labelledby={`assignment-tab-${activeBucket}`}
              className="rounded-[1.5rem] border border-white/70 bg-white/62 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]"
              id={`assignment-panel-${activeBucket}`}
              role="tabpanel"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{activeTab.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">{activeTab.description}</p>
              </div>

              <StaggerGrid className="grid gap-4">
                {activeAssignments.map((assignment) => (
                  <StaggerItem key={assignment.id}>
                    <AssignmentDueCard
                      assignment={assignment}
                      submission={studentData.submissionsByAssignmentId.get(assignment.id)}
                    />
                  </StaggerItem>
                ))}
              </StaggerGrid>

              {!activeAssignments.length ? (
                <EmptyState
                  title={activeTab.emptyTitle}
                  description={activeTab.emptyDescription}
                  actionLabel={activeTab.emptyAction}
                  actionHref={activeBucket === 'marked' ? '/dashboard/student/results' : activeBucket === 'due-now' ? '/dashboard/student/progress' : '/dashboard/student/assignments'}
                  icon={activeTab.icon}
                />
              ) : null}
            </section>
          </div>
        ) : null}
      </Card>
    </PageShell>
  );
}
