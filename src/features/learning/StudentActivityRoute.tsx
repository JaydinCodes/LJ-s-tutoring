import { ArrowLeft, ArrowRight, Check, Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell } from '../../components/dashboard/DashboardDesignSystem';
import { LessonSteps } from './LearningMap';
import { getConfidenceFeedback, getMisconceptionExplanation, type MisconceptionDetail } from './misconceptionExplanations';
import { QuestionResponseInput } from './QuestionResponseInput';
import { formatLearnerMath } from './studentLearningPresentation';
import { type LearnerConfidence } from './studentLearningRepository';
import { useActivityProgress, useCompleteLearningActivityMutation, useGrade9LearningTopic, useGrade9Term1LearningJourney, useGrade9Term1TopicLearningMap, useLearnerActivity, useLearnerQuestion, useSubmitLearningAttemptMutation } from './studentLearningQueries';
import './student-learning.css';

interface QuestionFeedbackState {
  questionId: string;
  learnerAnswer: string;
  confidence: LearnerConfidence | null;
  status: 'correct' | 'incorrect' | 'needs_review';
  marksAwarded: number | null;
  marksAvailable: number;
  misconception?: MisconceptionDetail | null;
  explanationCode?: string;
  distractorExplanation?: string | null;
}

export function StudentActivityRoute() {
  const activityCode = useParams().activityCode ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const retentionCheckId = searchParams.get('retentionCheck');
  const journeyQuery = useGrade9Term1LearningJourney();
  const returnTopicCode = searchParams.get('topic') ?? journeyQuery.data?.primary.topicCode ?? journeyQuery.data?.currentTopic?.topicCode ?? '';
  const returnSkillCode = searchParams.get('skill');
  const topicQuery = useGrade9LearningTopic(returnTopicCode);
  const topicMapQuery = useGrade9Term1TopicLearningMap(returnTopicCode);
  const activityQuery = useLearnerActivity(activityCode);
  const progressQuery = useActivityProgress(activityCode);
  const progress = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const requestedQuestion = searchParams.get('question');
  const current = progress.find((item) => item.questionVersionId === requestedQuestion)
    ?? progress.find((item) => !item.attemptId) ?? null;
  const questionQuery = useLearnerQuestion(current?.questionVersionId ?? null);
  const submit = useSubmitLearningAttemptMutation('', activityCode);
  const completion = useCompleteLearningActivityMutation();
  const { mutate: complete, variables: completionContext, isPending: completionPending } = completion;
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<LearnerConfidence | null>(null);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<QuestionFeedbackState | null>(null);
  const [sessionResults, setSessionResults] = useState<QuestionFeedbackState[]>([]);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const startedAt = useRef(Date.now());
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const feedbackHeading = useRef<HTMLHeadingElement>(null);
  const contextSkill = topicQuery.data?.skills.find((skill) => skill.activityCode === activityCode
    && skill.skillCode === activityQuery.data?.targetSkillCode && (!returnSkillCode || skill.skillCode === returnSkillCode));
  const topicRoute = contextSkill ? `/dashboard/student/learning/topic/${encodeURIComponent(returnTopicCode)}` : '/dashboard/student/learning';
  const lessonParams = contextSkill ? new URLSearchParams({ lesson: contextSkill.skillCode }) : null;
  if (lessonParams && retentionCheckId) lessonParams.set('retentionCheck', retentionCheckId);
  if (lessonParams && current) lessonParams.set('question', current.questionVersionId);
  const conceptRoute = contextSkill?.content && lessonParams ? `${topicRoute}?${lessonParams}` : undefined;
  const exampleRoute = conceptRoute ? `${conceptRoute}&step=example` : undefined;

  useEffect(() => {
    setAnswer('');
    setConfidence(null);
    setHintIds([]);
    setSubmissionKey(null);
    setActiveFeedback(null);
    setSubmissionMessage(null);
    startedAt.current = Date.now();
  }, [activityCode, current?.questionVersionId]);

  useEffect(() => {
    setSessionResults([]);
  }, [activityCode]);

  useEffect(() => {
    if (activeFeedback) feedbackHeading.current?.focus();
    else questionHeading.current?.focus();
  }, [activeFeedback, current?.questionVersionId, questionQuery.isSuccess, completion.isSuccess]);

  useEffect(() => {
    if (!current && activityQuery.isSuccess && progressQuery.isSuccess && activityCode && progress.length > 0
      && progress.every((item) => item.attemptId) && !completionPending
      && (completionContext?.activityCode !== activityCode || completionContext.retentionCheckId !== retentionCheckId)) {
      complete({ activityCode, retentionCheckId });
    }
  }, [activityCode, activityQuery.isSuccess, progressQuery.isSuccess, progress, current, retentionCheckId, complete, completionContext, completionPending]);

  if (activityQuery.isPending || progressQuery.isPending) {
    return <PageShell title="Practice" subtitle="Preparing your next step." section="student"><div className="learning-overview" role="status" aria-busy="true"><span className="sr-only">Loading practice...</span><div className="learning-placeholder" aria-hidden="true" /></div></PageShell>;
  }
  if (activityQuery.isError || progressQuery.isError) {
    return <PageShell title="Practice" subtitle="Your next learning step." section="student"><ErrorState title="Activity could not be loaded" description="Check your connection and try again." onRetry={() => { void activityQuery.refetch(); void progressQuery.refetch(); }} /></PageShell>;
  }
  const activity = activityQuery.data;
  if (!activity) {
    return <PageShell title="Practice" subtitle="Your next learning step." section="student"><EmptyState title="Activity unavailable" description="This activity may still be under review." actionLabel="Return to Learning" actionHref="/dashboard/student/learning" /></PageShell>;
  }

  if (!current) {
    if (progress.length === 0) {
      return <PageShell title="Practice unavailable" subtitle={activity.name} section="student"><div className="learning-overview"><EmptyState title="No reviewed questions available" description="Return to Learning for another available step." /><Link className="learning-text-link" to={topicRoute}>{contextSkill ? 'Return to topic' : 'Return to Learning'}</Link></div></PageShell>;
    }
    if (completionContext?.activityCode !== activityCode || completionContext.retentionCheckId !== retentionCheckId || !completion.isSuccess) {
      return <PageShell title="Saving activity progress" subtitle={activity.name} section="student">{completion.isError
        ? <ErrorState title="Activity completion could not be saved" description="Your answers are saved. Retry recording completion before continuing." onRetry={() => complete({ activityCode, retentionCheckId })} />
        : <div role="status">Recording your completed activity...</div>}</PageShell>;
    }
    const reviewedMisconceptions = sessionResults.flatMap((result) => result.misconception ? [result.misconception] : []);
    const nextSkill = contextSkill ? topicQuery.data?.skills.find((skill) => skill.skillCode !== contextSkill.skillCode && skill.content
      && topicMapQuery.data?.skills.some((item) => item.skillCode === skill.skillCode && item.practiceStatus !== 'completed')) : undefined;
    return <PageShell title="Activity complete" subtitle={activity.name} section="student">
      <div className="learning-overview learning-lesson" data-testid="activity-state" data-state="complete" data-activity-code={activityCode}>
        {contextSkill ? <LessonSteps stage="feedback" conceptRoute={conceptRoute} exampleRoute={exampleRoute} /> : null}
        <section className="learning-reading"><p className="learning-eyebrow">Practice recorded</p><h2 ref={questionHeading} tabIndex={-1}>{contextSkill?.skillName ?? activity.name}</h2><p className="learning-description">{progress.length} {progress.length === 1 ? 'question completed' : 'questions completed'}. Your answers and feedback are saved.</p><p className="learning-muted learning-notice">Practice supports your learning. Topic mastery is recorded through formal assessments.</p></section>
        {reviewedMisconceptions.length ? <details className="learning-lesson-resources"><summary>Review feedback from this session</summary><div className="learning-resource-list">{reviewedMisconceptions.map((misconception, index) => <div key={`${misconception.code}-${index}`}><h3>{misconception.title}</h3><p className="learning-muted">{misconception.guidance}</p></div>)}</div></details> : null}
        {nextSkill ? <section className="learning-topic-next"><p className="learning-eyebrow">Next lesson</p><h2>{nextSkill.skillName}</h2><Link className="learning-primary" to={`${topicRoute}?${new URLSearchParams({ lesson: nextSkill.skillCode })}`}>Next lesson <ArrowRight size={16} aria-hidden="true" /></Link></section> : null}
        <nav className="learning-lesson-footer" aria-label="Continue after practice"><Link className={nextSkill ? 'learning-text-link' : 'learning-primary'} to={topicRoute}>{contextSkill ? 'Return to topic' : 'Continue learning'}<ArrowRight size={16} aria-hidden="true" /></Link><Link className="learning-text-link" to="/dashboard/student/progress">View updated progress</Link></nav>
      </div>
    </PageShell>;
  }

  if (questionQuery.isError) {
    return <PageShell title={activity.name} subtitle={current.stageInstruction} section="student"><ErrorState title="Question could not be loaded" description="Your saved progress has not changed. Try loading the question again." onRetry={() => { void questionQuery.refetch(); }} /></PageShell>;
  }
  const question = questionQuery.data;
  if (!question) {
    return <PageShell title={activity.name} subtitle={current.stageInstruction} section="student"><div className="learning-overview" role="status" aria-busy="true"><span className="sr-only">Loading your question...</span><div className="learning-placeholder" aria-hidden="true" /></div></PageShell>;
  }
  const availableHint = question.hints.find((hint) => !hintIds.includes(hint.id));
  const completed = progress.filter((item) => item.attemptId).length;
  const questionNumber = progress.findIndex((item) => item.questionVersionId === current.questionVersionId) + 1;

  async function submitAnswer() {
    if (!question || !answer.trim() || submit.isPending) return;
    const key = submissionKey ?? crypto.randomUUID();
    setSubmissionKey(key);
    setSubmissionMessage(null);
    try {
      const result = await submit.mutateAsync({
        activityCode, questionVersionId: question.id, answer, confidence,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
        idempotencyKey: key, hintIds,
      });
      const evaluation = result.evaluation;
      const status = evaluation?.status ?? 'needs_review';
      const match = evaluation?.misconceptionMatches?.[0];
      const feedback: QuestionFeedbackState = {
        questionId: question.id, learnerAnswer: answer, confidence, status,
        marksAwarded: evaluation?.marksAwarded ?? (status === 'correct' ? question.marks : null),
        marksAvailable: evaluation?.marksAvailable ?? question.marks,
        misconception: match?.code ? getMisconceptionExplanation(match.code) : null,
        explanationCode: evaluation?.explanationCode,
        distractorExplanation: evaluation?.distractorExplanation ?? null,
      };
      setActiveFeedback(feedback);
      setSessionResults((previous) => [...previous, feedback]);
      setSubmissionKey(null);
    } catch (error) {
      setSubmissionMessage(error instanceof Error ? error.message : 'Your answer could not be checked. Retry the same answer.');
    }
  }

  function handleTryAgain() {
    setActiveFeedback(null);
  }

  async function handleContinue() {
    if (advancing) return;
    setAdvancing(true);
    try {
      const result = await progressQuery.refetch();
      if (result.isError) return;
      setAnswer('');
      setConfidence(null);
      setHintIds([]);
      setSubmissionKey(null);
      setSubmissionMessage(null);
      setActiveFeedback(null);
      if (requestedQuestion) setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('question');
        return next;
      }, { replace: true });
    } finally {
      setAdvancing(false);
    }
  }

  const feedbackInsight = activeFeedback ? getConfidenceFeedback(activeFeedback.status === 'correct', activeFeedback.confidence, !!activeFeedback.misconception) : null;

  return <PageShell title={activity.name} subtitle={contextSkill ? `${topicQuery.data?.topicName} · ${contextSkill.skillName}` : current.stageInstruction} section="student">
    <div className="learning-overview learning-lesson learning-practice">
      <Link className="learning-text-link" to={topicRoute}><ArrowLeft size={16} aria-hidden="true" />{contextSkill ? topicQuery.data?.topicName : 'All learning topics'}</Link>
      {contextSkill ? <LessonSteps stage={activeFeedback ? 'feedback' : 'practice'} conceptRoute={conceptRoute} exampleRoute={exampleRoute} /> : null}
      <div className="learning-question-progress"><span>{current.stageType.replaceAll('_', ' ')}</span><span>Question {questionNumber} of {progress.length}</span><progress max={progress.length} value={completed} aria-label={`${completed} of ${progress.length} questions completed`} /></div>
      <section className="learning-question" aria-labelledby="activity-question-heading" data-testid="activity-state" data-state={activeFeedback ? 'feedback' : 'question'} data-question-id={question.id} data-activity-code={activityCode}>
        <p className="learning-eyebrow">{activeFeedback ? 'Your answer & feedback' : 'Your turn'} · {question.marks} {question.marks === 1 ? 'mark' : 'marks'}</p>
        <h2 id="activity-question-heading" ref={questionHeading} tabIndex={-1}>{formatLearnerMath(question.prompt)}</h2>
        {activeFeedback ? <div className="learning-feedback" data-result={activeFeedback.status}>
          <p className="learning-submitted-answer"><span className="learning-muted">Your answer</span><strong>{activeFeedback.learnerAnswer}</strong></p>
          <h3 ref={feedbackHeading} tabIndex={-1}>{activeFeedback.status === 'correct' ? <><Check size={20} aria-hidden="true" /> Answer correct</> : activeFeedback.status === 'needs_review' ? 'Saved for review' : 'Not quite yet'}</h3>
          {activeFeedback.status === 'needs_review' ? <p className="learning-muted">Your answer is saved and needs a tutor to review it. It has not been marked correct or incorrect.</p>
            : <>
              <p>{feedbackInsight?.message}</p>
              {activeFeedback.distractorExplanation ? <div className="learning-feedback-reason"><h4>Why this choice is not correct</h4><p>{formatLearnerMath(activeFeedback.distractorExplanation)}</p></div> : null}
              {activeFeedback.misconception ? <div className="learning-feedback-reason"><h4>{activeFeedback.misconception.title}</h4><p>{activeFeedback.misconception.explanation}</p><p>{activeFeedback.misconception.guidance}</p>{activeFeedback.misconception.example ? <p className="learning-feedback-example">{activeFeedback.misconception.example}</p> : null}</div> : null}
              {activeFeedback.status === 'correct' && activeFeedback.marksAwarded !== null ? <p className="learning-muted">Marks awarded: {activeFeedback.marksAwarded} / {activeFeedback.marksAvailable}</p> : null}
            </>}
          <div className="learning-feedback-actions">{activeFeedback.status === 'incorrect' ? <>
            <button type="button" className="learning-primary" onClick={handleTryAgain}><RotateCcw size={16} aria-hidden="true" />Try again with this insight</button>
            {exampleRoute ? <Link className="learning-text-link" to={exampleRoute}>Review examples <ArrowRight size={16} aria-hidden="true" /></Link> : null}
          </> : <button type="button" className="learning-primary" disabled={advancing} onClick={() => { void handleContinue(); }}>{advancing ? 'Loading next step...' : 'Continue to next step'}<ArrowRight size={16} aria-hidden="true" /></button>}</div>
        </div> : <form className="learning-answer-form" onSubmit={(event) => { event.preventDefault(); void submitAnswer(); }} aria-busy={submit.isPending}>
          <fieldset className="learning-answer-fieldset" disabled={submit.isPending}><legend>Your answer</legend>{question.questionType !== 'multiple_choice' ? <label className="sr-only" htmlFor="activity-answer">Your answer</label> : null}<QuestionResponseInput questionType={question.questionType} options={question.options} value={answer} onChange={setAnswer} disabled={submit.isPending} /></fieldset>
          {hintIds.map((id) => { const hint = question.hints.find((item) => item.id === id); return <aside key={id} className="learning-hint"><h3>Hint {hint?.level}</h3><p>{hint ? formatLearnerMath(hint.prompt) : null}</p></aside>; })}
          {availableHint ? <button className="learning-text-link" type="button" disabled={submit.isPending} onClick={() => setHintIds((previous) => [...previous, availableHint.id])}><Lightbulb size={16} aria-hidden="true" />{hintIds.length ? 'Show another hint' : 'Show a hint'}</button> : null}
          <fieldset className="learning-confidence" disabled={submit.isPending}><legend>How confident are you? <span className="learning-muted">(optional)</span></legend><div>{([[1, 'Not sure'], [2, 'A little sure'], [3, 'Quite sure'], [4, 'Very sure']] as const).map(([value, label]) => <label key={value}><input type="radio" name="activity-confidence" value={value} checked={confidence === value} onChange={() => setConfidence(value)} disabled={submit.isPending} /><span>{label}</span></label>)}</div></fieldset>
          {submissionMessage || submit.isError ? <p className="learning-error" role="alert">{submissionMessage ?? 'Your answer could not be saved. Check your connection and retry.'}</p> : null}
          <div className="learning-feedback-actions"><button type="submit" className="learning-primary" disabled={!answer.trim() || submit.isPending}>{submit.isPending ? 'Checking answer...' : submissionMessage ? 'Retry same answer' : 'Check answer'}<ArrowRight size={16} aria-hidden="true" /></button>{exampleRoute ? <Link className="learning-text-link" to={exampleRoute}>Review examples</Link> : null}</div>
        </form>}
      </section>
    </div>
  </PageShell>;
}
