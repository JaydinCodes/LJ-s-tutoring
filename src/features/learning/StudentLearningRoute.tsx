import { ArrowRight, BookOpen, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { JourneyMap } from './LearningMap';
import { PrimaryNextStep } from './LearningExperienceDesignSystem';
import { useDueRetentionStep, useGrade9LearningCatalogue, useGrade9Term1LearningJourney } from './studentLearningQueries';

function actionLabel(action: string) {
  if (action === 'start_baseline') return 'Start your baseline';
  if (action === 'start_endline') return 'Start your endline';
  if (action === 'start_mastery_challenge') return 'Open mastery challenge';
  if (action === 'resume_assessment') return 'Resume assessment';
  if (action === 'retention_review') return 'Start quick review';
  if (action === 'explore_topic') return 'Choose a topic';
  return 'Continue learning';
}

export function StudentLearningRoute() {
  const journeyQuery = useGrade9Term1LearningJourney();
  const catalogueQuery = useGrade9LearningCatalogue();
  const retentionQuery = useDueRetentionStep();

  if (journeyQuery.isPending || catalogueQuery.isPending) {
    return <PageShell title="Learning" subtitle="Finding your next useful step." section="student"><SkeletonCard className="min-h-52" /></PageShell>;
  }
  if (journeyQuery.isError || catalogueQuery.isError) {
    return <PageShell title="Learning" subtitle="Finding your next useful step." section="student"><ErrorState title="Learning could not be loaded" description="Check your connection and try again." onRetry={() => { void journeyQuery.refetch(); void catalogueQuery.refetch(); }} /></PageShell>;
  }

  const journey = journeyQuery.data;
  const catalogue = catalogueQuery.data ?? [];
  if (!journey) {
    return <PageShell title="Learning" subtitle="Grade 9 Mathematics" section="student"><EmptyState icon={BookOpen} title="Learning is getting ready" description="Your next learning step will appear once approved content is available." /></PageShell>;
  }

  const masteredTopics = journey.topics.filter((topic) => topic.status === 'mastered').length;
  const currentTopic = journey.currentTopic ?? journey.topics.find((topic) => topic.topicCode === journey.primary.topicCode) ?? null;
  const focusSkill = catalogue.flatMap((topic) => topic.skills).find((skill) => skill.skillCode === (currentTopic?.focusSkillCode ?? journey.context.focusSkillCode));
  const dueReview = retentionQuery.data;
  const prerequisite = journey.prerequisiteRecommendation;
  const bridgeReturnTopic = prerequisite?.originTopicCode || currentTopic?.topicCode || journey.primary.topicCode || '';
  // A no-content fallback deliberately has no self-link. The roadmap remains
  // visible, but learners are not sent back to the screen they are on.
  const noReviewedPrimary = journey.primary.action === 'explore_topic' && journey.primary.route === '/dashboard/student/learning';

  return (
    <PageShell title="Learning" subtitle="Grade 9 Mathematics · one clear step at a time" section="student">
      <div className="mx-auto max-w-6xl space-y-5">
        {noReviewedPrimary ? <section className="rounded-[1.75rem] border border-brand-gold/30 bg-brand-navy p-5 text-brand-parchment sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Learning</p><h2 className="mt-2 font-display text-2xl font-semibold text-white">No reviewed learning action is available yet</h2><p className="mt-2 leading-7 text-brand-marble">Your roadmap will show an available lesson or assessment as soon as reviewed content is published.</p></section> : <PrimaryNextStep
          title={journey.primary.title}
          description={journey.primary.description}
          to={journey.primary.route}
          label={actionLabel(journey.primary.action)}
          detail={currentTopic ? `${currentTopic.topicName}${focusSkill ? ` · ${focusSkill.skillName}` : ''}` : undefined}
        />}

        <section aria-label="Your current learning" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Current focus</p>
            <p className="mt-1 font-semibold text-brand-navy dark:text-brand-parchment">{currentTopic?.topicName ?? 'Choose a Grade 9 topic'}{focusSkill ? <span className="font-normal text-slate-600 dark:text-brand-marble"> · {focusSkill.skillName}</span> : null}</p>
          </div>
          <p className="px-1 text-sm text-slate-600 dark:text-brand-marble"><span className="font-semibold text-brand-navy dark:text-brand-parchment">{masteredTopics} of {journey.topics.length}</span> topics mastered</p>
        </section>

        <JourneyMap journey={journey} />

        {dueReview && journey.primary.action !== 'retention_review' ? <section className="flex flex-col gap-3 rounded-2xl border border-brand-aegean/20 bg-brand-aegean/5 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Optional review">
          <div><p className="font-semibold text-brand-navy dark:text-brand-parchment">A quick review is ready</p><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">A short retrieval helps this skill stay familiar. It is optional.</p></div>
          <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-brand-aegean/30 px-4 text-sm font-semibold text-brand-aegean sm:self-auto" to={`/dashboard/student/learning/activity/${encodeURIComponent(dueReview.activityCode)}?retentionCheck=${encodeURIComponent(dueReview.retentionCheckId)}`}>Review now <RotateCcw className="h-4 w-4" aria-hidden="true" /></Link>
        </section> : null}

        {prerequisite ? <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold text-amber-950 dark:text-amber-100">Grade 8 support can make this easier</p><p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-100">This is a short bridge to support your Grade 9 work, not a setback.</p></div>
          <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-amber-300 px-4 text-sm font-semibold text-amber-950 dark:border-amber-700 dark:text-amber-100 sm:self-auto" to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(bridgeReturnTopic)}`}>Open support <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section> : null}

        <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <summary className="cursor-pointer font-semibold text-brand-navy marker:text-brand-aegean dark:text-brand-parchment">Explore topics</summary>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Choose any point on the four-topic roadmap above to review its pathway, completed learning and available assessments. The roadmap is your single place to explore Grade 9 Term 1.</p>
        </details>
      </div>
    </PageShell>
  );
}
