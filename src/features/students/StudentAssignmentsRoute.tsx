import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission } from '../../types/lms';
import { calculateAssignmentStatus, type AssignmentLifecycleStatus } from '../assignments/assignmentStatus';
import { normalizeStudentData } from './studentData';
import { useStudentDashboardQuery } from './studentQueries';

type AssignmentFilter = 'all' | 'todo' | 'submitted' | 'graded';

type AssignmentRow = {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  status: AssignmentLifecycleStatus;
};

const PAGE_SIZE = 10;

function statusGroup(status: AssignmentLifecycleStatus): AssignmentFilter {
  if (status === 'closed' || status === 'archived' || status === 'draft') return 'all';
  if (status === 'marked') return 'graded';
  if (status === 'submitted' || status === 'under_review' || status === 'late_submitted') return 'submitted';
  return 'todo';
}

function displayStatus(status: AssignmentLifecycleStatus): string {
  if (status === 'marked') return 'Returned';
  if (status === 'returned_for_correction') return 'Correction required';
  if (status === 'missing') return 'Overdue';
  if (status === 'due_soon' || status === 'not_started') return 'Not submitted';
  if (status === 'under_review' || status === 'late_submitted' || status === 'submitted') return 'Submitted';
  if (status === 'closed' || status === 'archived') return 'Closed';
  return 'Not submitted';
}

function statusTone(status: AssignmentLifecycleStatus): string {
  if (status === 'marked') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'returned_for_correction' || status === 'missing') return 'text-red-700 dark:text-red-300';
  if (statusGroup(status) === 'submitted') return 'text-academy-aegean dark:text-sky-300';
  return 'text-academy-ink dark:text-slate-200';
}

function formatDateCell(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : formatDate(value);
}

function isVisible(assignment: Assignment) {
  // Only staff can access drafts. Closed work remains in All for historical review.
  return assignment.status !== 'draft';
}

