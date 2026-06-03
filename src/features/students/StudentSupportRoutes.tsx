import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Bell, BookOpen, ChevronRight, FileText, GraduationCap, Lock, Moon, Shield, UserRound, type LucideIcon } from 'lucide-react';
import { ErrorState, PageShell, PremiumButton } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { formatDate } from '../../lib/utils/format';
import { useAuth } from '../auth/AuthProvider';
import {
  createStudyRoom,
  joinStudyRoom,
  loadCommunityOverview,
  loadRoomMessages,
  postRoomMessage,
  type CommunityChallenge,
  type CommunityQuestion,
  type RoomMessage,
  type StudyRoom,
} from './studentCommunityRepository';
import { loadStudentDashboard } from './studentDashboardRepository';
import { generateWeeklyReport, loadWeeklyReport, loadWeeklyReports, type WeeklyReport, type WeeklyReportListItem } from './studentReportsRepository';

export function StudentCommunityRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadCommunityOverview, []);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [roomSubject, setRoomSubject] = useState('');
  const [roomGrade, setRoomGrade] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function selectRoom(room: StudyRoom) {
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await joinStudyRoom(room.id);
      const payload = await loadRoomMessages(room.id);
      setActiveRoom(room);
      setMessages(payload.items || []);
      setNotice(`Opened ${room.subject}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open study room.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = roomSubject.trim();
    if (!subject) {
      return;
    }
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      const result = await createStudyRoom({ subject, grade: roomGrade.trim() || undefined });
      setRoomSubject('');
      setRoomGrade('');
      setNotice('Study room created.');
      await reload();
      if (result.room) {
        await selectRoom(result.room);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create study room.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!activeRoom || !content) {
      return;
    }
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await postRoomMessage(activeRoom.id, content);
      const payload = await loadRoomMessages(activeRoom.id);
      setMessages(payload.items || []);
      setMessage('');
      setNotice('Message posted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not post message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Community"
      subtitle="Moderated study rooms, weekly challenges, and peer Q&A migrated from the legacy student page."
      section="student"
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Study rooms</h2>
                <p className="mt-1 text-sm text-slate-600">Join a focused subject room before reading or posting messages.</p>
              </div>
              <PremiumButton onClick={() => void reload()}>Refresh</PremiumButton>
            </div>
            {loading ? <p className="mt-4 text-sm text-slate-600">Loading community...</p> : null}
            {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
            {notice ? <p className="mt-4 text-sm font-semibold text-emerald-700">{notice}</p> : null}
            {actionError ? <p className="mt-4 text-sm font-semibold text-red-700">{actionError}</p> : null}
            <div className="mt-5 grid gap-3">
              {(data?.rooms || []).map((room) => (
                <article key={room.id} className={`rounded-lg border p-4 ${activeRoom?.id === room.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{room.subject || 'Study room'}</p>
                      <p className="mt-1 text-sm text-slate-600">{room.grade || 'Mixed grade'} | {room.member_count ?? room.memberCount ?? 0} learners</p>
                    </div>
                    <StatusBadge value={room.is_member ? 'joined' : 'open'} />
                  </div>
                  <button disabled={busy} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60" onClick={() => void selectRoom(room)}>
                    {activeRoom?.id === room.id ? 'Selected' : 'Open room'}
                  </button>
                </article>
              ))}
              {data && !data.rooms.length ? <EmptyState title="No study rooms yet" description="Create a room for a subject you want to practise, then keep the discussion focused and respectful." /> : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-950">Create study room</h2>
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(event) => void submitRoom(event)}>
              <FormField label="Subject"><TextInput required value={roomSubject} onChange={(event) => setRoomSubject(event.target.value)} placeholder="Mathematics" /></FormField>
              <FormField label="Grade"><TextInput value={roomGrade} onChange={(event) => setRoomGrade(event.target.value)} placeholder="Grade 11" /></FormField>
              <div className="md:col-span-2">
                <PremiumButton disabled={busy} type="submit">
                  {busy ? 'Saving...' : 'Create room'}
                </PremiumButton>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-950">Weekly challenges</h2>
            <div className="mt-5">
              <DataTable<CommunityChallenge>
                rows={data?.challenges || []}
                empty="No weekly challenges are available yet."
                columns={[
                  { key: 'title', label: 'Challenge', render: (row) => <span className="font-semibold text-slate-950">{row.title}</span> },
                  { key: 'subject', label: 'Subject', render: (row) => row.subject || 'Subject pending' },
                  { key: 'week', label: 'Week', render: (row) => `${formatDate(row.week_start || row.weekStart)} - ${formatDate(row.week_end || row.weekEnd)}` },
                  { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.has_submitted ? 'submitted' : 'open'} /> },
                ]}
              />
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-xl font-semibold text-slate-950">Room chat</h2>
            <p className="mt-1 text-sm text-slate-600">{activeRoom ? `Room: ${activeRoom.subject}` : 'Open a room to read or post messages.'}</p>
            <div className="mt-5 max-h-[28rem] space-y-3 overflow-auto rounded-lg bg-slate-50 p-4">
              {messages.map((item) => (
                <article key={item.id} className="rounded-lg bg-white p-3">
                  <p className="font-semibold text-slate-950">{item.nickname || item.student_name || item.authorName || 'Member'}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at || item.createdAt)}</p>
                </article>
              ))}
              {activeRoom && !messages.length ? <p className="text-sm text-slate-600">No messages yet. Start with a clear question or worked step.</p> : null}
              {!activeRoom ? <p className="text-sm text-slate-600">Select a study room first.</p> : null}
            </div>
            <form className="mt-4 space-y-3" onSubmit={(event) => void submitMessage(event)}>
              <FormField label="Message">
                <TextArea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Ask a focused study question or share a worked step..." />
              </FormField>
              <PremiumButton disabled={busy || !activeRoom || !message.trim()} type="submit">
                {busy ? 'Sending...' : 'Send message'}
              </PremiumButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-slate-950">Peer Q&A</h2>
            <div className="mt-4 space-y-3">
              {(data?.questions || []).slice(0, 8).map((question: CommunityQuestion) => (
                <article key={question.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{question.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{[question.subject, question.topic].filter(Boolean).join(' | ') || 'General question'}</p>
                    </div>
                    <StatusBadge value={question.verified_answer_id ? 'verified' : question.status || 'open'} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{question.answer_count || 0} answers</p>
                </article>
              ))}
              {data && !data.questions.length ? <EmptyState title="No peer questions yet" description="Q&A should be used for specific learning questions without sharing private personal details." /> : null}
            </div>
          </Card>
        </aside>
      </section>
    </PageShell>
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
                  ? data.classes.map((item) => ({ icon: BookOpen, title: item.subject || 'Class', meta: [item.day_of_week, item.start_time, item.location].filter(Boolean).join(' | ') || 'Schedule pending' }))
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
                  meta: `${formatDate(report.week_start || report.weekStart)} - ${formatDate(report.week_end || report.weekEnd)}`,
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
      <ChevronRight className="h-4 w-4 text-academy-muted" aria-hidden="true" />
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
  const payload = report.payload || {};
  return (
    <div className="mt-4 space-y-4">
      <dl className="grid gap-3 text-sm">
        <DetailLine label="Week" value={`${formatDate(report.weekStart || report.week_start)} - ${formatDate(report.weekEnd || report.week_end)}`} />
        <DetailLine label="Generated" value={formatDate(report.createdAt || report.created_at)} />
        <DetailLine label="Sessions attended" value={String(payload.sessionsAttended ?? 0)} />
        <DetailLine label="Minutes studied" value={String(payload.minutesStudied ?? 0)} />
      </dl>
      {payload.summary ? <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{payload.summary}</p> : null}
      <ReportList title="Topics covered" items={payload.topics || []} />
      <ReportList title="Assignment highlights" items={payload.assignmentHighlights || []} />
      {payload.nextBestStep ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-900">Next best step</p>
          <p className="mt-1 text-sm leading-6 text-teal-800">{payload.nextBestStep}</p>
        </div>
      ) : null}
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
