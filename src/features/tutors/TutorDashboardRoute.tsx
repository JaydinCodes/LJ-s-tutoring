import { BookOpen, CalendarClock, ClipboardCheck, ScrollText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, GreekHeroCard, InsightCard, ProgressRing, SkeletonCard, TimelineCard } from '../../components/dashboard/DashboardDesignSystem';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, ClassRecord, TutorDashboardView } from '../../types/lms';
import { TutorSubmissionReviewCard } from './TutorSubmissionReviewCard';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Tutor Dashboard" subtitle="Class delivery, assignment follow-up, and submission review for active tutor accounts." section="tutor">
      {loading ? <LoadingDashboard /> : null}
      {error ? <ErrorState title="Tutor dashboard unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? (
        <>
          <GreekHeroCard
            eyebrow="Tutor operations"
            title={`Today with ${data.profile.name || 'your learners'}`}
            description="Use this cockpit to spot the learners who need attention, clear the marking queue, and open the next operational workflow."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ActionLink href="/dashboard/tutor/submissions" icon={ClipboardCheck} label="Mark work" meta={`${data.markingQueue.length} waiting`} />
              <ActionLink href="/dashboard/tutor/sessions" icon={CalendarClock} label="Sessions" meta={`${data.sessions.length} visible`} />
              <ActionLink href="/dashboard/tutor/classes" icon={BookOpen} label="Classes" meta={`${data.classes.length} active`} />
              <ActionLink href="/dashboard/tutor/reports" icon={ScrollText} label="Reports" meta="Weekly summaries" />
            </div>
          </GreekHeroCard>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Allocated students</h2>
                    <p className="mt-1 text-sm text-slate-600">Learner progress is calculated only from students actively allocated to this tutor.</p>
                  </div>
                  <Link className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm" to="/dashboard/tutor/risk">Open risk monitor</Link>
                </div>
                <div className="mt-4">
                  <DataTable
                    rows={data.learnerProgress}
                    empty="No students are allocated to this tutor profile yet."
                    columns={[
                      { key: 'name', label: 'Student', render: (row) => <LearnerCell row={row} /> },
                      { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                      { key: 'queue', label: 'Queue', render: (row) => `${row.pending_submissions} to mark` },
                      { key: 'average', label: 'Average', render: (row) => averageLabel(row.average_mark) },
                      { key: 'latest', label: 'Latest', render: (row) => formatDate(row.latest_submission_at) },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Marking queue</h2>
                    <p className="mt-1 text-sm text-slate-600">Newest learner submissions that still need tutor action.</p>
                  </div>
                  <Link className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm" to="/dashboard/tutor/submissions">View all</Link>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {data.markingQueue.slice(0, 4).map((submission) => (
                    <TutorSubmissionReviewCard key={submission.id} submission={submission} onSaved={reload} />
                  ))}
                  {!data.markingQueue.length ? <EmptyState title="Marking queue clear" description="Submitted learner work will appear here when it needs review." /> : null}
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Assignments created by you</h2>
                    <p className="mt-1 text-sm text-slate-600">A compact view of the work currently driving learner submissions.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <DataTable<Assignment>
                    rows={data.assignments.slice(0, 6)}
                    empty="No tutor-created assignments are available yet."
                    columns={[
                      { key: 'title', label: 'Assignment', render: (row) => <span className="font-semibold text-slate-950">{row.title}</span> },
                      { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                      { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'published'} /> },
                    ]}
                  />
                </div>
              </Card>
            </div>

            <aside className="space-y-4">
              <SessionPreview data={data} />

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Classes</h2>
                <div className="mt-4 space-y-3">
                  {data.classes.slice(0, 5).map((item: ClassRecord) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-semibold text-slate-950">{item.subject || item.subject_id || 'Class'}</p>
                      <p className="mt-1 text-sm text-slate-600">{[item.grade, item.day_of_week, item.start_time, item.location].filter(Boolean).join(' | ') || 'Schedule pending'}</p>
                    </div>
                  ))}
                  {!data.classes.length ? <EmptyState title="No class records yet" description="Admin-created classes linked to your tutor profile will appear here." /> : null}
                </div>
              </Card>

              <InsightCard title="Tutor profile" description="Operational profile fields controlled by admin onboarding." tone="aegean">
                <dl className="grid gap-3 text-sm">
                  {[
                    ['Name', data.profile.name],
                    ['Email', data.profile.email || 'Pending'],
                    ['Subjects', data.profile.subjects.join(', ') || 'Pending'],
                    ['Grades', data.profile.grades.join(', ') || 'Pending'],
                    ['Status', data.profile.status],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 rounded-lg bg-white/60 px-3 py-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </InsightCard>
            </aside>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}

function ActionLink({ href, icon: Icon, label, meta }: { href: string; icon: typeof Users; label: string; meta: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-[1.25rem] border border-white/15 bg-white/10 p-3 text-left text-white transition hover:bg-white/15" to={href}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] bg-white/10 text-brand-gold">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-brand-parchment">{meta}</span>
      </span>
    </Link>
  );
}

function SessionPreview({ data }: { data: TutorDashboardView }) {
  return (
    <InsightCard title="Upcoming and recent sessions" description="Session records are loaded from the transitional tutor operations API." tone="gold">
      <div className="space-y-3">
        {data.sessions.map((session) => (
          <TimelineCard
            key={session.id}
            title={session.student_name}
            meta={`${formatDate(session.date)} | ${formatTimeRange(session.start_time, session.end_time)}`}
          >
            <StatusBadge value={session.status} />
          </TimelineCard>
        ))}
        {!data.sessions.length ? <EmptyState title="No sessions visible" description="Session records will appear once the operations API has tutor sessions for this account." /> : null}
      </div>
    </InsightCard>
  );
}

function LearnerCell({ row }: { row: TutorDashboardView['learnerProgress'][number] }) {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing value={row.average_mark} label={`${row.student_name} average mark`} />
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{row.student_name}</p>
        <p className="mt-1 text-xs text-slate-500">{row.focus_notes || row.school || 'General support'}</p>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid gap-4">
      <SkeletonCard className="min-h-56" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    </div>
  );
}

function averageLabel(value?: number | null) {
  return value == null ? 'Pending' : `${value.toFixed(1)}%`;
}

function formatTimeRange(start?: string, end?: string) {
  const startLabel = start ? start.slice(0, 5) : 'Time pending';
  const endLabel = end ? end.slice(0, 5) : '';
  return endLabel ? `${startLabel}-${endLabel}` : startLabel;
}
