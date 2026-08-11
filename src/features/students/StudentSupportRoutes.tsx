import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Bell, BookOpen, CalendarDays, ChevronRight, Clock, FileText, GraduationCap, Lock, Moon, Shield, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, PageShell, PremiumButton } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import { useAuth } from '../auth/AuthProvider';
import { loadStudentDashboard } from './studentDashboardRepository';
import { useStudentDashboardQuery } from './studentQueries';
import { generateWeeklyReport, loadWeeklyReport, loadWeeklyReports, type WeeklyReport, type WeeklyReportListItem } from './studentReportsRepository';

// Community is temporarily disabled: organization scoping, role restrictions,
// moderation, and RLS test coverage do not exist yet for the community RPCs
// (studentCommunityRepository.ts), so no room/message/challenge data is
// fetched or rendered here until that safety work lands.
export function StudentCommunityRoute() {
  return (
    <PageShell
      title="Community"
      subtitle="Moderated study rooms, weekly challenges, and peer Q&A."
      section="student"
    >
      <Card>
        <EmptyState
          title="Community is temporarily unavailable"
          description="We are adding organization scoping, role restrictions, and moderation before Community reopens. Check back soon."
          actionLabel="Back to dashboard"
          actionHref="/dashboard/student"
          icon={UsersRound}
        />
      </Card>
    </PageShell>
  );
}

