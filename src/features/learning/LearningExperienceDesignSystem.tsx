import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Lightbulb, Play, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

type NextStepProps = {
  title: string;
  description: string;
  to: string;
  label?: string;
  detail?: string;
};

/** One calm, consistent action surface for the learner's next useful step. */
export function PrimaryNextStep({ title, description, to, label = 'Continue learning', detail }: NextStepProps) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-brand-gold/30 bg-brand-navy p-5 text-brand-parchment sm:p-7" aria-labelledby="learning-next-step">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Your next step</p>
      <h2 id="learning-next-step" className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl leading-7 text-brand-marble">{description}</p>
      {detail ? <p className="mt-3 text-sm leading-6 text-brand-marble">{detail}</p> : null}
      <Link className="academy-btn-primary mt-5 inline-flex min-h-12 items-center gap-2 rounded-full px-5" to={to}>
        {label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function LearningProgressHeader({
  eyebrow = 'Practice',
  label,
  current,
  total,
  trailing,
}: {
  eyebrow?: string;
  label: string;
  current: number;
  total: number;
  trailing?: ReactNode;
}) {
  const progress = total ? Math.round((current / total) * 100) : 0;
  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-aegean dark:text-brand-gold">{eyebrow}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-brand-navy dark:text-brand-parchment">{label}</p>
        </div>
        {trailing ?? <span className="shrink-0 text-sm font-semibold text-brand-navy dark:text-brand-parchment">{current} / {total}</span>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-label={`${current} of ${total} complete`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
        <div className="h-full rounded-full bg-brand-aegean transition-[width] duration-200 motion-reduce:transition-none dark:bg-brand-gold" style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

export function FocusedLessonSection({ title, icon, children, tone = 'plain' }: { title: string; icon?: ReactNode; children: ReactNode; tone?: 'plain' | 'gold' | 'quiet' }) {
  const toneClass = tone === 'gold'
    ? 'border-brand-gold/35 bg-brand-gold/10'
    : tone === 'quiet'
      ? 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40'
      : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900';
  return (
    <section className={`rounded-3xl border p-5 sm:p-7 ${toneClass}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-navy dark:text-brand-parchment">
        {icon} {title}
      </h2>
      <div className="mt-3 text-slate-700 dark:text-slate-200">{children}</div>
    </section>
  );
}

export function WorkedExample({ children }: { children: ReactNode }) {
  return (
    <FocusedLessonSection title="See an example" icon={<Lightbulb className="h-5 w-5 text-brand-gold" aria-hidden="true" />} tone="gold">
      <div className="whitespace-pre-line font-mono text-sm leading-7 text-slate-800 dark:text-brand-parchment">{children}</div>
    </FocusedLessonSection>
  );
}

export function PracticeQuestionFrame({
  children,
  questionNumber,
  totalQuestions,
  stageLabel,
  questionId,
  activityCode,
  state,
}: {
  children: ReactNode;
  questionNumber: number;
  totalQuestions: number;
  stageLabel: string;
  questionId: string;
  activityCode: string;
  state: 'question' | 'feedback';
}) {
  return (
    <main className="mx-auto max-w-3xl" data-testid="practice-question-frame">
      <LearningProgressHeader eyebrow="Practice" label={stageLabel} current={questionNumber} total={totalQuestions} />
      <section
        className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-8"
        data-activity-code={activityCode}
        data-question-id={questionId}
        data-state={state}
        data-testid="activity-state"
      >
        {children}
      </section>
    </main>
  );
}

export function PracticeFeedback({
  correct,
  title,
  children,
  action,
}: {
  correct: boolean;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  const classes = correct
    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100'
    : 'border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100';
  return (
    <section className={`mt-6 rounded-2xl border p-5 ${classes}`} aria-live="polite">
      <div className="flex gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${correct ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
          {correct ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0"><h3 className="font-semibold">{title}</h3><div className="mt-1 text-sm leading-6">{children}</div></div>
      </div>
      <div className="mt-5 flex justify-end">{action}</div>
    </section>
  );
}

export function AssessmentNavigation({
  current,
  total,
  remaining,
}: {
  current: number;
  total: number;
  remaining: string;
}) {
  return (
    <LearningProgressHeader
      eyebrow="Independent assessment"
      label={`Question ${current} of ${total}`}
      current={current}
      total={total}
      trailing={<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-aegean/10 px-3 py-1.5 font-mono text-sm font-bold text-brand-aegean dark:bg-brand-gold/10 dark:text-brand-gold"><Clock3 className="h-4 w-4" aria-hidden="true" />{remaining}</span>}
    />
  );
}

export function LearnerResultSummary({
  label,
  title,
  message,
  score,
  strongest,
  buildNext,
}: {
  label: string;
  title: string;
  message: string;
  score: string;
  strongest?: string | null;
  buildNext?: string | null;
}) {
  return (
    <section className="rounded-[1.75rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold text-white">{score}</p>
      <h2 className="mt-3 text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl leading-7 text-brand-marble">{message}</p>
      {(strongest || buildNext) ? <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {strongest ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-brand-gold">Strongest demonstrated skill</dt><dd className="mt-1 font-semibold text-white">{strongest}</dd></div> : null}
        {buildNext ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-brand-gold">Build next</dt><dd className="mt-1 font-semibold text-white">{buildNext}</dd></div> : null}
      </dl> : null}
    </section>
  );
}

export function LessonStartLink({ to, label = 'Try it yourself' }: { to: string; label?: string }) {
  return <Link className="academy-btn-primary inline-flex min-h-12 items-center gap-2 rounded-full px-5" to={to}><Play className="h-4 w-4" aria-hidden="true" />{label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
}
