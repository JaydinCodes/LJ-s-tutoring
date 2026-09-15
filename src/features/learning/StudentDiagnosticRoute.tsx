import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  AnimatedProgressBar,
  EmptyState,
  ErrorState,
  PageShell,
  PremiumButton,
  SkeletonCard,
} from '../../components/dashboard/DashboardDesignSystem';

import {
  useDiagnosticProgress,
  useLearnerQuestion,
  useSubmitLearningAttemptMutation,
} from './studentLearningQueries';

import type {
  LearnerConfidence,
} from './studentLearningRepository';

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function StudentDiagnosticRoute() {
  const params = useParams();

  const diagnosticCode =
    params.diagnosticCode ?? '';

  const progressQuery =
    useDiagnosticProgress(diagnosticCode);

  const progressItems =
    progressQuery.data ?? [];

  const firstIncompleteIndex =
    progressItems.findIndex(
      (item) => !item.attemptId,
    );

  const isComplete =
    progressItems.length > 0 &&
    firstIncompleteIndex === -1;

  const currentIndex =
    firstIncompleteIndex >= 0
      ? firstIncompleteIndex
      : progressItems.length;

  const currentItem =
    firstIncompleteIndex >= 0
      ? progressItems[firstIncompleteIndex]
      : null;

  const currentQuestionId =
    currentItem?.questionVersionId ?? null;

  const questionQuery =
    useLearnerQuestion(currentQuestionId);

  const submitMutation =
    useSubmitLearningAttemptMutation(
      diagnosticCode,
    );

  const [answer, setAnswer] =
    useState('');

  const [
    confidence,
    setConfidence,
  ] = useState<LearnerConfidence | null>(
    null,
  );

  const [
    openedHintIds,
    setOpenedHintIds,
  ] = useState<string[]>([]);

  const [
    pendingSubmissionKey,
    setPendingSubmissionKey,
  ] = useState<string | null>(null);

  const [
    uncertainSubmission,
    setUncertainSubmission,
  ] = useState(false);

  const [
    submissionMessage,
    setSubmissionMessage,
  ] = useState<string | null>(null);

  const questionStartedAt =
    useRef(Date.now());

  useEffect(() => {
    setAnswer('');
    setConfidence(null);
    setOpenedHintIds([]);
    setPendingSubmissionKey(null);
    setUncertainSubmission(false);
    setSubmissionMessage(null);

    questionStartedAt.current =
      Date.now();
  }, [currentQuestionId]);

  const question =
    questionQuery.data ?? null;

  const sortedHints = useMemo(
    () =>
      [...(question?.hints ?? [])].sort(
        (left, right) =>
          left.level - right.level,
      ),
    [question?.hints],
  );

  const visibleHints = sortedHints.filter(
    (hint) =>
      openedHintIds.includes(hint.id),
  );

  const nextHint = sortedHints.find(
    (hint) =>
      !openedHintIds.includes(hint.id),
  );

  const completedCount =
    progressItems.filter(
      (item) => Boolean(item.attemptId),
    ).length;

  const progressPercent =
    progressItems.length > 0
      ? (
          completedCount /
          progressItems.length
        ) * 100
      : 0;

  async function handleSubmit() {
    if (
      !currentItem ||
      !question ||
      !answer.trim() ||
      submitMutation.isPending
    ) {
      return;
    }

    const key =
      pendingSubmissionKey ??
      crypto.randomUUID();

    setPendingSubmissionKey(key);
    setSubmissionMessage(null);

    const timeSpentSeconds =
      Math.max(
        0,
        Math.round(
          (
            Date.now() -
            questionStartedAt.current
          ) / 1000,
        ),
      );

    try {
      await submitMutation.mutateAsync({
        diagnosticCode,
        questionVersionId:
          currentItem.questionVersionId,
        answer,
        confidence,
        timeSpentSeconds,
        idempotencyKey: key,
        hintIds: openedHintIds,
      });

      setPendingSubmissionKey(null);
      setUncertainSubmission(false);

      await progressQuery.refetch();
    } catch (error) {
      // A network response can be lost after the server has already
      // committed the attempt. Before allowing a different logical
      // submission, verify current state.
      try {
        const refreshed =
          await progressQuery.refetch();

        const persisted =
          refreshed.data?.some(
            (item) =>
              item.questionVersionId ===
                currentItem.questionVersionId &&
              Boolean(item.attemptId),
          );

        if (persisted) {
          setPendingSubmissionKey(null);
          setUncertainSubmission(false);

          return;
        }

        // We successfully confirmed that no attempt exists.
        // The learner may edit and try a fresh logical submission.
        setPendingSubmissionKey(null);
        setUncertainSubmission(false);

        setSubmissionMessage(
          errorMessage(error),
        );
      } catch {
        // We do not know whether the first request committed.
        // Keep the same idempotency key and freeze the response so a retry
        // cannot create a second logical attempt with different content.
        setUncertainSubmission(true);

        setSubmissionMessage(
          'We could not confirm whether your answer was saved. Keep this answer unchanged and press Retry.',
        );
      }
    }
  }

  function handleOpenNextHint() {
    if (
      !nextHint ||
      uncertainSubmission
    ) {
      return;
    }

    setOpenedHintIds((current) => [
      ...current,
      nextHint.id,
    ]);
  }

  if (!diagnosticCode) {
    return (
      <PageShell
        title="Learning"
        subtitle="Diagnostic activity"
        section="student"
      >
        <ErrorState
          title="Diagnostic not found"
          description="The learning activity link is invalid."
        />
      </PageShell>
    );
  }

  if (progressQuery.isPending) {
    return (
      <PageShell
        title="Diagnostic"
        subtitle="Work through one question at a time."
        section="student"
      >
        <SkeletonCard className="min-h-20" />
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  }

  if (progressQuery.isError) {
    return (
      <PageShell
        title="Diagnostic"
        subtitle="Work through one question at a time."
        section="student"
      >
        <ErrorState
          title="Diagnostic could not be loaded"
          description="Check your connection and try again."
          onRetry={() => {
            void progressQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  if (progressItems.length === 0) {
    return (
      <PageShell
        title="Diagnostic"
        subtitle="Work through one question at a time."
        section="student"
      >
        <EmptyState
          title="This activity is not available"
          description="It may still be under review or may have been temporarily withdrawn."
          actionHref="/dashboard/student/learning"
          actionLabel="Back to learning"
        />
      </PageShell>
    );
  }

  if (isComplete) {
    return (
      <PageShell
        title="Diagnostic complete"
        subtitle="Your responses have been saved."
        section="student"
      >
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900 sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2
              className="h-8 w-8"
              aria-hidden="true"
            />
          </span>

          <h2 className="mt-5 text-2xl font-semibold text-brand-navy dark:text-brand-parchment">
            You’re done.
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-brand-marble">
            Your responses are saved. Your tutor can use the evidence to decide what support or practice should come next.
          </p>

          <Link
            className="academy-btn-primary mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5"
            to="/dashboard/student/learning"
          >
            Back to learning
          </Link>
        </section>
      </PageShell>
    );
  }

  if (
    questionQuery.isPending ||
    !question
  ) {
    return (
      <PageShell
        title="Diagnostic"
        subtitle={`Question ${
          currentIndex + 1
        } of ${progressItems.length}`}
        section="student"
      >
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  }

  if (questionQuery.isError) {
    return (
      <PageShell
        title="Diagnostic"
        subtitle={`Question ${
          currentIndex + 1
        } of ${progressItems.length}`}
        section="student"
      >
        <ErrorState
          title="Question could not be loaded"
          description="This question may no longer be available."
          onRetry={() => {
            void questionQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Diagnostic"
      subtitle={`Question ${
        currentIndex + 1
      } of ${progressItems.length}`}
      section="student"
    >
      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-brand-navy dark:text-brand-parchment">
            {completedCount} completed
          </span>

          <span className="text-slate-500 dark:text-brand-marble">
            {progressItems.length} questions
          </span>
        </div>

        <div className="mt-3">
          <AnimatedProgressBar
            value={progressPercent}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">
            Question {currentIndex + 1}
          </p>

          <p className="text-sm text-slate-500 dark:text-brand-marble">
            {question.marks}{' '}
            {question.marks === 1
              ? 'mark'
              : 'marks'}
          </p>
        </div>

        <h2 className="mt-5 whitespace-pre-wrap text-xl font-semibold leading-8 text-brand-navy dark:text-brand-parchment sm:text-2xl">
          {question.prompt}
        </h2>

        <div className="mt-7">
          <label
            className="block text-sm font-semibold text-brand-navy dark:text-brand-parchment"
            htmlFor="learning-answer"
          >
            Your answer
          </label>

          <textarea
            id="learning-answer"
            value={answer}
            disabled={uncertainSubmission}
            onChange={(event) =>
              setAnswer(
                event.target.value,
              )
            }
            rows={4}
            className="mt-2 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-brand-obsidian outline-none transition focus:border-brand-aegean focus:ring-4 focus:ring-brand-aegean/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-slate-950 dark:text-brand-parchment"
            placeholder="Write your answer here"
          />
        </div>

        {sortedHints.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-brand-gold/20 bg-brand-gold/[0.06] p-4">
            <div className="flex items-center gap-2">
              <Lightbulb
                className="h-5 w-5 text-[#9a6a05] dark:text-brand-gold"
                aria-hidden="true"
              />

              <h3 className="font-semibold text-brand-navy dark:text-brand-parchment">
                Need a hint?
              </h3>
            </div>

            {visibleHints.length > 0 ? (
              <div className="mt-4 space-y-3">
                {visibleHints.map(
                  (hint) => (
                    <div
                      key={hint.id}
                      className="rounded-xl bg-white/80 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950/50 dark:text-brand-marble"
                    >
                      <span className="mr-2 font-semibold">
                        Hint {hint.level}:
                      </span>

                      {hint.prompt}
                    </div>
                  ),
                )}
              </div>
            ) : null}

            {nextHint ? (
              <button
                type="button"
                disabled={
                  uncertainSubmission
                }
                onClick={
                  handleOpenNextHint
                }
                className="mt-4 min-h-11 rounded-full border border-brand-gold/40 px-4 py-2 text-sm font-semibold text-[#805d08] transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-gold"
              >
                {visibleHints.length === 0
                  ? 'Show a hint'
                  : 'Show next hint'}
              </button>
            ) : visibleHints.length > 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-brand-marble">
                All available hints are open.
              </p>
            ) : null}
          </div>
        ) : null}

        <fieldset
          className="mt-7"
          disabled={uncertainSubmission}
        >
          <legend className="text-sm font-semibold text-brand-navy dark:text-brand-parchment">
            How confident are you?
          </legend>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-brand-marble">
            This helps your tutor understand how the question felt. It does not change whether your answer is correct.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                [1, 'Not sure'],
                [2, 'A little sure'],
                [3, 'Quite sure'],
                [4, 'Very sure'],
              ] as const
            ).map(
              ([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium transition ${
                    confidence === value
                      ? 'border-brand-aegean bg-brand-aegean/10 text-brand-navy dark:text-brand-parchment'
                      : 'border-slate-200 text-slate-600 hover:border-brand-aegean/50 dark:border-white/10 dark:text-brand-marble'
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="confidence"
                    value={value}
                    checked={
                      confidence ===
                      value
                    }
                    onChange={() =>
                      setConfidence(
                        value,
                      )
                    }
                  />

                  {label}
                </label>
              ),
            )}
          </div>
        </fieldset>

        {submissionMessage ? (
          <div
            className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
            role="alert"
          >
            {submissionMessage}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-navy dark:border-white/15 dark:text-brand-parchment"
            to="/dashboard/student/learning"
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />

            Exit
          </Link>

          <PremiumButton
            type="button"
            disabled={
              !answer.trim() ||
              submitMutation.isPending
            }
            onClick={() => {
              void handleSubmit();
            }}
          >
            {submitMutation.isPending
              ? 'Saving…'
              : uncertainSubmission
                ? 'Retry'
                : 'Save & continue'}
          </PremiumButton>
        </div>
      </section>
    </PageShell>
  );
}