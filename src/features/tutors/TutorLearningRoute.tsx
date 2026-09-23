import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, PageShell, PremiumButton, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { loadLearningReviewQueue, loadTutorLearningInsights, reviewLearningAttempt } from './tutorLearningRepository';

const queueKey = ['tutor-learning', 'manual-review'] as const;

export function TutorLearningRoute() {
  const client = useQueryClient();
  const queue = useQuery({ queryKey: queueKey, queryFn: loadLearningReviewQueue, staleTime: 10_000 });
  const insights = useQuery({ queryKey: ['tutor-learning', 'insights'], queryFn: loadTutorLearningInsights, staleTime: 30_000 });
  const review = useMutation({ mutationFn: reviewLearningAttempt, onSuccess: async () => client.invalidateQueries({ queryKey: queueKey }) });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (queue.isPending || insights.isPending) return <PageShell title="Learning evidence" subtitle="Cases needing professional judgement." section="tutor"><SkeletonCard className="min-h-64" /></PageShell>;
  if (queue.isError || insights.isError) return <PageShell title="Learning evidence" subtitle="Cases needing professional judgement." section="tutor"><ErrorState title="Learning evidence unavailable" description="Check your connection and try again." onRetry={() => { void queue.refetch(); void insights.refetch(); }} /></PageShell>;
  const items = queue.data ?? [];
  return <PageShell title="Learning evidence" subtitle="Routine answers are marked automatically. Review only the cases that need judgement." section="tutor">
    <section aria-labelledby="manual-review-heading"><h2 id="manual-review-heading" className="text-xl font-semibold">Needs manual review</h2>
      {!items.length ? <EmptyState title="No reviews waiting" description="Automatically evaluated practice does not require tutor approval." /> : <div className="mt-4 grid gap-4">{items.map((item) => <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900" key={item.reviewId}>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-aegean">{item.studentName} · {item.targetSkill || 'Mathematics'}</p>
        <h3 className="mt-3 font-semibold">{item.questionPrompt}</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950">{JSON.stringify(item.learnerResponse, null, 2)}</pre>
        <p className="mt-3 text-xs text-slate-500">Hints opened: {item.hintCount} · Confidence: {item.confidence ?? 'Not supplied'} · Time: {item.timeSpentSeconds ?? '—'}s</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Marks awarded<input className="mt-1 block w-full rounded-xl border p-3 dark:bg-slate-950" min="0" step="0.5" type="number" value={marks[item.reviewId] ?? ''} onChange={(event) => setMarks((current) => ({ ...current, [item.reviewId]: event.target.value }))} /></label><label className="text-sm font-semibold">Feedback note<textarea className="mt-1 block w-full rounded-xl border p-3 dark:bg-slate-950" value={notes[item.reviewId] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.reviewId]: event.target.value }))} /></label></div>
        <div className="mt-4 flex flex-wrap gap-2">{(['correct','partially_correct','incorrect'] as const).map((outcome) => <PremiumButton disabled={review.isPending || marks[item.reviewId] === undefined} key={outcome} onClick={() => review.mutate({ reviewId:item.reviewId,outcome,marksAwarded:Number(marks[item.reviewId]),feedbackNote:notes[item.reviewId] ?? '' })}>{outcome.replace('_',' ')}</PremiumButton>)}</div>
      </article>)}</div>}
    </section>
    <ExceptionSection title="Repeated misconceptions" empty="No repeated patterns need attention." items={(insights.data?.repeatedMisconceptions ?? []).map((item) => `${item.studentName} - ${item.skillName ?? 'Mathematics'}: ${item.pattern} (${item.observedCount} observations)`)} />
    <ExceptionSection title="Stalled learners" empty="No learners meet the stalled-learning rule." items={(insights.data?.stalledLearners ?? []).map((item) => `${item.studentName} - ${item.skillName}: ${item.masteryState} after ${item.independentAttempts} independent attempts`)} />
    <ExceptionSection title="High hint dependency" empty="No high hint dependency detected." items={(insights.data?.hintDependency ?? []).map((item) => `${item.studentName} - ${item.skillName}: ${item.assistedCorrectAttempts} of ${item.correctAttempts} correct attempts were assisted`)} />
    <ExceptionSection title="Recently improved" empty="No recent mastery changes yet." items={(insights.data?.recentlyImproved ?? []).map((item) => `${item.studentName} - ${item.skillName}: ${item.previousState} to ${item.currentState}`)} />
  </PageShell>;
}

function ExceptionSection({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return <section><h2 className="text-xl font-semibold">{title}</h2>{items.length ? <ul className="mt-3 grid gap-2">{items.map((item) => <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900" key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{empty}</p>}</section>;
}
