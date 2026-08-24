import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FilePlus2,
  MessageSquarePlus,
  NotebookPen,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import type { TutorDashboardView } from '../../types/lms';
import { loadTutorDashboard } from './tutorDashboardRepository';

export function TutorDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadTutorDashboard, []);

  return (
    <DashboardShell title="Today" subtitle="Here’s what needs your attention today." section="tutor">
      {loading ? <TutorDashboardSkeleton /> : null}
      {error ? <ErrorState title="Tutor dashboard unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? <TutorDashboard data={data} /> : null}
    </DashboardShell>
  );
}

function TutorDashboard({ data }: { data: TutorDashboardView }) {
  const sessions = [...data.sessions].sort((left, right) => sessionKey(left).localeCompare(sessionKey(right)));
  const nextSession = sessions[0];
  const nextLearner = nextSession ? data.learnerProgress.find((learner) => learner.student_id === nextSession.student_id || learner.student_name === nextSession.student_name) : data.learnerProgress[0];
  const attentionLearners = data.learnerProgress.filter((learner) => learner.pending_submissions > 0 || (learner.average_mark != null && learner.average_mark < 60));
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = data.sessions.filter((session) => session.date === today).length;

  return (
    <div className="space-y-5">
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
        <article className="academy-major-surface relative overflow-hidden" data-testid="tutor-primary-plan">
          <div className="absolute right-8 top-8 h-32 w-32 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-academy-gold">{nextSession ? 'Today’s teaching plan' : 'Teaching plan'}</p>
            {nextSession ? (
              <>
                <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">{nextSession.student_name} · {nextLearner?.focus_notes || data.classes[0]?.subject || 'Learning support'}</h2>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-academy-parchment"><span className="font-semibold text-white">{formatDate(nextSession.date)}</span><span>{formatTimeRange(nextSession.start_time, nextSession.end_time)}</span><StatusBadge value={nextSession.status} /></p>
                <div className="mt-5 max-w-2xl border-l-2 border-academy-gold pl-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-academy-gold">Teaching goals</p>
                  <p className="mt-2 text-sm leading-6 text-academy-parchment">{nextLearner?.focus_notes || 'Review the learner brief, confirm today’s focus, and leave one clear next step.'}</p>
                </div>
                <Link className="academy-btn academy-btn-gold mt-6 w-full sm:w-auto" data-testid="tutor-primary-action" to={nextSession.student_id ? `/dashboard/tutor/learners/${nextSession.student_id}` : '/dashboard/tutor/risk'}>Open learner brief <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </>
            ) : (
              <div className="mt-3"><h2 className="font-display text-3xl font-semibold text-white">No session scheduled</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-academy-parchment">Use the open time to clear reviews or prepare a learner plan.</p><Link className="academy-btn academy-btn-gold mt-5" to="/dashboard/tutor/sessions">Open teaching schedule</Link></div>
            )}
          </div>
        </article>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <TutorMetric icon={CalendarClock} label="Sessions today" value={String(sessionsToday)} action="View schedule" to="/dashboard/tutor/sessions" />
          <TutorMetric icon={ClipboardCheck} label="Awaiting review" value={String(data.markingQueue.length)} action="Open review queue" to="/dashboard/tutor/submissions" tone="gold" />
          <TutorMetric icon={TriangleAlert} label="Need attention" value={String(attentionLearners.length)} action="View learners" to="/dashboard/tutor/risk" tone="alert" />
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <Card aria-labelledby="review-queue-title">
          <CardHeader title="Submissions awaiting review" meta={`${data.markingQueue.length} total`} />
          {data.markingQueue.length ? (
            <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
              {data.markingQueue.slice(0, 5).map((submission) => (
                <Link className="grid min-h-14 gap-2 py-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] sm:items-center" key={submission.id} to="/dashboard/tutor/submissions">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-academy-navy dark:text-white">{submission.student_label || 'Learner'}</span><span className="text-xs text-academy-muted">{formatDate(submission.submitted_at)}</span></span>
                  <span className="truncate text-sm text-academy-muted">{submission.assignment_title || 'Assignment submission'}</span>
                  <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-academy-aegean px-3 text-xs font-bold text-academy-aegean dark:border-academy-gold dark:text-academy-gold">Review</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="Review queue clear" description="New learner submissions will appear here when they need your feedback." />}
          {data.markingQueue.length > 5 ? <Link className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-academy-aegean dark:text-academy-gold" to="/dashboard/tutor/submissions">View all submissions <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
        </Card>

        <Card aria-labelledby="quick-actions-title">
          <CardHeader title="Quick actions" />
          <div className="mt-3 space-y-2">
            <QuickAction icon={NotebookPen} title="Log session" detail="Record notes and outcomes" to="/dashboard/tutor/sessions" />
            <QuickAction icon={FilePlus2} title="Create assignment" detail="Build or assign new work" to="/dashboard/tutor/assignments" />
            <QuickAction icon={MessageSquarePlus} title="Add teaching note" detail="Capture a note about a learner" to={nextLearner ? `/dashboard/tutor/learners/${nextLearner.student_id}` : '/dashboard/tutor/risk'} />
          </div>
        </Card>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Learners needing attention" meta={`${attentionLearners.length}`} />
          <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {attentionLearners.slice(0, 4).map((learner) => {
              const evidence = learner.pending_submissions > 0
                ? `${learner.pending_submissions} submission${learner.pending_submissions === 1 ? '' : 's'} waiting for review`
                : `Recent average is ${Math.round(learner.average_mark || 0)}%`;
              const action = learner.pending_submissions > 0 ? 'Review work and respond' : 'Check in and adjust the next goal';
              return <Link className="block min-h-14 py-3" key={learner.student_id} to={`/dashboard/tutor/learners/${learner.student_id}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-academy-navy dark:text-white">{learner.student_name}</p><ArrowRight className="h-4 w-4 text-academy-aegean" aria-hidden="true" /></div><p className="mt-1 text-xs leading-5 text-academy-muted"><span className="font-semibold">Evidence:</span> {evidence}. <span className="font-semibold">Next:</span> {action}.</p></Link>;
            })}
            {!attentionLearners.length ? <CompactMessage title="No learners need urgent action" detail="Current review and progress signals are clear." /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming sessions" meta={`${sessions.length}`} />
          <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {sessions.slice(0, 4).map((session) => {
              const learner = data.learnerProgress.find((item) => item.student_id === session.student_id || item.student_name === session.student_name);
              return <div className="flex min-h-14 items-center justify-between gap-3 py-3" key={session.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-academy-navy dark:text-white">{session.student_name}</p><p className="mt-1 text-xs text-academy-muted">{formatDate(session.date)} · {formatTimeRange(session.start_time, session.end_time)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${learner?.focus_notes ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{learner?.focus_notes ? 'Brief ready' : 'Plan focus'}</span></div>;
            })}
            {!sessions.length ? <CompactMessage title="No upcoming sessions" detail="Scheduled sessions will appear here." /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent learner progress" />
          <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {data.learnerProgress.slice(0, 5).map((learner) => <div className="flex min-h-14 items-center justify-between gap-3 py-3" key={learner.student_id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-academy-navy dark:text-white">{learner.student_name}</p><p className="mt-1 text-xs text-academy-muted">{learner.marked_submissions} reviewed submission{learner.marked_submissions === 1 ? '' : 's'}</p></div><p className="shrink-0 font-display text-2xl font-semibold text-academy-aegean dark:text-academy-gold">{learner.average_mark == null ? '—' : `${Math.round(learner.average_mark)}%`}</p></div>)}
            {!data.learnerProgress.length ? <CompactMessage title="No learner progress yet" detail="Released marks will create the first progress signal." /> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

function TutorMetric({ icon: Icon, label, value, action, to, tone = 'default' }: { icon: LucideIcon; label: string; value: string; action: string; to: string; tone?: 'default' | 'gold' | 'alert' }) {
  const iconTone = tone === 'alert' ? 'bg-red-50 text-red-700' : tone === 'gold' ? 'bg-academy-gold/20 text-[#765500]' : 'bg-academy-aegean/10 text-academy-aegean';
  return <Link className="academy-surface flex min-h-28 items-center gap-4 p-4" to={to}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconTone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-academy-muted">{label}</span><span className="mt-0.5 block font-display text-3xl font-semibold text-academy-navy dark:text-white">{value}</span><span className="mt-1 block truncate text-xs font-semibold text-academy-aegean dark:text-academy-gold">{action}</span></span></Link>;
}

function CardHeader({ title, meta }: { title: string; meta?: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-academy-navy dark:text-white">{title}</h2>{meta ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">{meta}</span> : null}</div>;
}

function QuickAction({ icon: Icon, title, detail, to }: { icon: LucideIcon; title: string; detail: string; to: string }) {
  return <Link className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 px-3 transition-colors hover:border-academy-aegean dark:border-white/10" to={to}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-academy-navy dark:text-white">{title}</span><span className="block truncate text-xs text-academy-muted">{detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-academy-aegean" aria-hidden="true" /></Link>;
}

function CompactMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="py-4"><p className="text-sm font-semibold text-academy-navy dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{detail}</p></div>;
}

function TutorDashboardSkeleton() {
  return <div className="space-y-4"><SkeletonCard className="min-h-72" /><div className="grid gap-4 md:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><div className="grid gap-4 xl:grid-cols-3"><SkeletonCard className="min-h-64" /><SkeletonCard className="min-h-64" /><SkeletonCard className="min-h-64" /></div></div>;
}

function sessionKey(session: TutorDashboardView['sessions'][number]) {
  return `${session.date || '9999-12-31'}T${session.start_time || '23:59'}`;
}

function formatTimeRange(start?: string, end?: string) {
  const startLabel = start ? start.slice(0, 5) : 'Time pending';
  const endLabel = end ? end.slice(0, 5) : '';
  return endLabel ? `${startLabel}–${endLabel}` : startLabel;
}
