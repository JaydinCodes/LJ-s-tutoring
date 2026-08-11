import { Link, useParams } from 'react-router-dom';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorLearnerBriefRoute() {
  const { studentId } = useParams();
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);
  const learner = data?.learnerProgress.find((item) => item.student_id === studentId);
  const sessions = data?.sessions.filter((item) => item.student_id === studentId) || [];
  const submissions = data?.submissions.filter((item) => item.student_id === studentId) || [];
  const latestSession = sessions[0];
  const lastFeedback = submissions.find((item) => item.feedback_released && item.feedback);

  return <DashboardShell title="Learner brief" subtitle="A five-minute preparation view: recent teaching evidence, active work, and the next useful action." section="tutor">
    {loading ? <LoadingState title="Preparing learner brief" description="Gathering the learner’s teaching context..." /> : null}
    {error ? <ErrorState title="Learner brief unavailable" description={error} onRetry={() => void reload()} dashboardHref="/dashboard/tutor" /> : null}
    {data && !learner ? <EmptyState title="Learner not available" description="This learner may no longer be allocated to your tutor profile." actionLabel="Back to learners" actionHref="/dashboard/tutor" /> : null}
    {learner ? <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-aegean">Teach next</p><h2 className="mt-2 text-3xl font-semibold text-slate-950">{learner.student_name}</h2><p className="mt-1 text-sm text-slate-600">{[learner.grade, learner.school, learner.focus_notes].filter(Boolean).join(' · ') || 'Allocated learner'}</p></div><div className="rounded-lg bg-slate-50 p-3 text-right"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current mark evidence</p><p className="mt-1 text-2xl font-semibold text-slate-950">{learner.average_mark == null ? '—' : `${Math.round(learner.average_mark)}%`}</p></div></div>
        <div className="mt-5 flex flex-wrap gap-2"><Link className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" to={`/dashboard/tutor/sessions?studentId=${learner.student_id}`}>Log or prepare session</Link><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" to="/dashboard/tutor/assignments">Assign targeted practice</Link><Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" to="/dashboard/tutor/submissions">Review submitted work</Link></div>
      </Card>
      <section className="grid gap-4 lg:grid-cols-3"><BriefCard title="Last session" body={latestSession ? `${formatDate(latestSession.date)} · ${latestSession.status}` : 'No recent session record is available.'} detail={latestSession ? 'Open the session log to capture today’s objective and follow-up.' : undefined} /><BriefCard title="Open learner work" body={`${learner.pending_submissions} submission${learner.pending_submissions === 1 ? '' : 's'} waiting for review`} detail={learner.latest_submission_at ? `Latest submitted ${formatDate(learner.latest_submission_at)}.` : 'No submitted work yet.'} /><BriefCard title="Last released feedback" body={lastFeedback?.assignment_title || 'No released feedback yet'} detail={lastFeedback?.feedback || 'Release a focused review so the learner has a clear next step.'} /></section>
      <Card><h2 className="text-xl font-semibold text-slate-950">Prepare the next session</h2><ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3"><li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">1. Start from evidence.</span><br />Review the last session, current work, and released feedback.</li><li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">2. Set one objective.</span><br />Name one skill or misconception to address, not a generic topic.</li><li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">3. Close the loop.</span><br />Log the follow-up action and tell the learner what to complete next.</li></ol></Card>
      <Card><h2 className="text-xl font-semibold text-slate-950">Recent work</h2>{submissions.length ? <div className="mt-4 space-y-3">{submissions.slice(0, 5).map((submission) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3" key={submission.id}><div><p className="font-semibold text-slate-950">{submission.assignment_title || 'Assignment'}</p><p className="text-sm text-slate-600">Submitted {formatDate(submission.submitted_at)}</p></div><StatusBadge value={submission.status} /></div>)}</div> : <EmptyState title="No assignment evidence yet" description="Targeted work and released feedback will appear here as the learner progresses." />}</Card>
    </div> : null}
  </DashboardShell>;
}

function BriefCard({ title, body, detail }: { title: string; body: string; detail?: string }) { return <Card><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-aegean">{title}</p><p className="mt-2 font-semibold text-slate-950">{body}</p>{detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}</Card>; }
