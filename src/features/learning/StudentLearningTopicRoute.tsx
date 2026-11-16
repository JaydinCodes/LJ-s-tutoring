import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { PrimaryNextStep } from './LearningExperienceDesignSystem';
import { TopicLearningMap } from './LearningMap';
import { useGrade9LearningTopic, useGrade9Term1LearningJourney, useGrade9Term1TopicLearningMap, useSetGrade9Term1LearningContextMutation } from './studentLearningQueries';

function statusCopy(status: string) {
  if (status === 'mastered') return 'You have mastered this topic with formal evidence.';
  if (status === 'baseline_available') return 'Start with a short baseline to find the most useful lesson.';
  if (status === 'assessment_in_progress') return 'You have a saved assessment ready to resume.';
  if (status === 'learning_in_progress') return 'Keep building your understanding one skill at a time.';
  if (status === 'ready_for_endline') return 'You are ready to show what you know in the endline.';
  if (status === 'mastery_challenge_available') return 'Your mastery challenge is ready.';
  if (status === 'content_unavailable') return 'Lessons are being prepared for this topic.';
  return 'Choose a skill when you are ready.';
}

function actionLabel(action: string) {
  if (action === 'start_baseline') return 'Start your baseline';
  if (action === 'start_endline') return 'Start your endline';
  if (action === 'start_mastery_challenge') return 'Open mastery challenge';
  if (action === 'resume_assessment') return 'Resume assessment';
  return 'Continue learning';
}

export function StudentLearningTopicRoute() {
  const topicCode = useParams().topicCode ?? '';
  const topicQuery = useGrade9LearningTopic(topicCode);
  const mapQuery = useGrade9Term1TopicLearningMap(topicCode);
  const journeyQuery = useGrade9Term1LearningJourney();
  const setContext = useSetGrade9Term1LearningContextMutation();

  if (topicQuery.isPending || mapQuery.isPending || journeyQuery.isPending) return <PageShell title="Learning topic" subtitle="Preparing your pathway." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (topicQuery.isError || mapQuery.isError || journeyQuery.isError) return <PageShell title="Learning topic" subtitle="Grade 9 Mathematics" section="student"><ErrorState title="Topic could not be loaded" description="Check your connection and try again." onRetry={() => { void topicQuery.refetch(); void mapQuery.refetch(); void journeyQuery.refetch(); }} /></PageShell>;

  const topic = topicQuery.data;
  const map = mapQuery.data;
  const journey = journeyQuery.data;
  const journeyTopic = journey?.topics.find((item) => item.topicCode === topicCode);
  if (!topic || !map || !journeyTopic) return <PageShell title="Learning topic" subtitle="Grade 9 Mathematics" section="student"><EmptyState icon={BookOpen} title="This topic is not ready yet" description="Only reviewed Grade 9 Term 1 topics can be opened from your learning roadmap." actionLabel="Back to Learning" actionHref="/dashboard/student/learning" /></PageShell>;

  const recommendedForTopic = journey?.primary.topicCode === topicCode && journey.primary.action !== 'explore_topic' ? journey.primary : null;
  const isCurrent = journey?.context.selectedTopicCode === topicCode;
  const hasPublishedContent = topic.skills.some((skill) => skill.content);

  return <PageShell title={map.topicName} subtitle="Grade 9 Mathematics · Term 1" section="student">
    <div className="mx-auto max-w-5xl space-y-5">
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-slate-700 hover:text-brand-aegean dark:text-brand-marble" to="/dashboard/student/learning"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Learning</Link>

      <header className="rounded-[1.75rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Topic pathway</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">{map.topicName}</h1>
        {topic.topicDescription ? <p className="mt-3 max-w-3xl leading-7 text-brand-marble">{topic.topicDescription}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm text-white"><CheckCircle2 className="h-4 w-4 text-brand-gold" aria-hidden="true" /> {statusCopy(journeyTopic.status)}</span>
          <button className="min-h-10 rounded-full border border-white/25 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={setContext.isPending || isCurrent} onClick={() => void setContext.mutateAsync({ topicCode })} type="button">{setContext.isPending ? 'Saving…' : isCurrent ? 'Current topic' : 'Make this my topic'}</button>
        </div>
      </header>

      {recommendedForTopic ? <PrimaryNextStep title={recommendedForTopic.title} description={recommendedForTopic.description} to={recommendedForTopic.route} label={actionLabel(recommendedForTopic.action)} /> : null}

      {hasPublishedContent ? <TopicLearningMap map={map} journey={journey} topic={journeyTopic} /> : <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900"><h2 className="text-xl font-semibold text-brand-navy dark:text-brand-parchment">Lessons are being reviewed</h2><p className="mt-2 max-w-2xl leading-7 text-slate-600 dark:text-brand-marble">The topic pathway stays visible so you can see what will be available next. No learning content is shown until it has been reviewed and approved.</p></section>}
    </div>
  </PageShell>;
}
