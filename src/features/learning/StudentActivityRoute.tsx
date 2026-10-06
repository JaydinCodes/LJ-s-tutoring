import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  AnimatedProgressBar,
  EmptyState,
  ErrorState,
  PageShell,
  PremiumButton,
  SkeletonCard,
} from '../../components/dashboard/DashboardDesignSystem';
import {
  useActivityProgress,
  useLearnerActivity,
  useLearnerQuestion,
  useSubmitLearningAttemptMutation,
} from './studentLearningQueries';
import {
  completeLearnerActivity,
  completeLearnerRetentionCheck,
  type LearnerConfidence,
} from './studentLearningRepository';
import {
  getConfidenceFeedback,
  getMisconceptionExplanation,
  type MisconceptionDetail,
} from './misconceptionExplanations';
import { QuestionResponseInput } from './QuestionResponseInput';

interface QuestionFeedbackState {
  questionId: string;
  learnerAnswer: string;
  confidence: LearnerConfidence | null;
  status: 'correct' | 'incorrect' | 'needs_review';
  marksAwarded: number | null;
  marksAvailable: number;
  misconception?: MisconceptionDetail | null;
  explanationCode?: string;
}

export function StudentActivityRoute() {
  const activityCode = useParams().activityCode ?? '';
  const [searchParams] = useSearchParams();
  const retentionCheckId = searchParams.get('retentionCheck');

  const activityQuery = useLearnerActivity(activityCode);
  const progressQuery = useActivityProgress(activityCode);
  const progress = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const current = progress.find((item) => !item.attemptId) ?? null;
  const questionQuery = useLearnerQuestion(current?.questionVersionId ?? null);
  const submit = useSubmitLearningAttemptMutation('', activityCode);

  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<LearnerConfidence | null>(null);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<QuestionFeedbackState | null>(null);
  const [sessionResults, setSessionResults] = useState<QuestionFeedbackState[]>([]);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setAnswer('');
    setConfidence(null);
    setHintIds([]);
    setSubmissionKey(null);
    setActiveFeedback(null);
    startedAt.current = Date.now();
  }, [current?.questionVersionId]);

  useEffect(() => {
    if (activityCode && progress.length > 0 && progress.every((item) => item.attemptId)) {
      void (async () => {
        await completeLearnerActivity(activityCode);
        if (retentionCheckId) await completeLearnerRetentionCheck(retentionCheckId, activityCode);
      })();
    }
  }, [activityCode, progress, retentionCheckId]);

  if (activityQuery.isPending || progressQuery.isPending) {
    return (
      <PageShell title="Practice" subtitle="Preparing your next step." section="student">
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  }

  if (activityQuery.isError || progressQuery.isError) {
    return (
      <PageShell title="Practice" subtitle="Your next learning step." section="student">
        <ErrorState
          title="Activity could not be loaded"
          description="Check your connection and try again."
          onRetry={() => {
            void activityQuery.refetch();
            void progressQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  const activity = activityQuery.data;
  if (!activity) {
    return (
      <PageShell title="Practice" subtitle="Your next learning step." section="student">
        <EmptyState
          title="Activity unavailable"
          description="This activity may still be under review."
        />
      </PageShell>
    );
  }

  // Activity Completion View
  if (!current) {
    const totalQuestions = progress.length;
    const correctCount = sessionResults.filter((r) => r.status === 'correct').length;
    const reviewedMisconceptions = sessionResults.flatMap((r) => (r.misconception ? [r.misconception] : []));

    return (
      <PageShell title="Activity complete" subtitle={activity.name} section="student">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-brand-gold/30 bg-brand-navy p-8 text-brand-parchment shadow-xl sm:p-10">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
                <Trophy className="h-4 w-4" aria-hidden="true" /> Practice session recorded
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
                Great effort on {activity.name}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-brand-marble">
                Your answers and confidence evidence have been saved. Your progress and recommended next actions are updated.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-2xl font-bold text-white">{totalQuestions}</p>
                  <p className="mt-1 text-xs text-brand-marble">Questions completed</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    Completed
                  </p>
                  <p className="mt-1 text-xs text-brand-marble">Activity status</p>
                </div>
              </div>
            </div>
          </section>

          {reviewedMisconceptions.length > 0 ? (
            <section aria-labelledby="reinforced-heading" className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 sm:p-8">
              <h3 id="reinforced-heading" className="flex items-center gap-2 text-lg font-semibold text-brand-navy dark:text-brand-parchment">
                <Sparkles className="h-5 w-5 text-brand-aegean dark:text-brand-gold" />
                Concepts addressed in this session
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">
                Reviewing these patterns now prevents small misconceptions from compounding in later topics.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {reviewedMisconceptions.map((misconception, idx) => (
                  <div key={`${misconception.code}-${idx}`} className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{misconception.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">{misconception.guidance}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="text-lg font-semibold text-brand-navy dark:text-brand-parchment">What would you like to do next?</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Check how your skill mastery levels shifted or return to your today dashboard.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="academy-btn-primary inline-flex min-h-12 items-center gap-2 rounded-full px-6" to="/dashboard/student/progress">
                View updated progress <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-brand-marble dark:hover:bg-slate-800" to="/dashboard/student">
                Back to dashboard
              </Link>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  const question = questionQuery.data;
  if (!question) {
    return (
      <PageShell title={activity.name} subtitle={current.stageInstruction} section="student">
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  }

  const availableHint = question.hints.find((hint) => !hintIds.includes(hint.id));
  const completed = progress.filter((item) => item.attemptId).length;
  const progressPercent = progress.length > 0 ? (completed / progress.length) * 100 : 0;

  async function submitAnswer() {
    if (!question || !answer.trim() || submit.isPending) return;
    const key = submissionKey ?? crypto.randomUUID();
    setSubmissionKey(key);

    try {
      const result = await submit.mutateAsync({
        activityCode,
        questionVersionId: question.id,
        answer,
        confidence,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
        idempotencyKey: key,
        hintIds,
      });

      const evalData = result.evaluation;
      const status = evalData?.status ?? 'correct';
      const marksAwarded = evalData?.marksAwarded ?? (status === 'correct' ? question.marks : 0);
      const marksAvailable = evalData?.marksAvailable ?? question.marks;
      const topMatch = evalData?.misconceptionMatches?.[0];
      const misconceptionDetail = topMatch?.code ? getMisconceptionExplanation(topMatch.code) : null;

      const feedbackItem: QuestionFeedbackState = {
        questionId: question.id,
        learnerAnswer: answer,
        confidence,
        status,
        marksAwarded,
        marksAvailable,
        misconception: misconceptionDetail,
        explanationCode: evalData?.explanationCode,
      };

      setActiveFeedback(feedbackItem);
      setSessionResults((prev) => [...prev, feedbackItem]);
      setSubmissionKey(null);
    } catch {
      // In error state, keep submission key so retry is idempotent
    }
  }

  function handleTryAgain() {
    setActiveFeedback(null);
    // Keep current answer in the textarea so learner can tweak it
  }

  async function handleContinue() {
    setActiveFeedback(null);
    await progressQuery.refetch();
  }

  return (
    <PageShell title={activity.name} subtitle={current.stageInstruction} section="student">
      <div className="space-y-6">
        {/* Progress Bar Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-aegean dark:text-brand-gold">
            <span>{current.stageType.replaceAll('_', ' ')}</span>
            <span>Question {completed + 1} of {progress.length}</span>
          </div>
          <div className="mt-2.5">
            <AnimatedProgressBar value={progressPercent} />
          </div>
        </div>

        {/* Main Question / Evaluation Card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-aegean">
                Step {completed + 1} · {question.marks} mark{question.marks === 1 ? '' : 's'}
              </p>
              <h2 className="mt-3 whitespace-pre-wrap font-display text-xl font-semibold leading-8 text-brand-navy dark:text-brand-parchment sm:text-2xl">
                {question.prompt}
              </h2>
            </div>
          </div>

          {/* EVALUATION & FEEDBACK STATE */}
          {activeFeedback ? (
            <div className="mt-6 space-y-5" aria-live="polite">
              {(() => {
                const isCorrect = activeFeedback.status === 'correct';
                const misconception = activeFeedback.misconception;
                const confidenceInsight = getConfidenceFeedback(isCorrect, activeFeedback.confidence, !!misconception);

                if (isCorrect) {
                  return (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-800/40 dark:bg-emerald-950/30">
                      <div className="flex items-start gap-4">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            {confidenceInsight.badge}
                          </span>
                          <h3 className="mt-2 font-display text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                            {confidenceInsight.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                            {confidenceInsight.message}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Marks awarded: {activeFeedback.marksAwarded ?? activeFeedback.marksAvailable} / {activeFeedback.marksAvailable}
                          </p>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <PremiumButton onClick={() => void handleContinue()}>
                          Continue to next step <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                        </PremiumButton>
                      </div>
                    </div>
                  );
                }

                // Misconception or Incorrect state
                return (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-6 dark:border-amber-800/60 dark:bg-amber-950/30">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-500 text-white dark:bg-amber-600">
                        {misconception ? (
                          <Sparkles className="h-6 w-6" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="h-6 w-6" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="inline-block rounded-full bg-amber-200/80 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                          {confidenceInsight.badge}
                        </span>
                        <h3 className="mt-2 font-display text-xl font-semibold text-amber-950 dark:text-amber-100">
                          {misconception ? misconception.title : confidenceInsight.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-200">
                          {confidenceInsight.message}
                        </p>

                        {misconception ? (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/80">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              Why this happens:
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                              {misconception.explanation}
                            </p>
                            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              How to solve it:
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                              {misconception.guidance}
                            </p>
                            {misconception.example ? (
                              <div className="mt-3 rounded-lg bg-amber-100/50 p-2.5 font-mono text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                Example: {misconception.example}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <p className="mt-4 text-xs text-amber-800 dark:text-amber-300">
                          Your submitted answer: <span className="font-mono font-bold">{activeFeedback.learnerAnswer}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/60 pt-4 dark:border-amber-900/40">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800"
                        onClick={handleTryAgain}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Try again with this insight
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent px-5 text-sm font-semibold text-slate-600 transition hover:text-slate-900 dark:text-brand-marble dark:hover:text-white"
                        onClick={() => void handleContinue()}
                      >
                        Continue anyway <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ANSWER INPUT STATE */
            <div className="mt-7">
              <label className="block text-sm font-semibold text-brand-navy dark:text-brand-parchment" htmlFor="activity-answer">
                Your answer
              </label>
              <QuestionResponseInput
                questionType={question.questionType}
                options={question.options}
                value={answer}
                onChange={setAnswer}
                disabled={submit.isPending}
              />

              {hintIds.map((id) => {
                const hintObj = question.hints.find((hint) => hint.id === id);
                return (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" key={id}>
                    <Lightbulb className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Hint {hintObj?.level ?? ''}</p>
                      <p className="mt-0.5 leading-6">{hintObj?.prompt}</p>
                    </div>
                  </div>
                );
              })}

              {availableHint ? (
                <button
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-brand-marble dark:hover:bg-slate-700"
                  type="button"
                  onClick={() => setHintIds((ids) => [...ids, availableHint.id])}
                >
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Show a hint
                </button>
              ) : null}

              <fieldset className="mt-7 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-slate-950/50">
                <legend className="px-1 text-sm font-semibold text-brand-navy dark:text-brand-parchment">
                  How confident are you in this answer?
                </legend>
                <p className="mt-1 px-1 text-xs leading-5 text-slate-500 dark:text-brand-marble">
                  This helps tailor feedback and helps your tutor understand how the question felt.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      [1, 'Not sure'],
                      [2, 'A little sure'],
                      [3, 'Quite sure'],
                      [4, 'Very sure'],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium transition ${
                        confidence === value
                          ? 'border-brand-aegean bg-brand-aegean/10 font-semibold text-brand-navy shadow-sm dark:border-brand-gold dark:bg-brand-gold/15 dark:text-brand-parchment'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-aegean/50 dark:border-white/10 dark:bg-slate-900 dark:text-brand-marble'
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="activity-confidence"
                        value={value}
                        checked={confidence === value}
                        onChange={() => setConfidence(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {submit.isError ? (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  Your answer could not be saved. Check your connection and retry.
                </p>
              ) : null}

              <div className="mt-7 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-brand-marble">
                  Press Check answer to evaluate with instant diagnostic feedback
                </span>
                <PremiumButton
                  disabled={!answer.trim() || submit.isPending}
                  onClick={() => {
                    void submitAnswer();
                  }}
                >
                  {submit.isPending ? 'Checking answer…' : 'Check answer'}
                </PremiumButton>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
