import {
  ArrowRight,
  Brain,
  CheckCircle2,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import {
  AnimatedProgressBar,
  EmptyState,
  ErrorState,
  GreekHeroCard,
  PageShell,
  SkeletonCard,
} from '../../components/dashboard/DashboardDesignSystem';

import { useAvailableLearningDiagnostics, useDueRetentionStep, useLearnerMasterySummary, useNextLearningStep } from './studentLearningQueries';

export function StudentLearningRoute() {
  const diagnosticsQuery =
    useAvailableLearningDiagnostics();
  const nextStepQuery = useNextLearningStep();
  const retentionQuery = useDueRetentionStep();
  const masteryQuery = useLearnerMasterySummary();

  if (diagnosticsQuery.isPending || nextStepQuery.isPending || retentionQuery.isPending || masteryQuery.isPending) {
    return (
      <PageShell
        title="Learning"
        subtitle="Focused practice built around your current learning."
        section="student"
      >
        <SkeletonCard className="min-h-52" />
        <SkeletonCard />
      </PageShell>
    );
  }

  if (diagnosticsQuery.isError || nextStepQuery.isError || retentionQuery.isError || masteryQuery.isError) {
    return (
      <PageShell
        title="Learning"
        subtitle="Focused practice built around your current learning."
        section="student"
      >
        <ErrorState
          title="Learning could not be loaded"
          description="Check your connection and try again."
          onRetry={() => {
            void diagnosticsQuery.refetch();
            void nextStepQuery.refetch();
            void retentionQuery.refetch();
            void masteryQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  const diagnostics =
    diagnosticsQuery.data ?? [];
  const dueRetention = retentionQuery.data;
  // A due retrieval takes precedence, and the section below is guarded.
  const nextStep = dueRetention ?? nextStepQuery.data!;
  const mastery = masteryQuery.data ?? [];

  return (
    <PageShell
      title="Learning"
      subtitle="Short diagnostic and practice activities help your tutor understand what to work on next."
      section="student"
    >
      {(dueRetention ?? nextStep) ? (
        <section className="rounded-[2rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment shadow-xl sm:p-8" aria-labelledby="next-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Your next step</p>
          <h2 id="next-step-title" className="mt-3 text-2xl font-semibold">{dueRetention?.name ?? nextStep?.name}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-brand-marble">{dueRetention?.learnerReason ?? nextStep?.learnerReason}</p>
          <p className="mt-3 text-sm text-brand-marble">About {nextStep.estimatedMinutes} minutes · {nextStep.targetSkillName}</p>
          <Link className="academy-btn-primary mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5" to={`/dashboard/student/learning/activity/${encodeURIComponent((dueRetention ?? nextStep)!.activityCode)}${dueRetention ? `?retentionCheck=${encodeURIComponent(dueRetention.retentionCheckId)}` : ''}`}>{dueRetention ? 'Start quick review' : 'Start practice'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      ) : null}
      <GreekHeroCard
        eyebrow="Evidence-driven learning"
        title="Learn one step at a time."
        description="Complete short checks, use hints when you need them, and let your tutor use the evidence to plan what comes next."
      >
        <div className="flex flex-wrap gap-3 text-sm text-brand-parchment">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            No grades are shown here
          </span>

          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            Hints are always optional
          </span>

          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
            Your tutor reviews the evidence
          </span>
        </div>
      </GreekHeroCard>

      {mastery.length ? <section aria-labelledby="skills-heading"><h2 id="skills-heading" className="text-xl font-semibold">Current learning progress</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{mastery.map((item) => <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900" key={item.skillCode}><span className="font-medium">{item.skillName}</span><span className="rounded-full bg-brand-aegean/10 px-3 py-1 text-sm capitalize text-brand-aegean">{item.state}</span></article>)}</div></section> : null}

      {diagnostics.length   === 0 ? (
        <EmptyState
          icon={Brain}
          title="Nothing ready yet"
          description="Your learning activities will appear here after they have been reviewed and approved."
        />
      ) : (
        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label="Available learning activities"
        >
          {diagnostics.map((diagnostic) => {
            const progress =
              diagnostic.totalQuestions > 0
                ? (
                    diagnostic.completedQuestions /
                    diagnostic.totalQuestions
                  ) * 100
                : 0;

            return (
              <article
                key={diagnostic.code}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">
                      Diagnostic
                    </p>

                    <h2 className="mt-2 text-xl font-semibold text-brand-navy dark:text-brand-parchment">
                      {diagnostic.name}
                    </h2>
                  </div>

                  {diagnostic.complete ? (
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      aria-label="Completed"
                    >
                      <CheckCircle2
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </span>
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-aegean/10 text-brand-aegean">
                      <Brain
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-brand-marble">
                  {diagnostic.description}
                </p>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-brand-navy dark:text-brand-parchment">
                      Progress
                    </span>

                    <span className="text-slate-500 dark:text-brand-marble">
                      {diagnostic.completedQuestions}
                      {' / '}
                      {diagnostic.totalQuestions}
                    </span>
                  </div>

                  <AnimatedProgressBar
                    value={progress}
                  />
                </div>

                <Link
                  className="academy-btn-primary mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5"
                  to={`/dashboard/student/learning/diagnostic/${encodeURIComponent(
                    diagnostic.code,
                  )}`}
                >
                  {diagnostic.complete
                    ? 'Review completion'
                    : diagnostic.started
                      ? 'Continue'
                      : 'Start'}

                  <ArrowRight
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </PageShell>
  );
}
