import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, NotebookPen, Send, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { useAvailableLearningAssessments, useLearningAssessmentSession, useSaveLearningAssessmentAnswerMutation, useStartLearningAssessmentMutation, useSubmitLearningAssessmentMutation } from './studentLearningQueries';

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function StudentAssessmentIntroductionRoute() {
  const definitionId = useParams().definitionId ?? '';
  const navigate = useNavigate();
  const assessments = useAvailableLearningAssessments();
  const start = useStartLearningAssessmentMutation();
  const assessment = assessments.data?.find((item) => item.definitionId === definitionId) ?? null;

  async function begin() {
    if (!assessment || start.isPending) return;
    try {
      const sessionId = await start.mutateAsync({
        definitionId: assessment.definitionId,
        idempotencyKey: crypto.randomUUID()
      });
      navigate(`/dashboard/student/learning/assessment/session/${encodeURIComponent(sessionId)}`, { replace: true });
    } catch {
      // The mutation error remains visible below without leaving the learner on a blank route.
    }
  }

  if (assessments.isPending)
    return (
      <PageShell title="Assessment" subtitle="Preparing your assessment." section="student">
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  if (assessments.isError)
    return (
      <PageShell title="Assessment" subtitle="Your independent assessment." section="student">
        <ErrorState title="Assessment unavailable" description="Check your connection and try again." onRetry={() => void assessments.refetch()} />
      </PageShell>
    );
  if (!assessment)
    return (
      <PageShell title="Assessment" subtitle="Your independent assessment." section="student">
        <EmptyState title="Assessment unavailable" description="This assessment may still be under review or no longer be open." />
      </PageShell>
    );

  return (
    <PageShell title={assessment.name} subtitle="Independent assessment" section="student">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment shadow-xl sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> One scored answer per question
        </span>
        <h2 className="mt-5 font-display text-3xl font-semibold text-white sm:text-4xl">Ready when you are</h2>
        <p className="mt-3 max-w-2xl leading-7 text-brand-marble">This is a timed Grade 9 Mathematics assessment. Work calculations in your exercise book, choose one answer for each question, and review your selections before final submission.</p>
        <dl className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs uppercase tracking-wide text-brand-marble">Topic</dt>
            <dd className="mt-1 font-semibold text-white">{assessment.topicName ?? 'Term 1'}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs uppercase tracking-wide text-brand-marble">Questions</dt>
            <dd className="mt-1 font-semibold text-white">{assessment.questionCount}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs uppercase tracking-wide text-brand-marble">Time limit</dt>
            <dd className="mt-1 font-semibold text-white">{assessment.durationMinutes} minutes</dd>
          </div>
        </dl>
        <ul className="mt-7 space-y-2 text-sm text-brand-marble">
          <li>• The timer starts only after the secure session is created.</li>
          <li>• Refreshing does not reset the timer; saved choices will return when you reconnect.</li>
          <li>• Hints and instant correctness feedback are not available in a formal assessment.</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="academy-btn-primary inline-flex min-h-12 items-center gap-2 rounded-full px-6" disabled={start.isPending} onClick={() => void begin()} type="button">
            {start.isPending ? 'Starting securely…' : 'Start assessment'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white" to="/dashboard/student/learning">
            Back to Learning
          </Link>
        </div>
        {start.isError ? (
          <p className="mt-4 text-sm text-red-200" role="alert">
            {message(start.error)}
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}

export function StudentAssessmentSessionRoute() {
  const sessionId = useParams().sessionId ?? '';
  const sessionQuery = useLearningAssessmentSession(sessionId);
  const save = useSaveLearningAssessmentAnswerMutation(sessionId);
  const submit = useSubmitLearningAssessmentMutation(sessionId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const session = sessionQuery.data;
  const refreshSession = sessionQuery.refetch;
  const offset = session ? Date.parse(session.serverNow) - Date.now() : 0;
  const remaining = session ? Date.parse(session.expiresAt) - (clock + offset) : 0;
  useEffect(() => {
    if (session?.status === 'in_progress' && remaining <= 0) void refreshSession();
  }, [refreshSession, remaining, session?.status]); // server finalises; this only refreshes the view.

  const questions = session?.questions ?? [];
  const current = questions[Math.min(activeIndex, Math.max(0, questions.length - 1))] ?? null;
  const answered = questions.filter((item) => item.selectedOption).length;

  async function select(option: 'A' | 'B' | 'C' | 'D') {
    if (!current || session?.status !== 'in_progress' || save.isPending) return;
    setSaveError(null);
    try {
      await save.mutateAsync({
        sessionQuestionId: current.sessionQuestionId,
        selectedOption: option,
        idempotencyKey: crypto.randomUUID()
      });
    } catch (error) {
      setSaveError(message(error));
      await sessionQuery.refetch();
    }
  }

  async function finalise() {
    if (!session || submit.isPending) return;
    if (!window.confirm(`Submit ${answered} saved answer${answered === 1 ? '' : 's'}? Unanswered questions receive zero marks.`)) return;
    try {
      await submit.mutateAsync();
      await sessionQuery.refetch();
    } catch (error) {
      setSaveError(message(error));
      await sessionQuery.refetch();
    }
  }

  if (sessionQuery.isPending)
    return (
      <PageShell title="Assessment" subtitle="Restoring your secure session." section="student">
        <SkeletonCard className="min-h-80" />
      </PageShell>
    );
  if (sessionQuery.isError || !session)
    return (
      <PageShell title="Assessment" subtitle="Independent assessment" section="student">
        <ErrorState title="Session unavailable" description="Your saved assessment may have expired or your connection was interrupted." onRetry={() => void sessionQuery.refetch()} />
      </PageShell>
    );
  if (session.status === 'submitted' || session.status === 'timed_out') return <AssessmentResult session={session} />;
  if (!current)
    return (
      <PageShell title="Assessment" subtitle="Independent assessment" section="student">
        <EmptyState title="No questions available" description="This form is incomplete and cannot be completed." />
      </PageShell>
    );

  return (
    <PageShell title={session.assessment.name} subtitle={`${session.assessment.topicName ?? 'Grade 9 Mathematics'} · independent assessment`} section="student">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600 dark:text-brand-marble">
              Question {activeIndex + 1} of {questions.length}
            </p>
            <p className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-bold ${remaining < 60_000 ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200' : 'bg-brand-aegean/10 text-brand-aegean dark:bg-brand-gold/10 dark:text-brand-gold'}`} aria-live="polite">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {formatRemaining(remaining)}
            </p>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full bg-brand-aegean transition-[width] dark:bg-brand-gold" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
          <p className="mt-8 whitespace-pre-wrap text-lg leading-8 text-brand-navy dark:text-brand-parchment">{current.prompt}</p>
          <fieldset className="mt-7 space-y-3" aria-label={`Answer choices for question ${activeIndex + 1}`}>
            <legend className="sr-only">Choose one answer</legend>
            {(['A', 'B', 'C', 'D'] as const).map((key) => (
              <label className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${current.selectedOption === key ? 'border-brand-aegean bg-brand-aegean/10 dark:border-brand-gold dark:bg-brand-gold/10' : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-800'} ${save.isPending ? 'opacity-70' : ''}`} key={key}>
                <input checked={current.selectedOption === key} className="h-5 w-5" disabled={save.isPending} name={`assessment-${current.sessionQuestionId}`} onChange={() => void select(key)} type="radio" value={key} />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-brand-navy dark:bg-white/10 dark:text-white">{key}</span>
                <span className="text-base font-medium text-brand-navy dark:text-brand-parchment">{current.options[key]}</span>
              </label>
            ))}
          </fieldset>
          {saveError ? (
            <p className="mt-4 text-sm text-red-700 dark:text-red-200" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold disabled:opacity-50" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)} type="button">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            {activeIndex < questions.length - 1 ? (
              <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-4 font-semibold text-white" onClick={() => setActiveIndex((index) => index + 1)} type="button">
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50" disabled={submit.isPending} onClick={() => void finalise()} type="button">
                <Send className="h-4 w-4" aria-hidden="true" />
                {submit.isPending ? 'Submitting…' : 'Submit assessment'}
              </button>
            )}
          </div>
        </section>
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <h2 className="font-semibold text-brand-navy dark:text-brand-parchment">Your answers</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">You can revise any saved selection before submitting.</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {questions.map((question, index) => (
              <button aria-label={`Question ${index + 1}${question.selectedOption ? ', answered' : ', unanswered'}`} className={`min-h-11 rounded-xl border text-sm font-bold ${index === activeIndex ? 'border-brand-aegean bg-brand-aegean text-white' : question.selectedOption ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-brand-marble'}`} key={question.sessionQuestionId} onClick={() => setActiveIndex(index)} type="button">
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <NotebookPen className="mb-2 h-5 w-5" aria-hidden="true" />
            Use your exercise book for calculations. There are no hints or instant results during this assessment.
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function AssessmentResult({ session }: { session: NonNullable<ReturnType<typeof useLearningAssessmentSession>['data']> }) {
  const result = session.result;
  return (
    <PageShell title={session.status === 'timed_out' ? 'Time is up' : 'Assessment submitted'} subtitle={session.assessment.name} section="student">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Results recorded
        </span>
        <h2 className="mt-5 font-display text-3xl font-semibold text-brand-navy dark:text-white">{result ? `${result.percentage}%` : 'Completed'}</h2>
        {result ? (
          <>
            <p className="mt-2 text-slate-600 dark:text-brand-marble">
              {result.rawScore} of {result.totalMarks} marks. Your score and learning recommendation have been saved.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <ResultMetric label="Topic outcome" value={result.topicMastery?.status?.replaceAll('_', ' ') ?? 'Pending'} />
              <ResultMetric label="Critical skills" value={result.topicMastery?.criticalSkillCoverage == null ? 'Pending' : `${result.topicMastery.criticalSkillCoverage}%`} />
              <ResultMetric label="Reasoning" value={result.topicMastery?.reasoningAchievement == null ? 'More evidence needed' : `${result.topicMastery.reasoningAchievement}%`} />
            </div>
            {result.skillBreakdown.length ? (
              <section className="mt-7">
                <h3 className="font-semibold text-brand-navy dark:text-brand-parchment">Your skill evidence</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {result.skillBreakdown.map((skill) => (
                    <article className="rounded-2xl border border-slate-200 p-4 dark:border-white/10" key={skill.skillCode}>
                      <p className="font-semibold text-brand-navy dark:text-brand-parchment">{skill.skillName}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">
                        {skill.correct} of {skill.total} correct · {skill.percentage}%
                      </p>
                      <p className={`mt-2 text-xs font-bold uppercase tracking-wide ${skill.percentage >= 80 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{skill.percentage >= 80 ? 'Strength' : 'Build next'}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {result.questionFeedback.length ? (
              <details className="mt-7 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                <summary className="cursor-pointer font-semibold text-brand-navy dark:text-brand-parchment">Review released solutions</summary>
                <div className="mt-4 space-y-4">
                  {result.questionFeedback.map((feedback, index) => (
                    <article className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950" key={feedback.sessionQuestionId}>
                      <p className="font-semibold text-brand-navy dark:text-brand-parchment">
                        Question {index + 1} · {feedback.isCorrect ? 'Correct' : `Correct answer: ${feedback.correctOption}`}
                      </p>
                      {feedback.distractorExplanation ? <p className="mt-2 text-slate-600 dark:text-brand-marble">{feedback.distractorExplanation}</p> : null}
                      <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-brand-marble">{feedback.workedSolution}</p>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
            <section className="mt-7 rounded-2xl bg-brand-aegean/10 p-5 dark:bg-brand-gold/10">
              <h3 className="font-semibold text-brand-navy dark:text-brand-parchment">Next step</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-brand-marble">{nextStepCopy(result.recommendation?.nextStep, result.recommendation?.focusSkillCode)}</p>
            </section>
          </>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="academy-btn-primary inline-flex min-h-12 items-center gap-2 rounded-full px-6" to="/dashboard/student/learning">
            Return to Learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 font-semibold" to="/dashboard/student/progress">
            View progress
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-brand-marble">{label}</p>
      <p className="mt-2 capitalize font-semibold text-brand-navy dark:text-white">{value}</p>
    </div>
  );
}
function nextStepCopy(nextStep?: string, skill?: string | null) {
  if (nextStep === 'offer_mastery_challenge') return 'You showed a strong baseline. An independent mastery challenge is available when published.';
  if (nextStep === 'advance_to_dependent_topic') return 'You have demonstrated topic mastery. Continue to the next eligible topic at your own pace.';
  if (nextStep === 'targeted_mathematical_reasoning_practice') return 'Build more independent mathematical-reasoning evidence with targeted practice before your next assessment.';
  return skill ? `Focus next on ${skill}. A targeted explanation and practice path will be recommended.` : 'Continue with the recommended learning activity before your next independent assessment.';
}
