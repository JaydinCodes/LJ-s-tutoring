import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { BookOpen, Brain, CheckCircle2, Clock, ScrollText, Sparkles, Target, TrendingUp, Trophy, UploadCloud, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatedProgressBar, GreekHeroCard, InsightCard, PremiumButton, StaggerGrid, StaggerItem, TimelineCard } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { Assignment, AssignmentSubmission, StudentDashboardView, StudentProgress } from '../../types/lms';
import {
  calculateAssignmentStatus,
  daysUntil,
  getAssignmentStatusLabel,
} from '../assignments/assignmentStatus';
import { selectDueTasks, type NormalizedStudentData } from './studentData';
import { sortBattlePlanForDisplay, type BattlePlanItem } from './studentBattlePlan';
import type { DailyInsight } from './studentDailyInsight';
import { useSubmitStudentAssignmentMutation } from './studentQueries';

export function TodayOdyssey({
  data,
  nextAssignment,
  completionRate,
  dailyInsight,
  battlePlan,
}: {
  data: StudentDashboardView;
  nextAssignment?: Assignment;
  completionRate: number;
  dailyInsight: DailyInsight;
  battlePlan: BattlePlanItem[];
}) {
  const dueDelta = daysUntil(nextAssignment?.due_date);
  const nextExam = data.examCalendar?.nextExam;
  const nextExamDelta = daysUntil(nextExam?.examDate);
  const firstAction = battlePlan[0];
  const academicStatus = data.dailyInsightContext?.currentAcademicStatus || data.supportStatus?.label || 'Building rhythm';

  return (
    <section className="academy-major-surface relative overflow-hidden">
      <div className="absolute inset-x-6 top-0 h-px greek-keyline" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Today&apos;s Odyssey</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
              {data.profile.name ? `Good to see you, ${data.profile.name.split(' ')[0]}` : 'Good to see you'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">{dailyInsight.message}</p>
          </div>
          <div className="rounded-ios-lg border border-white/15 bg-white/10 p-4 shadow-academy-inset backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-gold">Current status</p>
            <p className="mt-2 text-2xl font-semibold text-white">{academicStatus}</p>
            <p className="mt-2 text-sm leading-6 text-academy-parchment">{completionRate}% assignment completion</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <OdysseySignal label="Next task" value={nextAssignment?.title || 'Queue clear'} helper={formatTaskDue(nextAssignment?.due_date, dueDelta)} />
          <OdysseySignal label="Next exam" value={nextExam?.subject || 'Not scheduled'} helper={formatExamDue(nextExam?.title, nextExam?.examDate, nextExamDelta)} />
          <OdysseySignal label="Focus" value={dailyInsight.eyebrow} helper={dailyInsight.action} />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-gold">Primary action</p>
            <p className="mt-1 text-base font-semibold text-white">{firstAction?.title || 'Open your next learning step'}</p>
          </div>
          <Link className="academy-btn academy-btn-gold w-full sm:w-auto" to={firstAction?.to || '/dashboard/student/assignments'}>
            {firstAction ? 'Start now' : 'Open assignments'}
          </Link>
        </div>
      </div>
    </section>
  );
}

function OdysseySignal({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 border-t border-white/[0.12] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-academy-parchment">{helper}</p>
    </div>
  );
}

export function LearningTimeline({ items }: { items: BattlePlanItem[] }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const visibleItems = useMemo(() => sortBattlePlanForDisplay(items, completedIds), [items, completedIds]);

  function toggleComplete(itemId: string) {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <section aria-labelledby="learning-timeline-title" className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Learning path</p>
          <h2 id="learning-timeline-title" className="mt-1 text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment">
            What should I do today?
          </h2>
        </div>
        <span className="academy-chip shrink-0">{items.length} steps</span>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-5 hidden h-[calc(100%-2.5rem)] w-px bg-gradient-to-b from-academy-gold via-academy-aegean/35 to-transparent sm:block" aria-hidden="true" />
        <div className="space-y-2">
          {!visibleItems.length ? (
            <EmptyState
              title="No learning path yet"
              description="Once assignments, marks, or topic progress arrive, this becomes a short ordered plan for the day."
              actionLabel="Open progress"
              actionHref="/dashboard/student/progress"
              icon={Brain}
            />
          ) : null}
          {visibleItems.map((item, index) => {
            const isCompleted = completedIds.has(item.id);
            return (
              <article key={item.id} className={`relative rounded-ios-lg border border-transparent py-3 pl-0 transition duration-fluid ease-ios sm:pl-10 ${isCompleted ? 'opacity-60' : ''}`}>
                <span className={`mb-2 grid h-8 w-8 place-items-center rounded-full border text-xs font-bold sm:absolute sm:left-0 sm:top-4 ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' : 'border-academy-gold/30 bg-academy-gold/[0.12] text-academy-navy dark:text-academy-gold'}`}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <div className="rounded-ios-lg border border-white/70 bg-white/[0.58] p-4 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">{item.kind}</p>
                      <h3 className={`mt-1 text-lg font-semibold text-academy-ink dark:text-academy-parchment ${isCompleted ? 'line-through' : ''}`}>{item.title}</h3>
                    </div>
                    <span className="rounded-full bg-slate-950/[0.04] px-3 py-1 text-xs font-semibold text-academy-muted dark:bg-white/[0.06]">{item.estimatedMinutes} min</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-academy-muted">{isCompleted ? 'Marked complete for this page load.' : item.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link className="academy-btn academy-btn-outline min-h-10 px-4" to={item.to}>Open</Link>
                    <button className="academy-btn academy-btn-primary min-h-10 px-4" type="button" onClick={() => toggleComplete(item.id)}>
                      {isCompleted ? 'Mark active' : 'Done'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SubjectProgressBands({ progress }: { progress: StudentProgress[] }) {
  const bands = useMemo(() => getSubjectProgressBands(progress), [progress]);

  return (
    <section aria-labelledby="subject-progress-title" className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Subject bands</p>
        <h2 id="subject-progress-title" className="mt-1 text-2xl font-semibold tracking-normal text-academy-ink dark:text-academy-parchment">
          Progress by subject
        </h2>
      </div>

      <div className="divide-y divide-slate-950/5 rounded-ios-lg border border-white/70 bg-white/[0.46] px-4 shadow-academy-inset backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]">
        {!bands.length ? (
          <div className="py-4">
            <EmptyState
              title="No progress snapshot yet"
              description="Topic mastery appears here as soon as marks or progress records are available."
              actionLabel="Open assignments"
              actionHref="/dashboard/student/assignments"
              icon={BookOpen}
            />
          </div>
        ) : null}
        {bands.map((band) => (
          <div key={band.subject} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-academy-ink dark:text-academy-parchment">{band.subject}</h3>
                <p className="mt-1 text-sm leading-6 text-academy-muted">
                  {band.weakestTopic ? `Next focus: ${band.weakestTopic}` : `${band.topicCount} topic${band.topicCount === 1 ? '' : 's'} recorded`}
                </p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-academy-aegean dark:text-academy-gold">{band.average}%</p>
            </div>
            <div className="mt-3">
              <AnimatedProgressBar value={band.average} color={band.color} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getSubjectProgressBands(progress: StudentProgress[]) {
  const grouped = new Map<string, StudentProgress[]>();
  for (const item of progress) {
    const subject = item.subject || item.subject_id || 'General study';
    grouped.set(subject, [...(grouped.get(subject) || []), item]);
  }

  return [...grouped.entries()]
    .map(([subject, items], index) => {
      const scores = items.map((item) => Number(item.score || 0));
      const average = scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0;
      const weakest = [...items].sort((left, right) => Number(left.score || 0) - Number(right.score || 0) || left.topic.localeCompare(right.topic))[0];
      return {
        subject,
        average,
        weakestTopic: weakest?.topic,
        topicCount: items.length,
        color: ['#1F6F8B', '#f4c518', '#1e3a5f', '#0f8aa6'][index % 4],
      };
    })
    .sort((left, right) => left.average - right.average || left.subject.localeCompare(right.subject));
}

export function StudentWelcomeCard({
  data,
  nextAssignment,
  completionRate,
  dailyInsight,
}: {
  data: StudentDashboardView;
  nextAssignment?: Assignment;
  completionRate: number;
  dailyInsight: DailyInsight;
}) {
  const dueDelta = daysUntil(nextAssignment?.due_date);
  const nextExam = data.examCalendar?.nextExam;
  const nextExamDelta = daysUntil(nextExam?.examDate);
  const academicStatus = data.dailyInsightContext?.currentAcademicStatus || data.supportStatus?.label || 'Awaiting results';

  return (
    <GreekHeroCard
      eyebrow="Learning voyage"
      title={`Welcome back, ${data.profile.name || 'Student'}`}
      description={dailyInsight.message}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <HeroMetric label="Learner" value={data.profile.name || 'Student'} helper="Your personal dashboard" />
          <HeroMetric label="Grade" value={data.profile.grade || 'Pending'} helper="Current academic level" />
          <HeroMetric label="School" value={data.profile.school || 'Pending'} helper="Learning context" />
          <HeroMetric label="Next task" value={nextAssignment?.title || 'Clear'} helper={formatTaskDue(nextAssignment?.due_date, dueDelta)} />
          <HeroMetric label="Next exam" value={nextExam?.subject || 'Not scheduled'} helper={formatExamDue(nextExam?.title, nextExam?.examDate, nextExamDelta)} />
          <HeroMetric label="Academic status" value={academicStatus} helper={data.supportStatus?.recommendedAction || "Use today's plan to keep moving."} />
        </div>

        <div className={`relative overflow-hidden rounded-3xl border p-5 text-sm leading-6 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-2xl ${dailyInsightToneClasses[dailyInsight.tone]}`}>
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-gold/20 blur-xl" aria-hidden="true" />
          {/* Oracle Insight keeps the recommendation distinct from the raw status tiles. */}
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">Oracle Insight</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{dailyInsight.eyebrow}</h3>
            <p className="mt-2 text-brand-parchment">{dailyInsight.action}</p>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3 text-xs text-brand-parchment">
              <p>Completion: {completionRate}%</p>
              <p className="mt-1">This recommendation stays stable today and refreshes tomorrow.</p>
            </div>
          </div>
        </div>
      </div>
    </GreekHeroCard>
  );
}

const dailyInsightToneClasses: Record<DailyInsight['tone'], string> = {
  steady: 'border-white/20 bg-white/10 text-brand-parchment',
  momentum: 'border-white/15 bg-brand-aegean/16 text-brand-parchment',
  focus: 'border-white/15 bg-brand-gold/12 text-brand-parchment',
  revision: 'border-white/15 bg-brand-gold/16 text-brand-parchment',
  urgent: 'border-red-300/70 bg-red-950/30 text-red-50',
};

function HeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-parchment">{helper}</p>
    </div>
  );
}

function formatTaskDue(value?: string | null, delta?: number | null) {
  if (!value) return 'No due date on the next task.';
  if (delta === 0) return `Due today, ${formatDate(value)}.`;
  if (typeof delta === 'number' && delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue.`;
  if (typeof delta === 'number') return `Due in ${delta} day${delta === 1 ? '' : 's'} on ${formatDate(value)}.`;
  return `Due ${formatDate(value)}.`;
}

function formatExamDue(title?: string | null, value?: string | null, delta?: number | null) {
  if (!value) return 'No exam date has been added yet.';
  const prefix = title ? `${title}: ` : '';
  if (delta === 0) return `${prefix}exam today.`;
  if (typeof delta === 'number' && delta > 0) return `${prefix}${delta} day${delta === 1 ? '' : 's'} to prepare.`;
  if (typeof delta === 'number' && delta < 0) return `${prefix}exam date has passed.`;
  return `${prefix}${formatDate(value)}.`;
}

export function ProgressSummaryCards({
  data,
  studentData,
  progress,
}: {
  data: StudentDashboardView;
  studentData: NormalizedStudentData;
  progress: StudentProgress[];
}) {
  const averageScore = progress.length
    ? Math.round(progress.reduce((total, item) => total + Number(item.score || 0), 0) / progress.length)
    : null;
  const dueTasks = selectDueTasks(studentData);
  const nextTask = dueTasks[0];
  const weakestTopic = progress.length
    ? [...progress].sort((left, right) => Number(left.score || 0) - Number(right.score || 0) || left.topic.localeCompare(right.topic))[0]
    : null;
  const streakDays = data.dailyInsightContext?.streakDays ?? 0;
  const nextExam = data.examCalendar?.nextExam;
  const nextExamDays = daysUntil(nextExam?.examDate);

  return (
    <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ActionMetricCard
        label="Next Due"
        value={nextTask ? nextTask.assignment.title : 'Clear'}
        explanation={nextTask ? `${getAssignmentStatusLabel(nextTask.status)} - ${dueText(nextTask.assignment.due_date, daysUntil(nextTask.assignment.due_date))}` : 'No urgent assignment is blocking today. Use the time for review or exam prep.'}
        action={nextTask ? 'Open assignment detail' : 'View assignments'}
        to={nextTask ? `/dashboard/student/assignments/${nextTask.assignmentId}` : '/dashboard/student/assignments'}
        icon={Clock}
        tone="urgent"
      />
      <ActionMetricCard
        label="Open Assignments"
        value={String(dueTasks.length)}
        explanation={dueTasks.length ? 'These are ordered by overdue work, due-soon pressure, and returned corrections.' : 'Your visible assignment queue is clear right now.'}
        action="Plan assignment work"
        to="/dashboard/student/assignments"
        icon={ScrollText}
        tone="gold"
      />
      <ActionMetricCard
        label="Average Score"
        value={averageScore == null ? '--' : `${averageScore}%`}
        explanation={averageScore == null ? 'Results will appear once marks or progress records are available.' : 'Use recent performance to decide whether to consolidate or push ahead.'}
        action="Review results"
        to="/dashboard/student/results"
        icon={Trophy}
        tone="navy"
      />
      <ActionMetricCard
        label="Weakest Topic"
        value={weakestTopic?.topic || 'Pending'}
        explanation={weakestTopic ? `${weakestTopic.score}% mastery. Start here if you only have one focused study block today.` : 'Progress records will identify the best topic to practise first.'}
        action="Open progress"
        to="/dashboard/student/progress"
        icon={Brain}
        tone="aegean"
      />
      <ActionMetricCard
        label="Study Streak"
        value={`${streakDays} day${streakDays === 1 ? '' : 's'}`}
        explanation={streakDays ? 'Keep the habit alive with one meaningful task before the day gets busy.' : 'Start the streak with one short, completed learning block.'}
        action="Check progress"
        to="/dashboard/student/progress"
        icon={TrendingUp}
        tone="marble"
      />
      {nextExam ? (
        <ActionMetricCard
          label="Exam Readiness"
          value={nextExamDays == null ? 'Scheduled' : `${nextExamDays} day${nextExamDays === 1 ? '' : 's'}`}
          explanation={`${nextExam.subject}: ${nextExam.title}. ${weakestTopic ? `Pair revision with ${weakestTopic.topic}.` : 'Use progress records to choose revision topics.'}`}
          action="Build revision plan"
          to="/dashboard/student/progress"
          icon={Target}
          tone="gold"
        />
      ) : null}
    </StaggerGrid>
  );
}

function ActionMetricCard({
  label,
  value,
  explanation,
  action,
  to,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  explanation: string;
  action: string;
  to: string;
  icon: LucideIcon;
  tone: 'urgent' | 'gold' | 'navy' | 'aegean' | 'marble';
}) {
  const toneClass = {
    urgent: 'border-white/70 bg-white/76 text-brand-obsidian hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
    gold: 'border-white/70 bg-white/76 text-brand-obsidian hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
    navy: 'border-white/65 bg-brand-navy text-white hover:border-brand-gold/50 dark:border-white/10 dark:bg-white/[0.08]',
    aegean: 'border-white/70 bg-white/76 text-brand-obsidian hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
    marble: 'border-white/70 bg-white/76 text-brand-obsidian hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment',
  }[tone];
  const accentClass = {
    urgent: 'text-red-700 bg-red-500/[0.08] border-red-500/10 dark:text-red-200 dark:bg-red-500/10',
    gold: 'text-[#9a6a05] bg-brand-gold/[0.12] border-brand-gold/20 dark:text-brand-gold dark:bg-brand-gold/10',
    navy: 'text-brand-gold bg-white/10 border-white/10',
    aegean: 'text-brand-aegean bg-brand-aegean/[0.07] border-brand-aegean/10 dark:bg-brand-aegean/10',
    marble: 'text-slate-500 bg-slate-950/[0.04] border-slate-950/[0.06] dark:text-brand-marble dark:bg-white/[0.06]',
  }[tone];
  const mutedClass = tone === 'navy'
    ? 'text-brand-parchment'
    : 'text-slate-600 dark:text-brand-marble';

  return (
    <StaggerItem>
      <Link className={`group block h-full rounded-[1.6rem] border p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${toneClass}`} to={to}>
        <article className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${mutedClass}`}>{label}</p>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[1.15rem] border ${accentClass}`}>
              <Icon className="h-5 w-5 text-current" aria-hidden="true" strokeWidth={2} />
            </span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-2xl font-semibold tracking-tight">{value}</h3>
          <p className={`mt-3 flex-1 text-sm leading-6 ${mutedClass}`}>{explanation}</p>
          <p className="mt-4 text-sm font-semibold text-brand-aegean group-hover:text-brand-gold dark:text-brand-gold">{action}</p>
        </article>
      </Link>
    </StaggerItem>
  );
}

export function TodayBattlePlan({ items }: { items: BattlePlanItem[] }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const visibleItems = useMemo(() => sortBattlePlanForDisplay(items, completedIds), [items, completedIds]);

  function toggleComplete(itemId: string) {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">
            <Sparkles className="h-4 w-4 text-current" aria-hidden="true" />
            Today's Battle Plan
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">3 to 5 focused actions, in order</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">Start at the top. Completed actions move down so the next useful step stays visible.</p>
        </div>
        <p className="rounded-full border border-white/70 bg-white/62 px-3 py-1 text-xs font-semibold text-brand-obsidian shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment">{items.length} actions</p>
      </div>

      <StaggerGrid className="mt-5 grid gap-3">
        {!visibleItems.length ? (
          <EmptyState
            title="No quiz recommendation yet"
            description="Quiz suggestions appear when the dashboard has a weak topic or revision target. Start with assignments or progress so recommendations stay grounded in real data."
            actionLabel="Open progress"
            actionHref="/dashboard/student/progress"
            icon={Brain}
          />
        ) : null}
        {visibleItems.map((item, index) => {
          const isCompleted = completedIds.has(item.id);
          return (
            <StaggerItem key={item.id}>
              <article className={`rounded-2xl border p-4 backdrop-blur-xl transition ${isCompleted ? 'border-white/50 bg-white/40 opacity-70 dark:border-white/10 dark:bg-white/[0.03]' : 'border-white/70 bg-white/62 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.05]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-aegean dark:text-brand-gold">Step {index + 1} - {item.kind}</p>
                    <h3 className={`mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100 ${isCompleted ? 'line-through' : ''}`}>{item.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/70 bg-white/62 px-3 py-1 text-xs font-semibold text-brand-obsidian shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment">{item.estimatedMinutes} min</span>
                </div>
                {!isCompleted ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-brand-marble">{item.description}</p>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-brand-marble">Marked complete for this page load.</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment dark:hover:bg-white/[0.08]" to={item.to}>
                    Open action
                  </Link>
                  <button className="rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deepBlue dark:bg-brand-aegean" type="button" onClick={() => toggleComplete(item.id)}>
                    {isCompleted ? 'Mark active' : 'Mark complete'}
                  </button>
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    </Card>
  );
}

export function AssignmentsDueSection({
  studentData,
  limit,
  selectedAssignmentId,
}: {
  studentData: NormalizedStudentData;
  limit?: number;
  selectedAssignmentId?: string;
}) {
  const visible = useMemo(() => selectDueTasks(studentData, limit), [studentData, limit]);

  return (
    <StaggerGrid className="space-y-4">
      {visible.map((task) => (
        <StaggerItem key={task.assignmentId}>
          <AssignmentDueCard
            assignment={task.assignment}
            submission={task.submission}
            isSelected={task.assignmentId === selectedAssignmentId}
          />
        </StaggerItem>
      ))}
      {!visible.length ? (
        <EmptyState
          title="No assignments due right now"
          description="Your active queue is clear. Use the space to review a weak topic or check whether new work has landed."
          actionLabel="Open progress"
          actionHref="/dashboard/student/progress"
          icon={ScrollText}
        />
      ) : null}
    </StaggerGrid>
  );
}

export function AssignmentDueCard({
  assignment,
  submission,
  isSelected = false,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  isSelected?: boolean;
}) {
  const status = calculateAssignmentStatus({ assignment, submission });
  const dueDelta = daysUntil(assignment.due_date);

  return (
    <div id={`assignment-${assignment.id}`} className={isSelected ? 'rounded-[1.7rem] ring-4 ring-brand-gold/40' : undefined}>
      <InsightCard
        title={assignment.title}
        description={[assignment.grade, dueText(assignment.due_date, dueDelta)].filter(Boolean).join(' | ')}
      >
        {isSelected ? <p className="mb-3 rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-obsidian dark:text-brand-parchment">Selected assignment detail</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-aegean dark:text-brand-gold">{assignment.subject || assignment.subject_id || 'Subject pending'}</p>
          <StatusBadge value={status} />
        </div>
        {assignment.description ? (
          <p className="mt-4 line-clamp-3 rounded-2xl border border-white/70 bg-white/58 p-4 text-sm leading-6 text-slate-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-marble">{assignment.description}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-brand-marble">
            {submission ? `Last submitted ${formatDate(submission.submitted_at)}.` : 'Open the detail page to read instructions and submit work.'}
          </p>
          <Link className="rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deepBlue dark:bg-brand-aegean" to={`/student/assignments/${assignment.id}`}>
            Open assignment
          </Link>
        </div>
      </InsightCard>
    </div>
  );
}

function dueText(value?: string | null, delta?: number | null) {
  if (!value) {
    return 'Due date pending';
  }
  if (delta === 0) {
    return `Due today (${formatDate(value)})`;
  }
  if (typeof delta === 'number' && delta < 0) {
    return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  }
  if (typeof delta === 'number') {
    return `Due ${formatDate(value)} (${delta} day${delta === 1 ? '' : 's'} left)`;
  }
  return `Due ${formatDate(value)}`;
}

function SubmissionPreview({ submission }: { submission: AssignmentSubmission }) {
  return (
    <TimelineCard title={`Submitted ${formatDate(submission.submitted_at)}`} meta={submission.feedback || 'Waiting for tutor feedback.'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge value={calculateAssignmentStatus({ assignment: { status: 'published', due_date: null }, submission })} />
      </div>
      {submission.file_url ? <p className="mt-2 break-all text-sm text-slate-600 dark:text-brand-marble"><span className="font-semibold">File:</span> <span className="font-mono text-xs">{submission.file_url}</span></p> : null}
      {submission.marks_awarded != null ? <p className="mt-2 text-sm font-semibold text-brand-aegean dark:text-brand-gold">Mark: {submission.marks_awarded}%</p> : null}
    </TimelineCard>
  );
}

export function AssignmentUploadPanel({
  assignment,
  submission,
  disabled,
}: {
  assignment: Assignment;
  submission?: AssignmentSubmission;
  disabled?: boolean;
}) {
  const [textAnswer, setTextAnswer] = useState(submission?.text_answer || '');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resubmissionConfirmed, setResubmissionConfirmed] = useState(false);
  const submitAssignmentMutation = useSubmitStudentAssignmentMutation();
  const busy = submitAssignmentMutation.isPending;
  const needsConfirmation = Boolean(submission);
  const isImagePreview = file ? ['image/jpeg', 'image/png'].includes(file.type) : false;

  const setSelectedFile = useCallback((nextFile: File | null) => {
    setFile(nextFile);
    setFileError(nextFile ? getClientFileError(nextFile) : null);
    setMessage(null);
    setError(null);
  }, []);

  const onDropAccepted = useCallback((acceptedFiles: File[]) => {
    setSelectedFile(acceptedFiles[0] || null);
  }, [setSelectedFile]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const rejectedFile = rejections[0]?.file || null;
    setFile(null);
    setFileError(formatDropzoneError(rejections[0]) || (rejectedFile ? getClientFileError(rejectedFile) : 'Upload PDF, JPG, or PNG files only.'));
    setMessage(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: acceptedUploadTypes,
    disabled: disabled || busy,
    maxFiles: 1,
    maxSize: maxUploadBytes,
    multiple: false,
    noClick: true,
    onDropAccepted,
    onDropRejected,
  });

  useEffect(() => {
    if (!file || !isImagePreview) {
      setPreviewUrl(null);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file, isImagePreview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const validation = validateSubmissionInput({ file, textAnswer, hasSubmission: Boolean(submission), resubmissionConfirmed });
    const clientFileError = file ? getClientFileError(file) : '';
    if (fileError || clientFileError || validation) {
      const nextError = fileError || clientFileError || validation;
      setError(nextError);
      toast.error(nextError);
      return;
    }

    try {
      await submitAssignmentMutation.mutateAsync({ assignmentId: assignment.id, textAnswer, file });
      setFile(null);
      setFileError(null);
      setResubmissionConfirmed(false);
      setMessage(submission ? 'Resubmission saved.' : 'Submission saved.');
      toast.success(submission ? 'Resubmission saved.' : 'Submission uploaded.');
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not submit assignment.';
      setError(nextError);
      toast.error(nextError);
    }
  }

  return (
    <form className="mt-5 grid gap-4 rounded-[1.5rem] border border-white/70 bg-white/62 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]" onSubmit={(event) => void submit(event)}>
      {disabled ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This assignment is closed and no longer accepts submissions.</p>
      ) : null}
      <FormField label="Submission note" hint="Optional note, link, or short written answer for your tutor.">
        <TextArea
          disabled={disabled || busy}
          value={textAnswer}
          onChange={(event) => setTextAnswer(event.target.value)}
          placeholder="Type a note or answer..."
        />
      </FormField>
      <FormField label="Upload file" hint="Drag PDF, JPG, or PNG files here. Maximum file size is 10 MB.">
        <div
          {...getRootProps()}
          className={`rounded-[1.5rem] border p-5 backdrop-blur-xl transition ${isDragActive ? 'border-brand-gold/70 bg-brand-gold/10' : 'border-white/70 bg-white/50'} ${disabled || busy ? 'cursor-not-allowed opacity-60' : 'cursor-default hover:border-brand-aegean/45 hover:bg-white/70'}`}
        >
          <input {...getInputProps()} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-950">{isDragActive ? 'Drop the file here' : 'Drag your file into this dropzone'}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">PDF, JPG, or PNG only. Validation happens before the upload starts.</p>
              <button
                className="mt-4 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled || busy}
                type="button"
                onClick={open}
              >
                Choose file
              </button>
            </div>
            <FilePreview file={file} previewUrl={previewUrl} isImagePreview={isImagePreview} />
          </div>
        </div>
        {fileError ? <p className="mt-2 text-sm font-semibold text-red-700">{fileError}</p> : null}
      </FormField>
      {busy ? (
        <div className="rounded-2xl border border-white/70 bg-white/58 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-brand-obsidian">
            <span>Uploading assignment...</span>
            <span>Working</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-aegean" />
          </div>
        </div>
      ) : null}
      {needsConfirmation ? (
        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <input
            className="mt-1"
            checked={resubmissionConfirmed}
            disabled={disabled || busy}
            type="checkbox"
            onChange={(event) => setResubmissionConfirmed(event.target.checked)}
          />
          <span>I understand this will update my existing submission.</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <PremiumButton
          disabled={disabled || busy}
          type="submit"
        >
          {busy ? 'Uploading...' : submission ? 'Update submission' : 'Upload submission'}
        </PremiumButton>
        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}

const maxUploadBytes = 10 * 1024 * 1024;
const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
const allowedExt = ['pdf', 'jpg', 'jpeg', 'png'];
const acceptedUploadTypes = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

function FilePreview({
  file,
  previewUrl,
  isImagePreview,
}: {
  file: File | null;
  previewUrl: string | null;
  isImagePreview: boolean;
}) {
  if (!file) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/58 p-4 text-center text-sm text-slate-500 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <UploadCloud className="mx-auto mb-2 h-6 w-6 text-brand-aegean" aria-hidden="true" />
        No file selected
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/68 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      {isImagePreview && previewUrl ? (
        <img className="h-28 w-full object-cover" src={previewUrl} alt={`Preview of ${file.name}`} />
      ) : (
        <div className="flex h-28 items-center justify-center bg-brand-navy text-sm font-semibold uppercase tracking-[0.2em] text-brand-parchment">PDF</div>
      )}
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
        <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}

function formatDropzoneError(rejection?: FileRejection) {
  const code = rejection?.errors[0]?.code;
  if (code === 'file-too-large') {
    return 'File must be 10 MB or smaller.';
  }
  if (code === 'file-invalid-type') {
    return 'Upload PDF, JPG, or PNG files only.';
  }
  return '';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function getClientFileError(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExt.includes(ext) || (file.type && !allowedMime.includes(file.type))) {
    return 'Upload PDF, JPG, or PNG files only.';
  }
  if (file.size > maxUploadBytes) {
    return 'File must be 10 MB or smaller.';
  }
  return '';
}

function validateSubmissionInput({
  file,
  textAnswer,
  hasSubmission,
  resubmissionConfirmed,
}: {
  file: File | null;
  textAnswer: string;
  hasSubmission: boolean;
  resubmissionConfirmed: boolean;
}) {
  if (!file && !textAnswer.trim()) {
    return 'Add a file or written answer before submitting.';
  }
  if (hasSubmission && !resubmissionConfirmed) {
    return 'Confirm that you want to update the existing submission.';
  }
  if (!file) {
    return '';
  }
  return getClientFileError(file);
}

export function SubmittedAssignmentsList({
  assignmentsById,
  submissions,
}: {
  assignmentsById: Map<string, Assignment>;
  submissions: AssignmentSubmission[];
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Submitted assignments</h2>
          <p className="mt-1 text-sm text-slate-600">Status, timestamps, marks, and feedback for work already sent in.</p>
        </div>
      </div>
      <StaggerGrid className="mt-5 space-y-3">
        {submissions.slice(0, 6).map((submission) => {
          const assignment = assignmentsById.get(submission.assignment_id);
          const status = calculateAssignmentStatus({ assignment: assignment || { status: 'published', due_date: null, id: '', title: '', created_at: '' }, submission });
          return (
            <StaggerItem key={submission.id}>
              <TimelineCard title={assignment?.title || submission.assignment_id} meta={`Submitted ${formatDate(submission.submitted_at)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StatusBadge value={status} />
                </div>
                {submission.marks_awarded != null ? <p className="mt-3 text-sm font-semibold text-teal-700">Mark: {submission.marks_awarded}%</p> : null}
                {submission.feedback ? <p className="mt-2 text-sm leading-6 text-slate-600">{submission.feedback}</p> : null}
              </TimelineCard>
            </StaggerItem>
          );
        })}
        {!submissions.length ? (
          <EmptyState
            title="No submissions yet"
            description="Your submitted work will collect here with timestamps, review status, and released feedback."
            actionLabel="Open assignments"
            actionHref="/dashboard/student/assignments"
            icon={UploadCloud}
          />
        ) : null}
      </StaggerGrid>
    </Card>
  );
}

export function LatestResultsCard({
  assignmentsById,
  submissions,
}: {
  assignmentsById: Map<string, Assignment>;
  submissions: AssignmentSubmission[];
}) {
  const marked = submissions.filter((submission) => submission.status === 'marked' || submission.marks_awarded != null);

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-950">Latest results</h2>
      <p className="mt-1 text-sm text-slate-600">Marks and feedback released by tutors or admins.</p>
      <StaggerGrid className="mt-5 space-y-3">
        {marked.slice(0, 3).map((submission) => (
          <StaggerItem key={submission.id}>
            <TimelineCard title={assignmentsById.get(submission.assignment_id)?.title || submission.assignment_id} meta={submission.feedback || 'No written feedback supplied.'}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-semibold text-teal-700">{submission.marks_awarded == null ? '--' : `${submission.marks_awarded}%`}</p>
              </div>
            </TimelineCard>
          </StaggerItem>
        ))}
        {!marked.length ? (
          <EmptyState
            title="No marked assignments yet"
            description="Released marks and tutor feedback will appear here when marking is complete."
            actionLabel="Review progress"
            actionHref="/dashboard/student/progress"
            icon={Trophy}
          />
        ) : null}
      </StaggerGrid>
    </Card>
  );
}
