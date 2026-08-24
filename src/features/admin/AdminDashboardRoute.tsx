import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  ReceiptText,
  UserPlus,
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
import { formatCurrency, formatDate } from '../../lib/utils/format';
import type { AdminDashboardView } from '../../types/lms';
import { loadAdminDashboard } from './adminDashboardRepository';

type AttentionItem = {
  id: string;
  description: string;
  detail: string;
  status: string;
  owner: string;
  due: string;
  action: string;
  to: string;
  priority: 'high' | 'medium' | 'normal';
};

export function AdminDashboardRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadAdminDashboard, []);

  return (
    <DashboardShell title="Today" subtitle="Here’s your operational overview for today." section="admin">
      {loading ? <AdminDashboardSkeleton /> : null}
      {error ? <ErrorState title="Admin dashboard unavailable" description={error} onRetry={() => void reload()} /> : null}
      {data ? <AdminDashboard data={data} /> : null}
    </DashboardShell>
  );
}

function AdminDashboard({ data }: { data: AdminDashboardView }) {
  const activeLearners = data.students.filter((student) => student.status === 'active').length;
  const activeTutors = data.tutors.filter((tutor) => tutor.status === 'active').length;
  const reviewCount = data.submissions.filter((submission) => submission.status === 'submitted' || submission.marks_awarded == null).length;
  const weekRange = currentWeekRange();
  const sessionsThisWeek = data.sessions.filter((session) => session.date >= weekRange.start && session.date <= weekRange.end).length;
  const attentionItems = buildAttentionItems(data);
  const health = buildLearnerHealth(data);
  const today = new Date().toISOString().slice(0, 10);
  const todaySchedule = data.sessions.filter((session) => session.date === today);
  const recentActivity = buildRecentActivity(data);

  return (
    <div className="space-y-5">
      <section aria-label="Operational metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AdminMetric icon={GraduationCap} label="Active learners" value={String(activeLearners)} to="/dashboard/admin/students" />
        <AdminMetric icon={UsersRound} label="Tutors" value={String(activeTutors)} to="/dashboard/admin/tutors" />
        <AdminMetric icon={CalendarPlus} label="Sessions this week" value={String(sessionsThisWeek)} to="/dashboard/admin/approvals" />
        <AdminMetric icon={ClipboardCheck} label="Awaiting review" value={String(reviewCount)} to="/dashboard/admin/results" tone="gold" />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
        <Card aria-labelledby="operations-attention-title" data-testid="admin-attention-queue">
          <CardHeader title="Operations requiring attention" meta={`${attentionItems.length}`} />
          {attentionItems.length ? (
            <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
              <div className="hidden grid-cols-[1.25fr_0.65fr_0.7fr_0.7fr_auto] gap-2 py-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-academy-muted lg:grid"><span>Item</span><span>Status</span><span>Responsible</span><span>Due</span><span>Action</span></div>
              {attentionItems.slice(0, 7).map((item) => (
                <article className="grid gap-2 py-3 lg:grid-cols-[1.25fr_0.65fr_0.7fr_0.7fr_auto] lg:items-center" key={item.id}>
                  <div className="min-w-0"><p className="text-sm font-semibold text-academy-navy dark:text-white">{item.description}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{item.detail}</p></div>
                  <div><p className="admin-field-label">Status</p><StatusBadge value={item.status} /></div>
                  <div><p className="admin-field-label">Responsible</p><p className="text-xs font-semibold text-academy-navy dark:text-white">{item.owner}</p></div>
                  <div><p className="admin-field-label">Due</p><p className="text-xs text-academy-muted">{item.due}</p></div>
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-academy-aegean px-3 text-xs font-bold text-academy-aegean dark:border-academy-gold dark:text-academy-gold" to={item.to}>{item.action}</Link>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Operations are clear" description="No overdue payments, pending tutor records, or unreviewed submissions require action." />}
        </Card>

        <div className="space-y-4">
          <Card aria-labelledby="learner-health-title">
            <CardHeader title="Learner health" />
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" role="img" aria-label={`${health.onTrack} on track, ${health.watch} watch, ${health.atRisk} at risk`}>
              <span className="bg-emerald-500" style={{ width: `${health.percentages.onTrack}%` }} />
              <span className="bg-academy-gold" style={{ width: `${health.percentages.watch}%` }} />
              <span className="bg-red-500" style={{ width: `${health.percentages.atRisk}%` }} />
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 dark:divide-white/10">
              <HealthStat label="On track" value={health.onTrack} tone="text-emerald-700 dark:text-emerald-300" />
              <HealthStat label="Watch" value={health.watch} tone="text-[#8a6500] dark:text-academy-gold" />
              <HealthStat label="At risk" value={health.atRisk} tone="text-red-700 dark:text-red-300" />
            </dl>
            <p className="mt-4 text-xs leading-5 text-academy-muted">Based on each active learner’s latest released mark. Learners without a released mark are placed on watch.</p>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <div className="mt-3 space-y-2">
              <QuickAction icon={UserPlus} title="Invite learner" detail="Create account access" to="/dashboard/admin/users" />
              <QuickAction icon={FilePlus2} title="Create assignment" detail="Open learning quality" to="/dashboard/admin/results" />
              <QuickAction icon={CalendarPlus} title="Schedule session" detail="Open session operations" to="/dashboard/admin/approvals" />
            </div>
          </Card>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Today’s schedule" meta={`${todaySchedule.length}`} />
          <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {todaySchedule.slice(0, 6).map((session) => <div className="grid min-h-14 gap-2 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center" key={session.id}><p className="font-display text-lg font-semibold text-academy-aegean dark:text-academy-gold">{session.start_time.slice(0, 5)}</p><div className="min-w-0"><p className="truncate text-sm font-semibold text-academy-navy dark:text-white">{session.student_name || 'Learner'} with {session.tutor_name || 'Tutor'}</p><p className="mt-1 truncate text-xs text-academy-muted">{session.topics_covered || 'Teaching focus not logged yet'}</p></div><StatusBadge value={session.status} /></div>)}
            {!todaySchedule.length ? <CompactMessage title="No sessions scheduled today" detail="Future sessions remain available in session operations." /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent operational activity" />
          <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {recentActivity.slice(0, 6).map((activity) => <div className="flex min-h-14 items-start gap-3 py-3" key={activity.id}><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><activity.icon className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-academy-navy dark:text-white">{activity.title}</p><p className="mt-1 text-xs text-academy-muted">{activity.detail}</p></div><p className="shrink-0 text-[0.68rem] text-academy-muted">{formatDate(activity.date)}</p></div>)}
            {!recentActivity.length ? <CompactMessage title="No recent activity" detail="New learners, submissions, assignments, and payments will appear here." /> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

function buildAttentionItems(data: AdminDashboardView): AttentionItem[] {
  const submissions = data.submissions
    .filter((submission) => submission.status === 'submitted' || submission.marks_awarded == null)
    .slice(0, 3)
    .map((submission) => ({
      id: `submission-${submission.id}`,
      description: `${submission.student_name || 'Learner'} · ${submission.assignment_title || 'Assignment review'}`,
      detail: 'Submitted work is waiting for an academic review and learner feedback.',
      status: 'pending review',
      owner: 'Tutor team',
      due: submission.submitted_at ? formatDate(submission.submitted_at) : 'Review now',
      action: 'Review',
      to: '/dashboard/admin/results',
      priority: 'high' as const,
    }));
  const overduePayments = data.payments
    .filter((payment) => payment.status === 'overdue' || (payment.status !== 'paid' && Boolean(payment.due_date) && String(payment.due_date) < new Date().toISOString().slice(0, 10)))
    .slice(0, 2)
    .map((payment) => ({
      id: `payment-${payment.id}`,
      description: `Payment follow-up · ${payment.student_label || 'Learner account'}`,
      detail: `${formatCurrency(payment.amount)} remains outstanding and needs a recorded follow-up.`,
      status: 'overdue',
      owner: 'Finance team',
      due: payment.due_date ? formatDate(payment.due_date) : 'Review now',
      action: 'Open',
      to: '/dashboard/admin/payments',
      priority: 'high' as const,
    }));
  const pendingTutors = data.tutors
    .filter((tutor) => tutor.status === 'pending')
    .slice(0, 2)
    .map((tutor) => ({
      id: `tutor-${tutor.id}`,
      description: `Tutor onboarding · ${tutor.full_name || 'Tutor profile'}`,
      detail: 'The tutor profile is pending an approval or onboarding decision.',
      status: 'pending',
      owner: 'Academic lead',
      due: 'Review now',
      action: 'Continue',
      to: '/dashboard/admin/tutors',
      priority: 'medium' as const,
    }));
  return [...submissions, ...overduePayments, ...pendingTutors];
}

function buildLearnerHealth(data: AdminDashboardView) {
  const latestByStudent = new Map<string, number>();
  for (const submission of [...data.submissions].sort((left, right) => String(right.released_at || right.submitted_at || '').localeCompare(String(left.released_at || left.submitted_at || '')))) {
    if (!latestByStudent.has(submission.student_id) && submission.marks_awarded != null) latestByStudent.set(submission.student_id, Number(submission.marks_awarded));
  }
  let onTrack = 0;
  let watch = 0;
  let atRisk = 0;
  for (const student of data.students.filter((item) => item.status === 'active')) {
    const mark = latestByStudent.get(student.id);
    if (mark == null) watch += 1;
    else if (mark >= 60) onTrack += 1;
    else if (mark >= 45) watch += 1;
    else atRisk += 1;
  }
  const total = Math.max(1, onTrack + watch + atRisk);
  return { onTrack, watch, atRisk, percentages: { onTrack: (onTrack / total) * 100, watch: (watch / total) * 100, atRisk: (atRisk / total) * 100 } };
}

function buildRecentActivity(data: AdminDashboardView) {
  return [
    ...data.submissions.map((submission) => ({ id: `s-${submission.id}`, icon: ClipboardCheck, title: `${submission.student_name || 'Learner'} submitted work`, detail: submission.assignment_title || 'Assignment submission', date: submission.submitted_at || '' })),
    ...data.students.map((student) => ({ id: `l-${student.id}`, icon: GraduationCap, title: `${student.full_name || 'Learner'} joined the learner roster`, detail: [student.grade, student.school].filter(Boolean).join(' · ') || 'Learner record', date: student.created_at })),
    ...data.assignments.map((assignment) => ({ id: `a-${assignment.id}`, icon: BookOpenCheck, title: `Assignment created · ${assignment.title}`, detail: assignment.subject || assignment.grade || 'Teaching workflow', date: assignment.created_at })),
    ...data.payments.filter((payment) => Boolean(payment.paid_at)).map((payment) => ({ id: `p-${payment.id}`, icon: ReceiptText, title: `Payment recorded · ${formatCurrency(payment.amount)}`, detail: payment.student_label || payment.payment_type, date: payment.paid_at || '' })),
  ].filter((item) => item.date).sort((left, right) => right.date.localeCompare(left.date));
}

function AdminMetric({ icon: Icon, label, value, to, tone = 'default' }: { icon: LucideIcon; label: string; value: string; to: string; tone?: 'default' | 'gold' }) {
  return <Link className="academy-surface flex min-h-28 min-w-0 items-center gap-3 p-4" to={to}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone === 'gold' ? 'bg-academy-gold/20 text-[#765500]' : 'bg-academy-aegean/10 text-academy-aegean'}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0"><span className="block text-xs font-semibold leading-4 text-academy-muted">{label}</span><span className="mt-1 block font-display text-3xl font-semibold text-academy-navy dark:text-white">{value}</span></span></Link>;
}

function CardHeader({ title, meta }: { title: string; meta?: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-academy-navy dark:text-white">{title}</h2>{meta ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">{meta}</span> : null}</div>;
}

function HealthStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="px-2 first:pl-0 last:pr-0"><dt className="text-[0.68rem] font-semibold text-academy-muted">{label}</dt><dd className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{value}</dd></div>;
}

function QuickAction({ icon: Icon, title, detail, to }: { icon: LucideIcon; title: string; detail: string; to: string }) {
  return <Link className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 px-3 transition-colors hover:border-academy-aegean dark:border-white/10" to={to}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-academy-navy dark:text-white">{title}</span><span className="block truncate text-xs text-academy-muted">{detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-academy-aegean" aria-hidden="true" /></Link>;
}

function CompactMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="py-4"><p className="text-sm font-semibold text-academy-navy dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{detail}</p></div>;
}

function currentWeekRange() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function AdminDashboardSkeleton() {
  return <div className="space-y-4"><section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></section><div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]"><SkeletonCard className="min-h-96" /><SkeletonCard className="min-h-96" /></div><div className="grid gap-4 xl:grid-cols-2"><SkeletonCard className="min-h-64" /><SkeletonCard className="min-h-64" /></div></div>;
}
