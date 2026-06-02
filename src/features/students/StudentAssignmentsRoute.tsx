import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { AssignmentDueCard } from './StudentDashboardComponents';
import { assignmentStatusBucketOrder, normalizeStudentData, type AssignmentStatusBucket } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

const assignmentTabs: Array<{
  key: AssignmentStatusBucket;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    key: 'due-now',
    label: 'Due Now',
    description: 'Assignments that still need action, including overdue work and returned corrections.',
    emptyTitle: 'No assignments need action',
    emptyDescription: 'You do not have overdue, due-soon, or correction work waiting right now.',
  },
  {
    key: 'submitted',
    label: 'Submitted',
    description: 'Work sent in and waiting for tutor review or final marking.',
    emptyTitle: 'No submitted work waiting',
    emptyDescription: 'After you upload an assignment, it will move here while feedback is pending.',
  },
  {
    key: 'marked',
    label: 'Marked',
    description: 'Released feedback, marks, and completed assignment outcomes.',
    emptyTitle: 'No marked assignments yet',
    emptyDescription: 'Marks and written feedback will appear here once your tutor releases them.',
  },
  {
    key: 'archived',
    label: 'Archived',
    description: 'Closed, draft, or archived assignments kept out of your active workflow.',
    emptyTitle: 'No archived assignments',
    emptyDescription: 'Older or closed assignments will collect here without cluttering your active tabs.',
  },
];

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const { assignmentId } = useParams();
  const studentData = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [activeBucket, setActiveBucket] = useState<AssignmentStatusBucket>('due-now');
  const selectedBucket = useMemo(() => {
    if (!studentData || !assignmentId) return null;

    for (const bucket of assignmentStatusBucketOrder) {
      if ((studentData.assignmentBuckets.get(bucket) || []).some((assignment) => assignment.id === assignmentId)) {
        return bucket;
      }
    }

    return null;
  }, [assignmentId, studentData]);
  const activeTab = assignmentTabs.find((tab) => tab.key === activeBucket) || assignmentTabs[0];
  const activeAssignments = studentData?.assignmentBuckets.get(activeBucket) || [];

  useEffect(() => {
    if (selectedBucket) {
      setActiveBucket(selectedBucket);
    }
  }, [selectedBucket]);

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

            <div className="grid gap-2 rounded-[1.5rem] bg-brand-parchment/70 p-2 dark:bg-brand-navy/40 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Assignment status buckets">
              {assignmentTabs.map((tab) => {
                const isActive = tab.key === activeBucket;
                const count = studentData.assignmentBuckets.get(tab.key)?.length || 0;
                return (
                  <button
                    key={tab.key}
                    aria-controls={`assignment-panel-${tab.key}`}
                    aria-selected={isActive}
                    className={`rounded-2xl px-4 py-3 text-left transition ${isActive ? 'bg-white text-brand-navy shadow-sm dark:bg-brand-obsidian dark:text-brand-parchment' : 'text-slate-600 hover:bg-white/60 dark:text-brand-marble dark:hover:bg-brand-obsidian/60'}`}
                    id={`assignment-tab-${tab.key}`}
                    role="tab"
                    type="button"
                    onClick={() => setActiveBucket(tab.key)}
                  >
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className="mt-1 block text-xs">{count} assignment{count === 1 ? '' : 's'}</span>
                  </button>
                );
              })}
            </div>

            <section
              aria-labelledby={`assignment-tab-${activeBucket}`}
              className="rounded-[1.5rem] border border-brand-marble bg-white/80 p-4 dark:border-brand-marble/20 dark:bg-brand-obsidian/80"
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
                      isSelected={assignment.id === assignmentId}
                    />
                  </StaggerItem>
                ))}
              </StaggerGrid>

              {!activeAssignments.length ? (
                <EmptyState title={activeTab.emptyTitle} description={activeTab.emptyDescription} />
              ) : null}
            </section>
          </div>
        ) : null}
      </Card>
    </PageShell>
  );
}
