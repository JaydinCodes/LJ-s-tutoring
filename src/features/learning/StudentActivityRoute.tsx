import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Lightbulb, RotateCcw } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { PracticeFeedback, PracticeQuestionFrame } from './LearningExperienceDesignSystem';
import { getConfidenceFeedback, getMisconceptionExplanation, type MisconceptionDetail } from './misconceptionExplanations';
import { QuestionResponseInput } from './QuestionResponseInput';
import { type LearnerConfidence } from './studentLearningRepository';
import { useActivityProgress, useCompleteLearningActivityMutation, useLearnerActivity, useLearnerQuestion, useSubmitLearningAttemptMutation } from './studentLearningQueries';

interface QuestionFeedbackState {
  questionId: string;
  learnerAnswer: string;
  confidence: LearnerConfidence | null;
  status: 'correct' | 'incorrect' | 'needs_review';
  marksAwarded: number | null;
  marksAvailable: number;
  misconception?: MisconceptionDetail | null;
  distractorExplanation?: string | null;
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
  const completion = useCompleteLearningActivityMutation();
  const { mutate: complete, variables: completionContext, isPending: completionPending } = completion;

  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<LearnerConfidence | null>(null);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<QuestionFeedbackState | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setAnswer(''); setConfidence(null); setHintIds([]); setSubmissionKey(null); setActiveFeedback(null); setSubmissionMessage(null); startedAt.current = Date.now();
  }, [current?.questionVersionId]);

  useEffect(() => {
    if (activityQuery.isSuccess && progressQuery.isSuccess && activityCode && progress.length > 0 && progress.every((item) => item.attemptId) && !completionPending && (completionContext?.activityCode !== activityCode || completionContext.retentionCheckId !== retentionCheckId)) {
      complete({ activityCode, retentionCheckId });
    }
  }, [activityCode, activityQuery.isSuccess, progressQuery.isSuccess, progress, retentionCheckId, complete, completionContext, completionPending]);

  if (activityQuery.isPending || progressQuery.isPending) return <PageShell title="Practice" subtitle="Preparing your next question." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (activityQuery.isError || progressQuery.isError) return <PageShell title="Practice" subtitle="Your next learning step." section="student"><ErrorState title="Practice could not be loaded" description="Check your connection and try again." onRetry={() => { void activityQuery.refetch(); void progressQuery.refetch(); }} /></PageShell>;
  const activity = activityQuery.data;
  if (!activity) return <PageShell title="Practice" subtitle="Your next learning step." section="student"><EmptyState title="Practice is unavailable" description="This activity may still be under review." /></PageShell>;

  if (!current) {
    if (!progress.length) return <PageShell title="Practice unavailable" subtitle={activity.name} section="student"><EmptyState title="No reviewed questions are available" description="Return to Learning for another available step." actionLabel="Back to Learning" actionHref="/dashboard/student/learning" /></PageShell>;
    if (completionContext?.activityCode !== activityCode || completionContext.retentionCheckId !== retentionCheckId || !completion.isSuccess) return <PageShell title="Saving your practice" subtitle={activity.name} section="student">{completion.isError ? <ErrorState title="Practice completion could not be saved" description="Your answers are saved. Retry recording the completed activity before continuing." onRetry={() => complete({ activityCode, retentionCheckId })} /> : <p className="mx-auto max-w-3xl" role="status">Saving your completed practice…</p>}</PageShell>;
    return <PageShell title="Activity complete" subtitle={activity.name} section="student"><main className="mx-auto max-w-3xl" data-testid="activity-state" data-state="complete" data-activity-code={activityCode}><section className="rounded-[1.75rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Practice complete</p><h2 className="mt-3 font-display text-3xl font-semibold text-white">You completed {progress.length} question{progress.length === 1 ? '' : 's'}.</h2><p className="mt-2 max-w-xl leading-7 text-brand-marble">Your answers and confidence information are saved. Your next recommended learning step is ready.</p><Link className="academy-btn-primary mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-5" to="/dashboard/student/learning">Continue learning <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section></main></PageShell>;
  }

  const question = questionQuery.data;
  if (!question) return <PageShell title={activity.name} subtitle={current.stageInstruction} section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  // Keep a narrowed, question-local reference through the async submission.
  const currentQuestion = question;
  const completed = progress.filter((item) => item.attemptId).length;
  const availableHint = question.hints.find((hint) => !hintIds.includes(hint.id));

  async function submitAnswer() {
    if (!answer.trim() || submit.isPending) return;
    const key = submissionKey ?? crypto.randomUUID();
    setSubmissionKey(key); setSubmissionMessage(null);
    try {
      const result = await submit.mutateAsync({ activityCode, questionVersionId: currentQuestion.id, answer, confidence, timeSpentSeconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)), idempotencyKey: key, hintIds });
      const evaluation = result.evaluation;
      const status = evaluation?.status ?? 'correct';
      const match = evaluation?.misconceptionMatches?.[0];
      setActiveFeedback({ questionId: currentQuestion.id, learnerAnswer: answer, confidence, status, marksAwarded: evaluation?.marksAwarded ?? (status === 'correct' ? currentQuestion.marks : 0), marksAvailable: evaluation?.marksAvailable ?? currentQuestion.marks, misconception: match?.code ? getMisconceptionExplanation(match.code) : null, distractorExplanation: evaluation?.distractorExplanation ?? null });
      setSubmissionKey(null);
    } catch (error) {
      // The key is intentionally retained, so an uncertain request can be retried safely.
      setSubmissionMessage(error instanceof Error ? error.message : 'We could not check that answer. Please retry the same answer.');
    }
  }

  async function continueToNext() {
    setAnswer(''); setConfidence(null); setHintIds([]); setSubmissionKey(null); setSubmissionMessage(null); setActiveFeedback(null);
    await progressQuery.refetch();
  }

  const feedback = activeFeedback;
  const confidenceFeedback = feedback ? getConfidenceFeedback(feedback.status === 'correct', feedback.confidence, Boolean(feedback.misconception)) : null;
  const incorrectExplanation = feedback?.distractorExplanation || feedback?.misconception?.guidance || 'Not quite. Check the operation and the direction each number moves, then try again.';

  return <PageShell title="Practice" subtitle={activity.name} section="student"><PracticeQuestionFrame questionNumber={completed + 1} totalQuestions={progress.length} stageLabel={current.stageInstruction}>
    <div data-testid="activity-state" data-state={feedback ? 'feedback' : 'question'} data-question-id={question.id} data-activity-code={activityCode}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Question {completed + 1} · {question.marks} mark{question.marks === 1 ? '' : 's'}</p>
      <h1 className="mt-3 whitespace-pre-wrap font-display text-2xl font-semibold leading-9 text-brand-navy dark:text-brand-parchment sm:text-3xl">{question.prompt}</h1>
      {feedback ? <PracticeFeedback correct={feedback.status === 'correct'} title={feedback.status === 'correct' ? 'Correct.' : 'Not quite.'} action={feedback.status === 'correct' ? <button className="academy-btn-primary inline-flex min-h-11 items-center gap-2 rounded-full px-5" onClick={() => void continueToNext()} type="button">Next question <ArrowRight className="h-4 w-4" aria-hidden="true" /></button> : <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100" onClick={() => setActiveFeedback(null)} type="button"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again</button>}>
        {feedback.status === 'correct' ? <><p>{confidenceFeedback?.message}</p><p className="mt-2 text-xs font-semibold">{feedback.marksAwarded ?? feedback.marksAvailable} / {feedback.marksAvailable} mark{feedback.marksAvailable === 1 ? '' : 's'}</p></> : <><p>{incorrectExplanation}</p>{feedback.misconception?.explanation ? <p className="mt-3 border-l-2 border-amber-400 pl-3">{feedback.misconception.explanation}</p> : null}<p className="mt-3 text-xs">Your answer: <span className="font-mono font-semibold">{feedback.learnerAnswer}</span></p></>}
      </PracticeFeedback> : <div className="mt-7">
        <label className="block text-sm font-semibold text-brand-navy dark:text-brand-parchment" htmlFor="activity-answer">Your answer</label>
        <QuestionResponseInput questionType={question.questionType} options={question.options} value={answer} onChange={setAnswer} disabled={submit.isPending} />
        {hintIds.map((id) => { const hint = question.hints.find((item) => item.id === id); return <p className="mt-3 flex gap-2 border-l-2 border-brand-gold pl-3 text-sm leading-6 text-slate-700 dark:text-slate-200" key={id}><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" /><span><span className="font-semibold">Hint {hint?.level}: </span>{hint?.prompt}</span></p>; })}
        {availableHint ? <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-semibold text-brand-aegean hover:bg-brand-aegean/10" onClick={() => setHintIds((ids) => [...ids, availableHint.id])} type="button"><Lightbulb className="h-4 w-4" aria-hidden="true" /> Show a hint</button> : null}
        <fieldset className="mt-6"><legend className="text-sm font-semibold text-brand-navy dark:text-brand-parchment">How sure are you?</legend><p className="mt-1 text-xs text-slate-500 dark:text-brand-marble">This helps us give useful feedback.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{([[1, 'Not sure'], [2, 'A little'], [3, 'Quite'], [4, 'Very']] as const).map(([value, label]) => <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium ${confidence === value ? 'border-brand-aegean bg-brand-aegean/10 text-brand-navy dark:border-brand-gold dark:bg-brand-gold/10 dark:text-brand-parchment' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-brand-marble'}`} key={value}><input checked={confidence === value} className="sr-only" name="activity-confidence" onChange={() => setConfidence(value)} type="radio" value={value} />{label}</label>)}</div></fieldset>
        {submissionMessage || submit.isError ? <p className="mt-4 text-sm text-red-700 dark:text-red-200" role="alert">{submissionMessage ?? 'Your answer could not be saved. Check your connection and retry.'}</p> : null}
        <div className="sticky bottom-3 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/95"><span className="text-xs text-slate-500 dark:text-brand-marble">Your work is saved when checked.</span><button className="academy-btn-primary inline-flex min-h-11 shrink-0 items-center rounded-full px-5 disabled:opacity-50" disabled={!answer.trim() || submit.isPending} onClick={() => void submitAnswer()} type="button">{submit.isPending ? 'Checking…' : submissionMessage ? 'Retry answer' : 'Check answer'}</button></div>
      </div>}
    </div>
  </PracticeQuestionFrame></PageShell>;
}
