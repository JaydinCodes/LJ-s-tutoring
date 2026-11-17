import { ArrowLeft, BookOpen, Lightbulb } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { FocusedLessonSection, LessonStartLink, WorkedExample } from './LearningExperienceDesignSystem';
import { useGrade8LearningBridge } from './studentLearningQueries';

export function StudentLearningBridgeRoute() {
  const skillCode = useParams().skillCode ?? '';
  const [search] = useSearchParams();
  const returnTopic = search.get('returnTopic');
  const bridgeQuery = useGrade8LearningBridge(skillCode);
  const returnTo = returnTopic ? `/dashboard/student/learning/topic/${encodeURIComponent(returnTopic)}` : '/dashboard/student/learning';

  if (bridgeQuery.isPending) return <PageShell title="Grade 8 support" subtitle="Preparing your bridge lesson." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (bridgeQuery.isError) return <PageShell title="Grade 8 support" subtitle="Focused support" section="student"><ErrorState title="Support lesson could not be loaded" description="Check your connection and try again." onRetry={() => void bridgeQuery.refetch()} /></PageShell>;
  const bridge = bridgeQuery.data;
  if (!bridge) return <PageShell title="Grade 8 support" subtitle="Focused support" section="student"><EmptyState icon={BookOpen} title="This support lesson is not ready yet" description="The lesson or its practice is still being reviewed." actionLabel="Return to your topic" actionHref={returnTo} /></PageShell>;

  return <PageShell title="Grade 8 support" subtitle="A short bridge back to Grade 9" section="student"><article className="mx-auto max-w-3xl space-y-5">
    <Link className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-slate-700 hover:text-brand-aegean dark:text-brand-marble" to={returnTo}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to your Grade 9 topic</Link>
    <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">Targeted support</p><h1 className="mt-2 font-display text-3xl font-semibold text-brand-navy dark:text-brand-parchment">{bridge.skillName}</h1><p className="mt-3 leading-7 text-slate-600 dark:text-brand-marble">This short Grade 8 bridge supports your current Grade 9 work. It is support, not a judgement.</p></header>
    <FocusedLessonSection title="Understand" icon={<BookOpen className="h-5 w-5 text-brand-aegean" aria-hidden="true" />}><p className="whitespace-pre-line leading-7">{bridge.content.explanation}</p>{bridge.content.learningObjective ? <p className="mt-4 border-l-2 border-brand-aegean pl-3 text-sm leading-6">{bridge.content.learningObjective}</p> : null}</FocusedLessonSection>
    <WorkedExample>{bridge.content.workedExample}</WorkedExample>
    {bridge.activityCode ? <FocusedLessonSection title="Try it yourself" icon={<Lightbulb className="h-5 w-5 text-brand-aegean" aria-hidden="true" />} tone="quiet"><p className="mb-4 leading-7">A little practice will help this idea feel familiar before you return to Grade 9.</p><LessonStartLink to={`/dashboard/student/learning/activity/${encodeURIComponent(bridge.activityCode)}`} label="Practise this foundation" /></FocusedLessonSection> : null}
    {bridge.content.commonMisconception ? <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><summary className="cursor-pointer font-semibold text-brand-navy dark:text-brand-parchment">A useful check</summary><p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{bridge.content.commonMisconception}</p></details> : null}
  </article></PageShell>;
}
