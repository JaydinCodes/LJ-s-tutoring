import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatCurrency, formatDate } from '../../lib/utils/format';
import type { Assignment, Payment, Student, Tutor } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';

export function AdminDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="Operational React console for learners, tutors, assignments, payments, reporting, and ProVision rollout support."
      section="admin"
    >
      {loading ? <LoadingState title="Loading admin dashboard" description="Checking learners, tutors, assignments, and payments..." /> : null}
      {error ? <ErrorState title="Admin dashboard unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/admin" /> : null}
      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => <StatCard key={metric.label} metric={metric} />)}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Students</h2>
              <div className="mt-4">
                <DataTable<Student & { full_name?: string; email?: string; ngo_partner?: string }>
                  rows={data.students.slice(0, 8)}
                  empty="Student records will appear here after learners are added."
                  columns={[
                    { key: 'student', label: 'Student', render: (row) => row.full_name || row.id },
                    { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                    { key: 'school', label: 'School', render: (row) => row.school || 'Pending' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'active'} /> },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Tutors</h2>
              <div className="mt-4">
                <DataTable<Tutor & { full_name?: string; email?: string }>
                  rows={data.tutors.slice(0, 8)}
                  empty="Tutor records will appear here after tutors are added."
                  columns={[
                    { key: 'tutor', label: 'Tutor', render: (row) => row.full_name || row.id },
                    { key: 'subjects', label: 'Subjects', render: (row) => row.subjects?.join(', ') || 'Pending' },
                    { key: 'rate', label: 'Rate', render: (row) => row.hourly_rate ? formatCurrency(row.hourly_rate) : 'Pending' },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'active'} /> },
                  ]}
                />
              </div>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950">Assignment management</h2>
              <div className="mt-4">
                <DataTable<Assignment>
                  rows={data.assignments.slice(0, 8)}
                  empty="Assignments created by admins or tutors will appear here."
                  columns={[
                    { key: 'title', label: 'Title', render: (row) => row.title || row.id },
                    { key: 'grade', label: 'Grade', render: (row) => row.grade || 'Pending' },
                    { key: 'due', label: 'Due', render: (row) => formatDate(row.due_date) },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'draft'} /> },
                  ]}
                />
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <h2 className="text-xl font-semibold text-slate-950">Payment overview</h2>
                <div className="mt-4 space-y-3">
                  {data.payments.slice(0, 5).map((payment: Payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-slate-600">{payment.payment_type} | due {formatDate(payment.due_date)}</p>
                      </div>
                      <StatusBadge value={payment.status} />
                    </div>
                  ))}
                  {!data.payments.length ? <EmptyState title="No payment records yet" description="Student and tutor payment records will appear here once they are added." /> : null}
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-slate-950">ProVision and organogram</h2>
                <div className="mt-4 space-y-3">
                  {data.team.map((member) => (
                    <div key={`${member.name}-${member.role}`} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-semibold text-slate-950">{member.name}</p>
                      <p className="text-sm text-slate-600">{member.role} | {member.focus}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}
