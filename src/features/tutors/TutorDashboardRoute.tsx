import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, ClassRecord } from '../../types/lms';
import { TutorSubmissionReviewCard } from './TutorSubmissionReviewCard';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Tutor Dashboard" subtitle="Class delivery, assignment follow-up, and submission review for active tutor accounts." section="tutor">
      {loading ? <Card>Loading tutor dashboard...</Card> : null}
      {error ? <ErrorBlock title="Tutor dashboard unavailable" message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Allocated students</h2>
                <div className="mt-4">
                  <DataTable
                    rows={data.allocatedStudents.slice(0, 8)}
                    empty="No students are allocated to this tutor profile yet."
                    columns={[
                      { key: 'name', label: 'Student', render: (row) => <span className="font-semibold text-slate-950">{row.full_name || row.email || row.id}</span> },
                      { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                      { key: 'school', label: 'School', render: (row) => row.school || 'Pending' },
                      { key: 'focus', label: 'Focus', render: (row) => row.focus_notes || 'General support' },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Assignments created by you</h2>
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

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Recent submissions</h2>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {data.submissions.slice(0, 4).map((submission) => (
                    <TutorSubmissionReviewCard key={submission.id} submission={submission} onSaved={reload} />
                  ))}
                  {!data.submissions.length ? <EmptyState title="No submissions yet" description="Student work for tutor-created assignments will appear here." /> : null}
                </div>
              </Card>
            </div>

            <aside className="space-y-4">
              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Tutor profile</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  {[
                    ['Name', data.profile.name],
                    ['Email', data.profile.email || 'Pending'],
                    ['Subjects', data.profile.subjects.join(', ') || 'Pending'],
                    ['Grades', data.profile.grades.join(', ') || 'Pending'],
                    ['Status', data.profile.status],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

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
            </aside>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}

function ErrorBlock({ title, message, onRetry }: { title: string; message: string; onRetry: () => Promise<void> }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void onRetry()}>Retry</button>
    </Card>
  );
}
