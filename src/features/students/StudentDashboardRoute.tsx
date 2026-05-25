import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, StudentProgress } from '../../types/lms';
import { loadStudentDashboard } from './studentDashboardRepository';

export function StudentDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadStudentDashboard, []);

  return (
    <DashboardShell
      title="Student Dashboard"
      subtitle="A React-first learner view for assignments, progress, class context, and submission status."
      section="student"
    >
      {loading ? <Card>Loading dashboard...</Card> : null}
      {error ? (
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Dashboard unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button>
        </Card>
      ) : null}
      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Upcoming assignments</h2>
                    <p className="mt-1 text-sm text-slate-600">Published work appears here from Supabase, with legacy API fallback during migration.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <DataTable<Assignment>
                    rows={data.assignments.slice(0, 6)}
                    empty="No assignments are currently due."
                    columns={[
                      { key: 'title', label: 'Assignment', render: (row) => <span className="font-semibold text-slate-950">{row.title}</span> },
                      { key: 'subject', label: 'Subject', render: (row) => row.subject || 'Subject pending' },
                      { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'published'} /> },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Progress summary</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.progress.slice(0, 6).map((item: StudentProgress) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-4">
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
                    <div key={label} className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
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
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3">
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
