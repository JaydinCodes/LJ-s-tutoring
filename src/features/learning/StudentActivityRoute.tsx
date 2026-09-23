import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import { EmptyState, ErrorState, PageShell, PremiumButton, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { useActivityProgress, useLearnerActivity, useLearnerQuestion, useSubmitLearningAttemptMutation } from './studentLearningQueries';
import { completeLearnerActivity, completeLearnerRetentionCheck, type LearnerConfidence } from './studentLearningRepository';

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
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setAnswer(''); setConfidence(null); setHintIds([]); setSubmissionKey(null); startedAt.current = Date.now();
  }, [current?.questionVersionId]);

  useEffect(() => {
    if (activityCode && progress.length > 0 && progress.every((item) => item.attemptId)) {
      void (async () => {
        await completeLearnerActivity(activityCode);
        if (retentionCheckId) await completeLearnerRetentionCheck(retentionCheckId, activityCode);
      })();
    }
  }, [activityCode, progress, retentionCheckId]);

  if (activityQuery.isPending || progressQuery.isPending) return <PageShell title="Practice" subtitle="Preparing your next step." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (activityQuery.isError || progressQuery.isError) return <PageShell title="Practice" subtitle="Your next learning step." section="student"><ErrorState title="Activity could not be loaded" description="Check your connection and try again." onRetry={() => { void activityQuery.refetch(); void progressQuery.refetch(); }} /></PageShell>;
  const activity = activityQuery.data;
  if (!activity) return <PageShell title="Practice" subtitle="Your next learning step." section="student"><EmptyState title="Activity unavailable" description="This activity may still be under review." /></PageShell>;
  if (!current) return <PageShell title="Activity complete" subtitle={activity.name} section="student"><section className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" /><h2 className="mt-4 text-2xl font-semibold">Nice work.</h2><p className="mt-2 text-slate-600 dark:text-brand-marble">Your evidence has been saved and your next step will update automatically.</p><Link className="academy-btn-primary mt-6 inline-flex rounded-full px-5 py-3" to="/dashboard/student/learning">Back to learning</Link></section></PageShell>;
  const question = questionQuery.data;
  if (!question) return <PageShell title={activity.name} subtitle={current.stageInstruction} section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  const availableHint = question.hints.find((hint) => !hintIds.includes(hint.id));
  const completed = progress.filter((item) => item.attemptId).length;

  async function submitAnswer() {
    if (!question || !answer.trim() || submit.isPending) return;
    const key = submissionKey ?? crypto.randomUUID(); setSubmissionKey(key);
    await submit.mutateAsync({ activityCode, questionVersionId: question.id, answer, confidence,
      timeSpentSeconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)), idempotencyKey: key, hintIds });
    setSubmissionKey(null); await progressQuery.refetch();
  }

  return <PageShell title={activity.name} subtitle={current.stageInstruction} section="student">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-aegean">{current.stageType.replaceAll('_', ' ')} · {completed + 1} of {progress.length}</p>
      <h2 className="mt-5 whitespace-pre-wrap text-xl font-semibold leading-8">{question.prompt}</h2>
      <label className="mt-7 block text-sm font-semibold" htmlFor="activity-answer">Your answer</label>
      <textarea id="activity-answer" className="mt-2 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-white/15 dark:bg-slate-950" value={answer} onChange={(event) => setAnswer(event.target.value)} />
      {hintIds.map((id) => <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30" key={id}>{question.hints.find((hint) => hint.id === id)?.prompt}</p>)}
      {availableHint ? <button className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border px-4" type="button" onClick={() => setHintIds((ids) => [...ids, availableHint.id])}><Lightbulb className="h-4 w-4" />Show a hint</button> : null}
      <fieldset className="mt-6"><legend className="text-sm font-semibold">How confident are you?</legend><div className="mt-2 flex flex-wrap gap-2">{([1,2,3,4] as const).map((value) => <label className="rounded-full border px-4 py-2" key={value}><input className="mr-2" type="radio" name="activity-confidence" checked={confidence === value} onChange={() => setConfidence(value)} />{value}</label>)}</div></fieldset>
      {submit.isError ? <p className="mt-4 text-sm text-red-700" role="alert">Your answer could not be saved. Retry with the same answer.</p> : null}
      <PremiumButton className="mt-7" disabled={!answer.trim() || submit.isPending} onClick={() => { void submitAnswer(); }}>{submit.isPending ? 'Saving…' : 'Save & continue'}</PremiumButton>
    </section>
  </PageShell>;
}
