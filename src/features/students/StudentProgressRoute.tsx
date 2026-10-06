import { ArrowRight, Brain, CalendarDays, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedProgressBar, EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { formatDate } from '../../lib/utils/format';
import { useLearnerMasterySummary } from '../learning/studentLearningQueries';
import { useStudentDashboardQuery } from './studentQueries';
import type { StudentProgress } from '../../types/lms';

const labels: Record<string, string> = {
  unassessed: 'Not assessed yet',
  emerging: 'Building foundations',
  developing: 'Making progress',
  secure: 'Confident & independent',
  retained: 'Secure over time',
};

const badgeTones: Record<string, string> = {
  unassessed: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  emerging: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  developing: 'bg-brand-aegean/15 text-brand-aegean dark:bg-brand-aegean/25 dark:text-brand-gold',
  secure: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  retained: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200',
};

const emptyStudentProgress: StudentProgress[] = [];

export function StudentProgressRoute() {
  const mastery = useLearnerMasterySummary();
  const dashboard = useStudentDashboardQuery();
  const [activeSubject, setActiveSubject] = useState('All subjects');
  const skills = mastery.data ?? [];
  const legacyProgress = dashboard.data?.progress ?? emptyStudentProgress;
  const filteredProgress = filterProgressBySubject(legacyProgress, activeSubject);
  const subjects = Array.from(new Set(legacyProgress.map((progress) => progress.subject || 'General')));

  if (mastery.isPending) {
    return (
      <PageShell title="Progress" subtitle="Your evidence-driven learning progress." section="student">
        <SkeletonCard className="min-h-64" />
      </PageShell>
    );
  }

  if (mastery.isError) {
    return (
      <PageShell title="Progress" subtitle="Your evidence-driven learning progress." section="student">
        <ErrorState title="Progress unavailable" description="Check your connection and try again." onRetry={() => void mastery.refetch()} />
      </PageShell>
    );
  }

  const emergingSkills = skills.filter((s) => s.state === 'emerging');

  return (
    <PageShell title="Progress" subtitle="Your skills develop through independent evidence over time, not a percentage score." section="student">
      <div className="space-y-6">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-[2rem] bg-brand-navy p-6 text-brand-parchment shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">CAPS Learning Progress</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {skills.length ? `${skills.length} core skill${skills.length === 1 ? '' : 's'} tracked` : 'Progress is starting'}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-brand-marble">
            Instead of raw percentage averages, Project Odysseus tracks independent demonstration of specific mathematical rules. Each skill advances through independent evidence and spaced retrieval.
          </p>

          {/* Mastery scale explainer */}
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-6 sm:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-300">Emerging</span>
              <span className="mt-1 block text-xs text-brand-marble">Building foundations</span>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-sky-300">Developing</span>
              <span className="mt-1 block text-xs text-brand-marble">Making progress</span>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-emerald-300">Secure</span>
              <span className="mt-1 block text-xs text-brand-marble">Consistent & independent</span>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-brand-gold">Retained</span>
              <span className="mt-1 block text-xs text-brand-marble">Verified over time</span>
            </div>
          </div>
        </section>

        {/* Areas to Reinforce Callout if emerging skills exist */}
        {emergingSkills.length > 0 ? (
          <section aria-label="Areas to reinforce" className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-amber-950 dark:text-amber-100">
                    Priority focus: {emergingSkills[0].skillName}
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
                    Targeted practice here will solidify your foundation before advancing to higher cognitive levels.
                  </p>
                </div>
              </div>
              <Link
                className="academy-btn inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-amber-400 bg-white px-5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800 sm:self-center"
                to="/dashboard/student/learning"
              >
                Practise now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {!skills.length ? (
          <EmptyState
            icon={Brain}
            title="No progress recorded yet"
            description="Complete a diagnostic or practice activity to begin building your evidence-based learning profile."
            actionLabel="Open learning"
            actionHref="/dashboard/student/learning"
          />
        ) : (
          <section aria-label="Skill progress" className="grid gap-4 sm:grid-cols-2">
            {skills.map((skill) => {
              const tone = badgeTones[skill.state] ?? badgeTones.unassessed;
              const isSecure = skill.state === 'secure' || skill.state === 'retained';

              return (
                <article key={skill.skillCode} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-brand-navy dark:text-brand-parchment">
                        {skill.skillName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">
                        {labels[skill.state] ?? 'Learning in progress'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone}`}>
                      {isSecure ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      {skill.state}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-brand-marble">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Updated {formatDate(skill.determinedAt)}
                    </p>
                    {skill.state === 'emerging' || skill.state === 'developing' ? (
                      <Link
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-aegean hover:underline dark:text-brand-gold"
                        to="/dashboard/student/learning"
                      >
                        Practise <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {legacyProgress.length ? (
          <section className="mt-8 border-t border-slate-200/80 pt-6 dark:border-white/10">
            <h2 className="text-xl font-semibold text-brand-navy dark:text-brand-parchment">School progress context</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">
              Formal assessment scores from homework and school tests, shown alongside the diagnostic progress above.
            </p>
            <SubjectFilterChips subjects={subjects} activeSubject={activeSubject} onSelect={setActiveSubject} />
            <TopicProgressList progress={filteredProgress} />
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

export function filterProgressBySubject(progress: StudentProgress[], activeSubject: string) {
  return activeSubject === 'All subjects' ? progress : progress.filter((item) => (item.subject || 'General') === activeSubject);
}

export function SubjectFilterChips({
  subjects,
  activeSubject,
  onSelect,
}: {
  subjects: string[];
  activeSubject: string;
  onSelect: (subject: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter school progress by subject">
      {['All subjects', ...subjects].map((subject) => {
        const isActive = activeSubject === subject;
        return (
          <button
            key={subject}
            type="button"
            aria-pressed={isActive}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              isActive
                ? 'bg-brand-navy text-white shadow-sm dark:bg-brand-gold dark:text-brand-navy'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            onClick={() => onSelect(subject)}
          >
            {subject}
          </button>
        );
      })}
    </div>
  );
}

export function TopicProgressList({ progress }: { progress: StudentProgress[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {progress.map((item) => (
        <TopicProgressRow key={item.id} progress={item} />
      ))}
    </div>
  );
}

export function TopicProgressRow({ progress }: { progress: StudentProgress }) {
  const score = Math.max(0, Math.min(100, progress.score ?? 0));
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex justify-between gap-3">
        <div>
          <h3 className="font-semibold text-brand-navy dark:text-brand-parchment">{progress.topic}</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-brand-marble">
            {progress.cognitive_level || 'General learning context'} · {formatDate(progress.recorded_at)}
          </p>
        </div>
        <span className="text-sm font-semibold text-brand-navy dark:text-brand-gold">{score}%</span>
      </div>
      <AnimatedProgressBar value={score} className="mt-3 bg-slate-200 dark:bg-white/10" />
    </article>
  );
}