export function StudentTutorSessionsRoute() {
  const { data, loading, error, refetching, reload } = useStudentDashboardQuery();
  const today = new Date().toISOString().slice(0, 10);
  const sessions = data?.sessions || [];
  const upcoming = [...sessions].filter((session) => session.date >= today).sort((left, right) => `${left.date}${left.start_time}`.localeCompare(`${right.date}${right.start_time}`));
  const previous = [...sessions].filter((session) => session.date < today).sort((left, right) => `${right.date}${right.start_time}`.localeCompare(`${left.date}${left.start_time}`));

  return (
    <PageShell title="My tutor & sessions" subtitle="See your next learning session, what to prepare, and the student-safe summary from recent sessions." section="student">
      <section className="space-y-5">
        <div className="academy-major-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Learning routine</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">Prepare with the right context</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">Session details and follow-up are shown here without exposing private tutor notes or internal reporting.</p>
        </div>
        {loading ? <Card><p className="text-sm text-slate-600">Loading your session plan...</p></Card> : null}
        {error ? <ErrorState title="Sessions unavailable" description={error} onRetry={() => void reload()} /> : null}
        {data ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
            <section className="space-y-4">
              <SessionList title="Next session" empty="No future session is scheduled yet. Check your class schedule or contact your tutor/admin for the next time." sessions={upcoming} />
              <SessionList title="Recent sessions" empty="Student-safe session summaries will appear here after a session is reported." sessions={previous.slice(0, 4)} />
            </section>
            <aside className="space-y-4">
              <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Your tutor</p>
                <div className="mt-3 space-y-3">
                  {(data.assignedTutors || []).map((tutor) => <div className="academy-row" key={tutor.id}><UserRound className="h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /><div><p className="text-sm font-semibold text-academy-ink dark:text-academy-parchment">{tutor.full_name}</p><p className="text-xs text-academy-muted">Allocated tutor</p></div></div>)}
                  {!data.assignedTutors?.length ? <p className="text-sm leading-6 text-academy-muted">Your allocated tutor will appear here once confirmed.</p> : null}
                </div>
              </section>
              <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Before your session</p>
                <p className="mt-2 text-sm leading-6 text-academy-muted">Open your current work, bring one question, and complete any homework listed in the next session card.</p>
                <Link className="academy-btn academy-btn-outline mt-4" to="/dashboard/student/assignments">Open my work</Link>
              </section>
              <button className="academy-btn academy-btn-outline" disabled={refetching} type="button" onClick={() => void reload()}>{refetching ? 'Refreshing...' : 'Refresh sessions'}</button>
            </aside>
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}

function SessionList({ title, empty, sessions }: { title: string; empty: string; sessions: NonNullable<ReturnType<typeof useStudentDashboardQuery>['data']>['sessions'] }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <h2 className="text-xl font-semibold text-academy-ink dark:text-academy-parchment">{title}</h2>
      <div className="mt-3 divide-y divide-slate-950/5 dark:divide-white/10">
        {sessions.map((session) => (
          <article className="py-4 first:pt-0" key={session.id}>
            <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-semibold text-academy-ink dark:text-academy-parchment">{formatDate(session.date)} · {session.mode || 'Session'}</p><p className="mt-1 flex items-center gap-1 text-xs text-academy-muted"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{session.start_time}–{session.end_time}{session.location ? ` · ${session.location}` : ''}</p></div></div>
            {session.topics_covered ? <p className="mt-3 text-sm leading-6 text-academy-muted"><span className="font-semibold text-academy-ink dark:text-academy-parchment">Focus:</span> {session.topics_covered}</p> : null}
            {session.homework_assigned ? <p className="mt-2 text-sm leading-6 text-academy-muted"><span className="font-semibold text-academy-ink dark:text-academy-parchment">Follow-up:</span> {session.homework_assigned}</p> : null}
            {session.student_summary ? <p className="mt-2 rounded-ios bg-slate-950/[0.04] px-3 py-2 text-sm leading-6 text-academy-muted dark:bg-white/[0.06]">{session.student_summary}</p> : null}
          </article>
        ))}
        {!sessions.length ? <p className="py-4 text-sm leading-6 text-academy-muted">{empty}</p> : null}
      </div>
    </section>
  );
}

export function StudentReportsRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadStudentDashboard, []);
  const reports = useAsyncResource(loadWeeklyReports, []);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  async function generateReport() {
    setBusy(true);
    setMessage(null);
    setReportError(null);
    try {
      const result = await generateWeeklyReport();
      setSelectedReport(result.report);
      setMessage('Weekly report generated.');
      await reports.reload();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not generate a report right now.');
    } finally {
      setBusy(false);
    }
  }

  async function openReport(reportId: string) {
    setBusy(true);
    setMessage(null);
    setReportError(null);
    try {
      const result = await loadWeeklyReport(reportId);
      setSelectedReport(result.report);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not load report details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Resources"
      subtitle="Learning resources, weekly summaries, report history, and next-step guidance."
      section="student"
    >
      <section className="space-y-5">
        <div className="academy-major-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Resource library</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">Keep useful learning context close</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">Reports, assignments, progress, and classes are grouped as rows so this page stays practical and easy to scan.</p>
          <PremiumButton className="mt-6" disabled={busy} type="button" variant="gold" onClick={() => void generateReport()}>
            {busy ? 'Working...' : 'Generate this week'}
          </PremiumButton>
        </div>
        {loading ? <Card><p className="text-sm text-slate-600">Loading resource data...</p></Card> : null}
        {error ? (
          <ErrorState title="Resources unavailable" description={error} onRetry={() => void reload()} />
        ) : null}
        {message ? <p className="academy-chip w-fit text-emerald-700">{message}</p> : null}
        {reportError ? <p className="academy-chip w-fit text-red-700">{reportError}</p> : null}
        {data ? (
          <ResourceList
            groups={[
              {
                title: 'Learning',
                rows: [
                  { icon: BookOpen, title: 'Assignments', meta: `${data.assignments.length} visible assignment${data.assignments.length === 1 ? '' : 's'}`, href: '/dashboard/student/assignments' },
                  { icon: GraduationCap, title: 'Progress records', meta: `${data.progress.length} topic signal${data.progress.length === 1 ? '' : 's'}`, href: '/dashboard/student/progress' },
                  { icon: FileText, title: 'Results', meta: `${data.submissions.filter((item) => item.marks_awarded != null).length} marked submission${data.submissions.filter((item) => item.marks_awarded != null).length === 1 ? '' : 's'}`, href: '/dashboard/student/results' },
                ],
              },
              {
                title: 'Schedule',
                rows: data.classes.length
                  ? data.classes.map((item) => ({ icon: BookOpen, title: item.name || item.subject || 'Class', meta: [item.day_of_week, item.start_time, item.location].filter(Boolean).join(' | ') || 'Schedule pending' }))
                  : [{ icon: BookOpen, title: 'No class schedule yet', meta: 'Class details will appear once linked to your learner profile.' }],
              },
            ]}
          />
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ResourceList
            groups={[
              {
                title: 'Report history',
                rows: (reports.data?.items || []).map((report) => ({
                  icon: FileText,
                  title: 'Weekly learning report',
                  meta: `${formatDate(report.week_start || report.weekStart)} - ${formatDate(report.week_end || report.weekEnd)}${report.is_stale ? ' · Update pending' : ''}`,
                  actionLabel: 'View',
                  onAction: () => void openReport(report.id),
                })),
              },
            ]}
            empty={reports.data && !reports.data.items.length ? {
              title: 'No reports generated yet',
              description: 'Reports become useful after sessions are approved and learning activity exists.',
            } : undefined}
            trailing={<button className="academy-btn academy-btn-outline min-h-10 px-4" onClick={() => void reports.reload()}>Refresh</button>}
          />
          {reports.loading ? <p className="mt-4 text-sm text-slate-600">Loading weekly reports...</p> : null}
          {reports.error ? <p className="mt-4 text-sm font-semibold text-red-700">{reports.error}</p> : null}
          <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
            <h2 className="text-xl font-semibold text-academy-ink dark:text-academy-parchment">Report details</h2>
            {selectedReport ? <WeeklyReportDetail report={selectedReport} /> : (
              <EmptyState title="No report selected" description="Generate or open a report to see parent and NGO-ready details." />
            )}
          </section>
        </div>
      </section>
    </PageShell>
  );
}

type ResourceGroup = {
  title: string;
  rows: Array<{
    icon: LucideIcon;
    title: string;
    meta: string;
    href?: string;
    actionLabel?: string;
    onAction?: () => void;
  }>;
};

export function ResourceList({ groups, empty, trailing }: { groups: ResourceGroup[]; empty?: { title: string; description: string }; trailing?: ReactNode }) {
  return (
    <section className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-4 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-academy-ink dark:text-academy-parchment">{group.title}</h2>
            {trailing}
          </div>
          <div className="divide-y divide-slate-950/5 dark:divide-white/10">
            {group.rows.map((row) => <ResourceRow key={`${group.title}-${row.title}-${row.meta}`} {...row} />)}
          </div>
          {empty && !group.rows.length ? <EmptyState title={empty.title} description={empty.description} /> : null}
        </div>
      ))}
    </section>
  );
}

export function ResourceRow({ icon: Icon, title, meta, href, actionLabel, onAction }: ResourceGroup['rows'][number]) {
  const content = (
    <div className="academy-row">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ios bg-slate-950/[0.04] text-academy-aegean dark:bg-white/[0.06] dark:text-academy-gold">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-academy-ink dark:text-academy-parchment">{title}</p>
        <p className="truncate text-xs text-academy-muted">{meta}</p>
      </div>
      {actionLabel ? (
        <button className="academy-btn academy-btn-outline min-h-9 px-3 text-xs" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 text-academy-muted" aria-hidden="true" />
      )}
    </div>
  );

  return href ? <a href={href}>{content}</a> : content;
}

export function StudentSettingsRoute() {
  const auth = useAuth();
  const profile = auth.profile;

  return (
    <PageShell
      title="Settings"
      subtitle="Profile, account, notifications, privacy, and appearance preferences."
      section="student"
    >
      <section className="space-y-4">
        <div className="academy-major-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Student settings</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">{profile?.full_name || 'Your profile'}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">Manage the core preferences for your student portal experience.</p>
        </div>
        <SettingsGroup title="Profile">
          <SettingsRow icon={UserRound} label="Name" value={profile?.full_name || 'Pending'} />
          <SettingsRow icon={FileText} label="Email" value={profile?.email || 'Pending'} />
          <SettingsRow icon={GraduationCap} label="Role" value={profile?.role || 'Student'} />
        </SettingsGroup>
        <SettingsGroup title="Account">
          <SettingsRow icon={Bell} label="Notifications" value="Learning reminders enabled" />
          <SettingsRow icon={Lock} label="Password and sign-in" value="Managed by secure login" />
        </SettingsGroup>
        <SettingsGroup title="Privacy">
          <SettingsRow icon={Shield} label="Learner data" value="Private to your account" />
          <SettingsRow icon={FileText} label="Reports" value="Shared only with authorised guardians or partners" />
        </SettingsGroup>
        <SettingsGroup title="Appearance">
          <SettingsRow icon={Moon} label="Theme" value="Uses your device setting" />
        </SettingsGroup>
      </section>
    </PageShell>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-4 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <h2 className="mb-2 text-lg font-semibold text-academy-ink dark:text-academy-parchment">{title}</h2>
      <div className="divide-y divide-slate-950/5 dark:divide-white/10">{children}</div>
    </section>
  );
}

export function SettingsRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="academy-row">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ios bg-slate-950/[0.04] text-academy-aegean dark:bg-white/[0.06] dark:text-academy-gold">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-academy-ink dark:text-academy-parchment">{label}</p>
        <p className="truncate text-xs text-academy-muted">{value}</p>
      </div>
    </div>
  );
}