export function StudentAssignmentsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const normalized = useMemo(() => data ? normalizeStudentData(data) : null, [data]);
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const activeFilter: AssignmentFilter =
    raw === 'due' ? 'todo' : raw === 'marked' ? 'graded' :
      raw === 'todo' || raw === 'submitted' || raw === 'graded' ? raw : 'all';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo<AssignmentRow[]>(() => {
    if (!normalized) return [];
    return [...normalized.assignmentsById.values()]
      .filter(isVisible)
      .map((assignment) => {
        const submission = normalized.submissionsByAssignmentId.get(assignment.id);
        return { assignment, submission, status: calculateAssignmentStatus({ assignment, submission }) };
      })
      .sort((a, b) =>
        new Date(b.assignment.created_at).getTime() - new Date(a.assignment.created_at).getTime()
        || a.assignment.title.localeCompare(b.assignment.title),
      );
  }, [normalized]);

  const query = search.trim().toLocaleLowerCase();
  const visible = rows.filter(({ assignment, status }) =>
    (activeFilter === 'all' || statusGroup(status) === activeFilter)
    && [assignment.title, assignment.subject, assignment.grade]
      .some((value) => (value || '').toLocaleLowerCase().includes(query)),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeFilter(value: string) {
    const filter = value as AssignmentFilter;
    if (!['all', 'todo', 'submitted', 'graded'].includes(filter)) return;
    setPage(1);
    setSearchParams(filter === 'all' ? {} : { view: filter });
  }

  return (
    <PageShell
      title="Assignments"
      subtitle="Select an assignment to view details, submit work or review feedback."
      section="student"
      identity={data ? { name: data.profile.name, meta: data.profile.grade || 'Student' } : undefined}
    >
      {refetching ? <p className="mb-3 text-sm text-academy-aegean" role="status">Refreshing assignments…</p> : null}
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Assignments unavailable" description={error} onRetry={() => void reload()} /> : null}
      {normalized ? (
        <div className="min-w-0">
          <div className="mb-5 border-b border-[#d9d2c5] pb-4 dark:border-white/15">
            <h2 className="text-xl font-semibold text-academy-navy dark:text-white">Assignments</h2>
            <p className="mt-2 text-sm text-academy-muted">Select an assignment to view instructions, submit work, or edit a previous submission when permitted.</p>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-academy-ink dark:text-slate-200">
              <span>Search</span>
              <input
                className="min-h-10 w-60 max-w-full rounded border border-[#c9c4bb] bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-academy-aegean dark:border-white/25 dark:bg-slate-900 dark:text-white"
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Assignment title or subject"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-academy-ink dark:text-slate-200">
              <span>View</span>
              <select
                aria-label="View assignments"
                className="min-h-10 rounded border border-[#c9c4bb] bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-academy-aegean dark:border-white/25 dark:bg-slate-900 dark:text-white"
                value={activeFilter}
                onChange={(event) => changeFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="todo">Not submitted</option>
                <option value="submitted">Submitted</option>
                <option value="graded">Returned / graded</option>
              </select>
            </label>
          </div>

          <p className="mb-2 text-xs text-academy-muted sm:hidden">Scroll sideways to see all assignment columns.</p>
          <div className="w-full min-w-0 overflow-x-auto border border-[#d9d2c5] dark:border-white/20">
            <table className="w-full min-w-[900px] table-auto border-collapse text-left text-sm">
              <thead className="bg-[#eee9de] text-academy-navy dark:bg-slate-800 dark:text-white">
                <tr>
                  <th scope="col" className="w-[36%] border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Assignment Title</th>
                  <th scope="col" className="border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Status</th>
                  <th scope="col" className="border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Posted</th>
                  <th scope="col" className="border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Due Date</th>
                  <th scope="col" className="border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Submitted Date</th>
                  <th scope="col" className="border-b border-[#d3cabc] px-3 py-3 font-semibold dark:border-white/20">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3ddd2] bg-white/50 text-academy-ink dark:divide-white/15 dark:bg-slate-900 dark:text-slate-100">
                {pageRows.map(({ assignment, submission, status }) => (
                  <tr key={assignment.id} className="even:bg-[#f5f1e9] hover:bg-academy-gold/[0.09] dark:even:bg-white/[0.04] dark:hover:bg-white/[0.08]">
                    <td className="px-3 py-3 align-top">
                      <Link
                        className="font-semibold text-academy-aegean underline decoration-academy-aegean/40 underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-academy-gold dark:text-sky-300"
                        to={`/dashboard/student/assignments/${assignment.id}`}
                      >{assignment.title}</Link>
                      {assignment.subject ? <span className="mt-1 block text-xs text-academy-muted">{assignment.subject}</span> : null}
                    </td>
                    <td className={`px-3 py-3 align-top font-medium ${statusTone(status)}`}>{displayStatus(status)}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">{formatDateCell(assignment.created_at)}</td>
                    <td className={`whitespace-nowrap px-3 py-3 align-top ${status === 'missing' ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{formatDateCell(assignment.due_date)}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">{formatDateCell(submission?.submitted_at)}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top font-semibold">
                      {submission?.marks_released && submission.marks_awarded != null ? `${submission.marks_awarded}%` : '—'}
                    </td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr><td className="px-4 py-8 text-center text-sm text-academy-muted" colSpan={6}>
                    {rows.length === 0 ? 'No assignments yet. Published assignments will appear here.' : 'No assignments match your search or filter.'}
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-academy-muted">
            <span>{visible.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, visible.length)} of ${visible.length}` : '0 assignments'}</span>
            {totalPages > 1 ? (
              <nav aria-label="Assignment pages" className="flex items-center gap-2">
                <button className="min-h-10 rounded border border-[#d9d2c5] px-3 disabled:opacity-40 dark:border-white/20" disabled={currentPage <= 1} type="button" onClick={() => setPage(currentPage - 1)}>Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button className="min-h-10 rounded border border-[#d9d2c5] px-3 disabled:opacity-40 dark:border-white/20" disabled={currentPage >= totalPages} type="button" onClick={() => setPage(currentPage + 1)}>Next</button>
              </nav>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
