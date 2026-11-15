import { ArrowLeft, ArrowRight, BookOpen, Lightbulb } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { useGrade8LearningBridge } from './studentLearningQueries';

export function StudentLearningBridgeRoute() {
  const skillCode = useParams().skillCode ?? '';
  const [search] = useSearchParams();
  const returnTopic = search.get('returnTopic');
  const bridgeQuery = useGrade8LearningBridge(skillCode);
  const returnTo = returnTopic ? `/dashboard/student/learning/topic/${encodeURIComponent(returnTopic)}` : '/dashboard/student/learning';

  if (bridgeQuery.isPending) return <PageShell title="Grade 8 foundation" subtitle="Preparing your focused bridge lesson." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (bridgeQuery.isError) return <PageShell title="Grade 8 foundation" subtitle="Focused support" section="student"><ErrorState title="Foundation lesson could not be loaded" description="Check your connection and try again." onRetry={() => void bridgeQuery.refetch()} /></PageShell>;
  const bridge = bridgeQuery.data;
  if (!bridge) return <PageShell title="Grade 8 foundation" subtitle="Focused support" section="student"><EmptyState icon={BookOpen} title="This foundation lesson is not ready yet" description="The lesson or its practice is still being reviewed." actionLabel="Back to Learning" actionHref={returnTo} /></PageShell>;

  return <PageShell title="Grade 8 foundation" subtitle="A focused bridge back to your Grade 9 topic" section="student"><div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-brand-marble" to={returnTo}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to your Grade 9 topic</Link>
    <section className="rounded-[2rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Targeted foundation</p><h2 className="mt-2 font-display text-3xl font-semibold">{bridge.skillName}</h2><p className="mt-3 max-w-3xl leading-7 text-brand-marble">This short Grade 8 bridge supports your current Grade 9 work. It is support, not a judgement that you have failed Grade 8.</p></section>
    <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7"><h3 className="text-lg font-semibold">{bridge.content.title}</h3>{bridge.content.learningObjective ? <section className="mt-5 rounded-2xl border border-brand-aegean/20 bg-brand-aegean/5 p-4"><h4 className="text-sm font-semibold">Learning objective</h4><p className="mt-1 leading-6">{bridge.content.learningObjective}</p></section> : null}<section className="mt-6"><h4 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 text-brand-aegean" aria-hidden="true" /> Short explanation</h4><p className="mt-2 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">{bridge.content.explanation}</p></section><section className="mt-6 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-5"><h4 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-5 w-5 text-brand-gold" aria-hidden="true" /> Worked example</h4><p className="mt-2 whitespace-pre-line font-mono text-sm leading-7">{bridge.content.workedExample}</p></section>{bridge.content.commonMisconception ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><h4 className="text-sm font-semibold text-amber-900">Common misconception</h4><p className="mt-1 leading-6 text-amber-900">{bridge.content.commonMisconception}</p></section> : null}{bridge.activityCode ? <Link className="academy-btn-primary mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5" to={`/dashboard/student/learning/activity/${encodeURIComponent(bridge.activityCode)}`}>Practise this foundation <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : <p className="mt-6 text-sm text-slate-500">Practice will appear after its questions are approved.</p>}</article>
  </div></PageShell>;
}