function ReportHistoryCard({ report, onOpen }: { report: WeeklyReportListItem; onOpen: (reportId: string) => Promise<void> }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-950">Weekly learning report</p>
          <p className="mt-1 text-sm text-slate-600">{formatDate(report.week_start || report.weekStart)} - {formatDate(report.week_end || report.weekEnd)}</p>
          <p className="mt-1 text-xs text-slate-500">Created {formatDate(report.created_at || report.createdAt)}</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800" type="button" onClick={() => void onOpen(report.id)}>
          View details
        </button>
      </div>
    </article>
  );
}

function WeeklyReportDetail({ report }: { report: WeeklyReport }) {
  const payload = report.payload;
  const topicProgress = (payload?.topicProgress || []).map(
    (item) => `${item.subject} — ${item.topic}: ${item.completion}%`,
  );
  return (
    <div className="mt-4 space-y-4">
      {report.is_stale ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This is a saved snapshot. Updated marks or sessions may not be reflected yet.
        </p>
      ) : null}
      <dl className="grid gap-3 text-sm">
        <DetailLine label="Week" value={`${formatDate(report.weekStart || report.week_start)} - ${formatDate(report.weekEnd || report.week_end)}`} />
        <DetailLine label="Generated" value={formatDate(report.createdAt || report.created_at)} />
        <DetailLine label="Snapshot as of" value={formatDate(report.source_watermark || report.createdAt || report.created_at)} />
        <DetailLine label="Sessions attended" value={String(payload?.metrics.sessionsAttended ?? 0)} />
        <DetailLine label="Minutes studied" value={String(payload?.metrics.timeStudiedMinutes ?? 0)} />
      </dl>
      <ReportList title="Topic progress" items={topicProgress} />
      <ReportList title="Tutor notes this week" items={payload?.tutorNotesSummary || []} />
      <ReportList title="Goals for next week" items={payload?.goalsNextWeek || []} />
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-600">
        {items.map((item, index) => <li key={`${title}-${index}`} className="rounded-lg bg-slate-50 p-3">{item}</li>)}
      </ul>
    </div>
  );
}

function ReportTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
