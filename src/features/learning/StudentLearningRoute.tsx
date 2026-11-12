import {
  ArrowRight,
  Brain,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import {
  AnimatedProgressBar,
  EmptyState,
  ErrorState,
  PageShell,
  SkeletonCard,
} from '../../components/dashboard/DashboardDesignSystem';

import { useApprovedLearningVideos, useAvailableLearningAssessments, useAvailableLearningDiagnostics, useDueRetentionStep, useGrade9LearningCatalogue, useGrade9Term1LearningJourney, useLearnerMasterySummary } from './studentLearningQueries';

const journeyStatusLabel: Record<string, string> = {
  not_started: 'Not started', baseline_available: 'Baseline available', assessment_in_progress: 'Assessment in progress',
  learning_in_progress: 'Learning in progress', ready_for_endline: 'Ready for endline',
  mastery_challenge_available: 'Mastery challenge available', mastered: 'Mastered', content_unavailable: 'Content unavailable',
};

export function StudentLearningRoute() {
  const diagnosticsQuery =
    useAvailableLearningDiagnostics();
  const retentionQuery = useDueRetentionStep();
  const masteryQuery = useLearnerMasterySummary();
  const catalogueQuery = useGrade9LearningCatalogue();
  const videosQuery = useApprovedLearningVideos();
  const assessmentsQuery = useAvailableLearningAssessments();
  const journeyQuery = useGrade9Term1LearningJourney();

  if (diagnosticsQuery.isPending || masteryQuery.isPending || catalogueQuery.isPending || journeyQuery.isPending) {
    return (
      <PageShell
        title="Learning"
        subtitle="Focused practice built around your current learning."
        section="student"
      >
        <SkeletonCard className="min-h-52" />
        <SkeletonCard />
      </PageShell>
    );
  }

  if (diagnosticsQuery.isError || masteryQuery.isError || catalogueQuery.isError || journeyQuery.isError) {
    return (
      <PageShell
        title="Learning"
        subtitle="Focused practice built around your current learning."
        section="student"
      >
        <ErrorState
          title="Learning could not be loaded"
          description="Check your connection and try again."
          onRetry={() => {
            void diagnosticsQuery.refetch();
            void masteryQuery.refetch();
            void catalogueQuery.refetch();
            void videosQuery.refetch();
            void journeyQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  const diagnostics =
    diagnosticsQuery.data ?? [];
  const mastery = masteryQuery.data ?? [];
  const catalogue = catalogueQuery.data ?? [];
  const foundationVideos = (videosQuery.data ?? []).filter((video) => video.skillCode.startsWith('G8-'));
  const assessments = assessmentsQuery.data ?? [];
  const journey = journeyQuery.data;
  // This supporting query renders an optional retrieval link only. The
  // journey RPC remains the single source for the dominant action and its
  // precedence when work is resumable.
  const dueRetention = retentionQuery.data;
  const masteredTopicCount = journey?.topics.filter((topic) => topic.status === 'mastered').length ?? 0;
  const currentFocus = journey?.currentTopic?.focusSkillCode ?? journey?.context.focusSkillCode ?? journey?.primary.topicCode ?? 'Choose a topic when you are ready';
  const prerequisite = journey?.prerequisiteRecommendation ?? null;
  const prerequisiteVideos = prerequisite
    ? foundationVideos.filter((video) => video.skillCode === prerequisite.skillCode)
    : [];

  return (
    <PageShell
      title="Learning"
      subtitle="Short diagnostic and practice activities help your tutor understand what to work on next."
      section="student"
    >
      {journey ? (
        <section className="rounded-[2rem] border border-brand-gold/30 bg-brand-navy p-6 text-brand-parchment shadow-xl sm:p-8" aria-labelledby="next-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Continue learning</p>
          <h2 id="next-step-title" className="mt-3 text-2xl font-semibold">{journey.primary.title}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-brand-marble">{journey.primary.description}</p>
          {journey.primary.action === 'explore_topic' && journey.primary.route === '/dashboard/student/learning' ? <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-950/50 dark:text-brand-marble">No reviewed learning action is available yet. This page will show a topic action once an administrator publishes approved content or an eligible assessment.</p> : <Link className="academy-btn-primary mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5" to={journey.primary.route}>{journey.primary.action === 'explore_topic' ? 'Explore learning' : journey.primary.action === 'resume_assessment' ? 'Resume assessment' : 'Continue learning'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
        </section>
      ) : null}
      {journey ? <section aria-labelledby="journey-heading" className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">My learning journey</p><h2 id="journey-heading" className="mt-1 text-xl font-semibold text-brand-navy dark:text-brand-parchment">Grade 9 Mathematics · Term 1</h2></div><p className="max-w-md text-sm leading-6 text-slate-600 dark:text-brand-marble">Your roadmap is based on independent assessment evidence and reviewed learning availability—not pages visited.</p></div><ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{journey.topics.map((topic, index) => <li key={topic.topicCode} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><p className="text-xs font-bold uppercase tracking-wide text-brand-aegean">Topic {index + 1}</p><h3 className="mt-1 font-semibold text-brand-navy dark:text-brand-parchment">{topic.topicName}</h3><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${topic.status === 'mastered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-brand-marble'}`}>{journeyStatusLabel[topic.status] ?? topic.status}</p><Link className="mt-4 inline-flex text-sm font-semibold text-brand-aegean underline-offset-4 hover:underline" to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`}>View roadmap</Link></li>)}</ol></section> : null}

      {journey ? <section aria-labelledby="progress-heading" className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-brand-aegean">Topics mastered</p><p id="progress-heading" className="mt-2 text-2xl font-semibold text-brand-navy dark:text-brand-parchment">{masteredTopicCount} of {journey.topics.length}</p><p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Formal assessment evidence only.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-brand-aegean">Current focus</p><p className="mt-2 break-words font-semibold text-brand-navy dark:text-brand-parchment">{currentFocus}</p><p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Recommendations update from saved evidence.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-brand-aegean">Optional review</p><p className="mt-2 font-semibold text-brand-navy dark:text-brand-parchment">{journey.primary.action === 'retention_review' ? 'A quick retrieval is ready' : dueRetention ? 'A quick retrieval is available' : 'No review is due now'}</p><p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Reviews support retention; they are never a deadline.</p>{dueRetention && journey.primary.action !== 'retention_review' ? <Link className="mt-3 inline-flex text-sm font-semibold text-brand-aegean underline-offset-4 hover:underline" to={`/dashboard/student/learning/activity/${encodeURIComponent(dueRetention.activityCode)}?retentionCheck=${encodeURIComponent(dueRetention.retentionCheckId)}`}>Start quick review</Link> : null}</article></section> : null}

      {assessments.length ? <section aria-labelledby="assessments-heading" className="rounded-3xl border border-brand-gold/30 bg-brand-navy p-5 text-brand-parchment sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Independent checks</p><h2 id="assessments-heading" className="mt-1 text-xl font-semibold text-white">Available assessments</h2></div><p className="max-w-md text-sm leading-6 text-brand-marble">These timed checks are separate from practice. Your exercise book is the place for working.</p></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{assessments.map((assessment) => <article className="rounded-2xl border border-white/10 bg-white/5 p-4" key={assessment.definitionId}><p className="text-xs font-bold uppercase tracking-wide text-brand-gold">{assessment.assessmentType.replaceAll('_', ' ')}</p><h3 className="mt-1 font-semibold text-white">{assessment.name}</h3><p className="mt-2 text-sm text-brand-marble">{assessment.questionCount} questions · {assessment.durationMinutes} minutes</p><Link className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-navy" to={`/dashboard/student/learning/assessment/${encodeURIComponent(assessment.definitionId)}`}>Read instructions <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></article>)}</div></section> : null}

      <section aria-labelledby="catalogue-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">Grade 9 Mathematics</p>
            <h2 id="catalogue-heading" className="mt-1 text-xl font-semibold">Choose a CAPS-aligned topic</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-brand-marble">Only skills with reviewed learner content appear here. More Grade 9 topics will appear as their content is approved.</p>
        </div>
        {catalogue.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{catalogue.map((topic) => <article key={topic.topicCode} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">{topic.areaName}</p><h3 className="mt-2 text-xl font-semibold text-brand-navy dark:text-brand-parchment">{topic.topicName}</h3>{topic.topicDescription ? <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">{topic.topicDescription}</p> : null}<ul className="mt-4 space-y-2" aria-label={`${topic.topicName} available skills`}>{topic.skills.map((skill) => <li key={skill.skillCode} className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/60"><span className="font-medium text-brand-navy dark:text-brand-parchment">{skill.skillName}</span>{skill.activityCode ? <span className="ml-2 text-brand-aegean">Practice ready</span> : <span className="ml-2 text-slate-500 dark:text-brand-marble">Explanation ready</span>}</li>)}</ul><Link className="academy-btn-primary mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5" to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`}>Explore topic <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></article>)}</div> : <EmptyState icon={BookOpen} title="Reviewed topics are on their way" description="Learning content is shown only after it has been reviewed and approved." />}
      </section>

      {prerequisite ? <section aria-labelledby="foundation-heading" className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Grade 8 foundations</p>
        <h2 id="foundation-heading" className="mt-1 text-xl font-semibold">A useful foundation before your next step</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-brand-marble">Existing evidence suggests that this prerequisite would make your Grade 9 focus easier. This is targeted support, not a judgement that you have failed Grade 8.</p>
        <Link className="academy-btn-primary mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5" to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(journey?.context.originTopicCode ?? journey?.context.selectedTopicCode ?? '')}`}>Open the bridge lesson <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        {prerequisiteVideos.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{prerequisiteVideos.map((video) => <a key={video.resourceCode} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-brand-navy hover:border-brand-aegean dark:border-white/10 dark:bg-slate-950 dark:text-brand-parchment" href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title}<span className="mt-1 block text-xs font-normal text-slate-500 dark:text-brand-marble">{video.channelName} · Watch on YouTube</span></a>)}</div> : null}
        {journey?.context.originTopicCode || journey?.context.selectedTopicCode ? <Link className="mt-4 inline-flex text-sm font-semibold text-brand-aegean underline-offset-4 hover:underline" to={`/dashboard/student/learning/topic/${encodeURIComponent(journey.context.originTopicCode ?? journey.context.selectedTopicCode ?? '')}`}>Return to your Grade 9 topic</Link> : null}
      </section> : null}

      {mastery.length ? <section aria-labelledby="skills-heading"><h2 id="skills-heading" className="text-xl font-semibold">Current learning progress</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{mastery.map((item) => <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900" key={item.skillCode}><span className="font-medium">{item.skillName}</span><span className="rounded-full bg-brand-aegean/10 px-3 py-1 text-sm capitalize text-brand-aegean">{item.state}</span></article>)}</div></section> : null}

      {diagnostics.length   === 0 ? (
        <EmptyState
          icon={Brain}
          title="Nothing ready yet"
          description="Your learning activities will appear here after they have been reviewed and approved."
        />
      ) : (
        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label="Available learning activities"
        >
          {diagnostics.map((diagnostic) => {
            const progress =
              diagnostic.totalQuestions > 0
                ? (
                    diagnostic.completedQuestions /
                    diagnostic.totalQuestions
                  ) * 100
                : 0;

            return (
              <article
                key={diagnostic.code}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">
                      Diagnostic
                    </p>

                    <h2 className="mt-2 text-xl font-semibold text-brand-navy dark:text-brand-parchment">
                      {diagnostic.name}
                    </h2>
                  </div>

                  {diagnostic.complete ? (
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      aria-label="Completed"
                    >
                      <CheckCircle2
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </span>
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-aegean/10 text-brand-aegean">
                      <Brain
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-brand-marble">
                  {diagnostic.description}
                </p>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-brand-navy dark:text-brand-parchment">
                      Progress
                    </span>

                    <span className="text-slate-500 dark:text-brand-marble">
                      {diagnostic.completedQuestions}
                      {' / '}
                      {diagnostic.totalQuestions}
                    </span>
                  </div>

                  <AnimatedProgressBar
                    value={progress}
                  />
                </div>

                <Link
                  className="academy-btn-primary mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5"
                  to={`/dashboard/student/learning/diagnostic/${encodeURIComponent(
                    diagnostic.code,
                  )}`}
                >
                  {diagnostic.complete
                    ? 'Review completion'
                    : diagnostic.started
                      ? 'Continue'
                      : 'Start'}

                  <ArrowRight
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </PageShell>
  );
}
