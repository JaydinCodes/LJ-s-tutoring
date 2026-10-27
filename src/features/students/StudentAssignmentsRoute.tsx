import { useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import { calculateAssignmentStatus, type AssignmentLifecycleStatus } from '../assignments/assignmentStatus';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

type AssignmentFilter = 'all' | 'todo' | 'submitted' | 'graded';

const filters: Array<{ key: AssignmentFilter; label: string }> = [
  { key: 'all', label: 'All assignments' },
  { key: 'todo', label: 'To do' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded', label: 'Graded' },
];

function statusGroup(status: AssignmentLifecycleStatus): AssignmentFilter {
  if (status === 'closed' || status === 'archived' || status === 'draft') return 'all';
  if (status === 'marked') return 'graded';
  if (status === 'submitted' || status === 'under_review' || status === 'late_submitted') return 'submitted';
  return 'todo';
}

function displayStatus(status: AssignmentLifecycleStatus) {
  if (status === 'marked') return 'Results available';
  if (status === 'returned_for_correction') return 'Correction requested';
  if (status === 'missing') return 'Overdue';
  if (status === 'due_soon') return 'Due soon';
  if (status === 'under_review' || status === 'late_submitted') return 'Submitted';
  if (status === 'not_started') return 'Not started';
  return status === 'closed' || status === 'archived' ? 'Closed' : 'Submitted';
}

function actionLabel(status: AssignmentLifecycleStatus) {
  if (status === 'marked') return 'View result';
  if (status === 'returned_for_correction') return 'View corrections';
  if (status === 'submitted' || status === 'late_submitted' || status === 'under_review') return 'View submission';
  if (status === 'closed' || status === 'archived') return 'View assignment';
  return 'Open assignment';
}

type AssignmentRow = { assignment: Assignment; submission?: AssignmentSubmission; status: AssignmentLifecycleStatus };

function dueTime(value?: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return formatDate(value);
}

function isVisible(assignment: Assignment) {
  // Drafts are staff-only; historical assignments remain accessible even when closed.
  return assignment.status !== 'draft';
}

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const normalized = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const filter: AssignmentFilter = raw === 'due' ? 'todo' : raw === 'marked' ? 'graded' : raw === 'submitted' || raw === 'graded' || raw === 'todo' ? raw : 'all';
  const [search, setSearch] = useState('');

  const rows = useMemo<AssignmentRow[]>(() => {
    if (!normalized) return [];
    const all = [...normalized.assignmentsById.values()].filter(isVisible).map(assignment => {
      const submission = normalized.submissionsByAssignmentId.get(assignment.id);
      return { assignment, submission, status: calculateAssignmentStatus({ assignment, submission }) };
    });
    return all.sort((a, b) => {
      const priority = (row: AssignmentRow) => {
        if (row.status === 'returned_for_correction') return 0;
        if (row.status === 'missing') return 1;
        if (row.status === 'due_soon') return 2;
        if (row.status === 'not_started') return 3;
        if (statusGroup(row.status) === 'submitted') return 4;
        return 5;
      };
      return priority(a) - priority(b)
        || (new Date(a.assignment.due_date || 0).getTime() - new Date(b.assignment.due_date || 0).getTime())
        || a.assignment.title.localeCompare(b.assignment.title);
    });
  }, [normalized]);

  const visible = rows.filter(row => {
    const category = statusGroup(row.status);
    const matchFilter = filter === 'all' || filter === category;
    const haystack = [row.assignment.title, row.assignment.subject, row.assignment.grade].filter(Boolean).join(' ').toLocaleLowerCase();
    return matchFilter && haystack.includes(search.trim().toLocaleLowerCase());
  });

  function selectFilter(next: AssignmentFilter) {
    setParams(next === 'all' ? {} : { view: next });
  }

  return (
    <PageShell title="Assignments" subtitle="View your work, submit assignments and review your results." section="student" identity={data ? { name: data.profile.name, meta: data.profile.grade || 'Student' } : undefined}>
      {refetching ? <p className="mb-3 text-sm text-academy-aegean" role="status">Refreshing assignments…</p> : null}
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} /> : null}
      {normalized ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter assignments">
              {filters.map(item => (
                <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => selectFilter(item.key)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === item.key ? 'border-academy-navy bg-academy-navy text-white dark:border-academy-gold dark:bg-academy-gold dark:text-slate-950' : 'border-[#ded5c6] bg-[#fffbf2] text-academy-navy hover:border-academy-gold dark:border-white/20 dark:bg-slate-900 dark:text-white'}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:max-w-xs">
              <span className="sr-only">Search assignments</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search assignments"
                className="min-h-11 w-full rounded-xl border border-[#ded5c6] bg-white py-2 pl-10 pr-4 text-sm text-slate-950 dark:border-white/20 dark:bg-slate-900 dark:text-white" />
            </label>
          </div>
          <section className="overflow-hidden rounded-2xl border border-[#ded5c6] bg-[#fffbf2] dark:border-white/15 dark:bg-slate-900" aria-label="Assignments list">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded5c6] px-5 py-4 dark:border-white/15">
              <div>
                <h2 className="font-display text-xl font-semibold text-academy-navy dark:text-white">Your assignments</h2>
                <p className="text-sm text-academy-muted">Select an assignment to view instructions, submissions and released feedback.</p>
              </div>
              <span className="text-sm text-academy-muted">{visible.length} {visible.length === 1 ? 'assignment' : 'assignments'}</span>
            </div>
            {!rows.length ? (
              <div className="p-8">
                <EmptyState title="No assignments yet" description="When your tutor or an administrator publishes an assignment for you, it will appear here." icon={BookOpenCheck} />
                <div className="mt-4 flex justify-center"><Link className="academy-btn academy-btn-gold" to="/dashboard/student">Return to Today</Link></div>
              </div>
            ) : !visible.length ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-academy-navy dark:text-white">No matching assignments</p>
                <p className="mt-2 text-sm text-academy-muted">Try another filter or search term.</p>
                <button type="button" className="academy-btn academy-btn-outline mt-4" onClick={() => { setSearch(''); selectFilter('all'); }}>Show all assignments</button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-academy-navy/[0.045] text-academy-muted dark:bg-white/[0.04]">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">Assignment</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Due date</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Result</th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7dfd1] dark:divide-white/10">
                      {visible.map(({ assignment, submission, status }) => (
                        <tr key={assignment.id} className="hover:bg-white/75 dark:hover:bg-white/[0.04]">
                          <td className="px-5 py-4"><Link className="font-semibold text-academy-navy underline-offset-4 hover:underline dark:text-white" to={`/dashboard/student/assignments/${assignment.id}`}>{assignment.title}</Link></td>
                          <td className="px-4 py-4 text-academy-muted">{assignment.subject?.trim() || 'Subject not listed'}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-academy-ink dark:text-white">{dueTime(assignment.due_date)}</td>
                          <td className="px-4 py-4"><StatusBadge value={status} /><span className="sr-only">{displayStatus(status)}</span></td>
                          <td className="px-4 py-4 font-semibold text-academy-navy dark:text-white">{submission?.marks_released && submission.marks_awarded != null ? `${submission.marks_awarded}%` : '—'}</td>
                          <td className="px-5 py-4 text-right"><Link className="inline-flex min-h-10 items-center gap-1 font-semibold text-academy-aegean hover:underline dark:text-academy-gold" to={`/dashboard/student/assignments/${assignment.id}`}>{actionLabel(status)} <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-[#e7dfd1] md:hidden dark:divide-white/10">
                  {visible.map(({ assignment, submission, status }) => (
                    <article key={assignment.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-semibold text-academy-navy dark:text-white">{assignment.title}</h3><p className="mt-1 text-sm text-academy-muted">{assignment.subject?.trim() || 'Subject not listed'}</p></div>
                        <StatusBadge value={status} />
                      </div>
                      <p className="mt-3 text-sm text-academy-muted">Due: {dueTime(assignment.due_date)}{submission?.marks_released && submission.marks_awarded != null ? ` · Result: ${submission.marks_awarded}%` : ''}</p>
                      <Link className="academy-btn academy-btn-outline mt-3 w-full" to={`/dashboard/student/assignments/${assignment.id}`}>{actionLabel(status)} <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}
