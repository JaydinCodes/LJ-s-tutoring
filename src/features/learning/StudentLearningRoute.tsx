import { ArrowRight, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ErrorState, PageShell } from '../../components/dashboard/DashboardDesignSystem';
import type { AvailableLearningAssessment, AvailableLearningDiagnostic, DueRetentionStep, LearnerVideoResource, LearningJourney } from './studentLearningRepository';
import { JourneyMap } from './LearningMap';
import {
  useApprovedLearningVideos,
  useAvailableLearningAssessments,
  useAvailableLearningDiagnostics,
  useDueRetentionStep,
  useGrade9LearningCatalogue,
  useGrade9Term1LearningJourney,
  useLearnerMasterySummary,
} from './studentLearningQueries';
import './student-learning.css';

type UpcomingAction =
  | { kind: 'foundation'; id: string; skillCode: string; returnTopic: string; videos: LearnerVideoResource[] }
  | { kind: 'assessment'; id: string; assessment: AvailableLearningAssessment }
  | { kind: 'diagnostic'; id: string; diagnostic: AvailableLearningDiagnostic }
  | { kind: 'review'; id: string; review: DueRetentionStep };

function primaryActionLabel(action: LearningJourney['primary']['action']) {
  if (action === 'resume_assessment') return 'Resume assessment';
  if (action === 'start_baseline' || action === 'start_mastery_challenge' || action === 'start_endline') return 'Start assessment';
  if (action === 'retention_review') return 'Start quick review';
  if (action === 'explore_topic') return 'Choose a topic';
  return 'Continue learning';
}

export function StudentLearningRoute() {
  const [showAllActions, setShowAllActions] = useState(false);
  const diagnosticsQuery = useAvailableLearningDiagnostics();
  const retentionQuery = useDueRetentionStep();
  const masteryQuery = useLearnerMasterySummary();
  const catalogueQuery = useGrade9LearningCatalogue();
  const videosQuery = useApprovedLearningVideos();
  const assessmentsQuery = useAvailableLearningAssessments();
  const journeyQuery = useGrade9Term1LearningJourney();

  if (catalogueQuery.isPending || journeyQuery.isPending) {
    return (
      <PageShell title="Learning" subtitle="Grade 9 Mathematics · Term 1" section="student">
        <div className="learning-overview" role="status" aria-busy="true">
          <span className="sr-only">Loading your learning...</span>
          <div className="learning-placeholder" aria-hidden="true" />
          <div className="learning-placeholder learning-placeholder-short" aria-hidden="true" />
        </div>
      </PageShell>
    );
  }

  if (catalogueQuery.isError || journeyQuery.isError) {
    return (
      <PageShell title="Learning" subtitle="Grade 9 Mathematics · Term 1" section="student">
        <ErrorState
          title="Learning could not be loaded"
          description="Check your connection and try again."
          onRetry={() => {
            void catalogueQuery.refetch();
            void journeyQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  const journey = journeyQuery.data;
  const catalogue = catalogueQuery.data ?? [];
  const primary = journey?.primary;
  const currentTopicCode = journey?.currentTopic?.topicCode ?? primary?.topicCode ?? journey?.context.selectedTopicCode;
  const currentTopic = journey?.topics.find((topic) => topic.topicCode === currentTopicCode);
  const currentTopicIndex = journey?.topics.findIndex((topic) => topic.topicCode === currentTopicCode) ?? -1;
  const masteredTopicCount = journey?.topics.filter((topic) => topic.status === 'mastered').length ?? 0;
  const topicCount = journey?.topics.length ?? 0;
  const termProgress = topicCount ? Math.round((masteredTopicCount / topicCount) * 100) : null;
  const focusSkillCode = journey?.currentTopic?.focusSkillCode ?? journey?.context.focusSkillCode;
  const focusSkill = catalogue.flatMap((topic) => topic.skills).find((skill) => skill.skillCode === focusSkillCode);
  const mastery = masteryQuery.data ?? [];
  const demonstratedSkillCount = mastery.filter((skill) => skill.state === 'secure' || skill.state === 'retained').length;
  const hasNextAction = primary && !(primary.action === 'explore_topic' && primary.route === '/dashboard/student/learning');

  const prerequisite = journey?.prerequisiteRecommendation ?? null;
  const bridgeReturnTopic = journey?.context.originTopicCode || journey?.context.selectedTopicCode || journey?.currentTopic?.topicCode || primary?.topicCode || '';
  const foundationVideos = (videosQuery.data ?? []).filter((video) => video.skillCode.startsWith('G8-'));
  const prerequisiteVideos = prerequisite ? foundationVideos.filter((video) => video.skillCode === prerequisite.skillCode) : [];
  const assessments = (assessmentsQuery.data ?? []).filter((assessment) => primary?.route !== `/dashboard/student/learning/assessment/${encodeURIComponent(assessment.definitionId)}`);
  const diagnostics = (diagnosticsQuery.data ?? []).filter((diagnostic) => primary?.route !== `/dashboard/student/learning/diagnostic/${encodeURIComponent(diagnostic.code)}`);
  const dueRetention = retentionQuery.data;
  const optionalReview = dueRetention && primary?.action !== 'retention_review';
  const actionsLoading = assessmentsQuery.isPending || diagnosticsQuery.isPending || retentionQuery.isPending;
  const actionsError = assessmentsQuery.isError || diagnosticsQuery.isError || retentionQuery.isError;

  const upcomingActions: UpcomingAction[] = [];
  if (prerequisite) upcomingActions.push({ kind: 'foundation', id: `foundation-${prerequisite.skillCode}`, skillCode: prerequisite.skillCode, returnTopic: bridgeReturnTopic, videos: prerequisiteVideos });
  assessments.forEach((assessment) => upcomingActions.push({ kind: 'assessment', id: assessment.definitionId, assessment }));
  diagnostics.forEach((diagnostic) => upcomingActions.push({ kind: 'diagnostic', id: diagnostic.code, diagnostic }));
  if (optionalReview) upcomingActions.push({ kind: 'review', id: dueRetention.retentionCheckId, review: dueRetention });
  const visibleActions = showAllActions ? upcomingActions : upcomingActions.slice(0, 3);

  return (
    <PageShell title="Learning" subtitle="Grade 9 Mathematics · Term 1" section="student">
      <div className="learning-overview">
        <section className="learning-continue" aria-labelledby="continue-learning-heading">
          <div className="learning-next">
            <p className="learning-eyebrow">Continue learning</p>
            <h2 id="continue-learning-heading">{currentTopic?.topicName ?? primary?.title ?? 'Choose a topic to begin'}</h2>
            {currentTopicIndex >= 0 && topicCount ? <p className="learning-location">Topic {currentTopicIndex + 1} of {topicCount} in your learning path</p> : null}
            <p className="learning-description">{hasNextAction ? primary.description : catalogue.length ? 'Choose a topic to see its lessons and practice.' : 'Reviewed lessons and activities will appear here when they are published.'}</p>
            {focusSkill ? <p className="learning-focus">Current focus: {focusSkill.skillName}</p> : null}
            {hasNextAction ? <Link className="learning-primary" to={primary.route}>{primaryActionLabel(primary.action)}<ArrowRight size={16} aria-hidden="true" /></Link>
              : catalogue.length || journey?.topics.some((topic) => topic.contentAvailable) ? <a className="learning-primary" href="#learning-path">Choose a topic <ArrowRight size={16} aria-hidden="true" /></a>
                : <p className="learning-muted learning-notice">No learning action is available yet.</p>}
          </div>
          {topicCount ? <div className="learning-summary" aria-label="Term progress">
            <p>Term progress</p>
            <progress max={topicCount} value={masteredTopicCount} aria-label={`${masteredTopicCount} of ${topicCount} topics completed`} />
            <p className="learning-muted">Progress is recorded through formal assessments.</p>
          </div> : null}
        </section>

        {journey ? <JourneyMap journey={journey} /> : null}

        <section className="learning-section learning-progress-summary" aria-labelledby="progress-heading">
          <div className="learning-section-heading"><h2 id="progress-heading">Your progress</h2><Link className="learning-text-link" to="/dashboard/student/progress">View detailed progress <ArrowRight size={16} aria-hidden="true" /></Link></div>
          {topicCount || masteryQuery.isPending || mastery.length ? <div className="learning-progress-metrics">
            {termProgress !== null ? <p><strong>{termProgress}%</strong><span>Term progress</span></p> : null}
            {topicCount ? <p><strong>{masteredTopicCount} / {topicCount}</strong><span>Topics completed</span></p> : null}
            {masteryQuery.isPending ? <p className="learning-muted" role="status">Loading skill evidence...</p> : null}
            {!masteryQuery.isPending && !masteryQuery.isError && mastery.length ? <p><strong>{demonstratedSkillCount}</strong><span>Skills demonstrated</span></p> : null}
          </div> : masteryQuery.isError ? <p className="learning-error" role="alert">Progress could not be loaded. <button className="learning-text-link" type="button" onClick={() => { void masteryQuery.refetch(); }}>Try again</button></p> : <p className="learning-muted learning-empty">Your progress will appear after you complete learning activities.</p>}
        </section>

        <section id="upcoming-actions" className="learning-section" aria-labelledby="actions-heading">
          <div className="learning-section-heading"><h2 id="actions-heading">Up next</h2></div>
          {actionsLoading ? <p className="learning-muted learning-notice" role="status">Checking what is ready for you...</p> : null}
          {actionsError ? <div className="learning-error" role="alert"><p>Some upcoming work could not be loaded. You can still continue with the learning path above.</p><button className="learning-text-link" type="button" onClick={() => {
            void assessmentsQuery.refetch();
            void diagnosticsQuery.refetch();
            void retentionQuery.refetch();
          }}>Try again</button></div> : null}
          {!upcomingActions.length && !actionsLoading && !actionsError ? <p className="learning-muted learning-empty">Nothing else is ready right now. Continue with your learning path when you are ready.</p> : null}
          {visibleActions.length ? <ul className="learning-action-list">
            {visibleActions.map((item) => {
              if (item.kind === 'foundation') return <li className="learning-foundation" key={item.id}>
                <div><p className="learning-row-label">Helpful foundation</p><h3>Review this before your next step</h3><p className="learning-muted">A short Grade 8 refresher can make your current topic easier.</p></div>
                <Link className="learning-text-link" to={`/dashboard/student/learning/bridge/${encodeURIComponent(item.skillCode)}?returnTopic=${encodeURIComponent(item.returnTopic)}`}>Open the bridge lesson <ArrowRight size={16} aria-hidden="true" /></Link>
                <details className="learning-support-details"><summary>Supporting resources <ChevronDown size={16} aria-hidden="true" /></summary><div>
                  {videosQuery.isPending ? <p role="status">Loading videos...</p> : videosQuery.isError ? <p className="learning-error" role="alert">Videos could not be loaded. <button className="learning-text-link" type="button" onClick={() => { void videosQuery.refetch(); }}>Try again</button></p> : item.videos.length ? <ul>{item.videos.map((video) => <li key={video.resourceCode}><a className="learning-text-link" href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title} <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><span className="learning-muted">{video.channelName}</span></li>)}</ul> : <p className="learning-muted">No supporting videos are available yet.</p>}
                  {item.returnTopic ? <Link className="learning-text-link" to={`/dashboard/student/learning/topic/${encodeURIComponent(item.returnTopic)}`}>Return to your topic</Link> : null}
                </div></details>
              </li>;
              if (item.kind === 'assessment') return <li key={item.id}>
                <div><p className="learning-row-label">Assessment</p><h3>{item.assessment.name}</h3><p className="learning-muted">{item.assessment.questionCount} questions · about {item.assessment.durationMinutes} min</p></div>
                <Link className="learning-text-link" to={`/dashboard/student/learning/assessment/${encodeURIComponent(item.assessment.definitionId)}`}>Start assessment <ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {item.assessment.name}</span></Link>
              </li>;
              if (item.kind === 'diagnostic') return <li key={item.id}>
                <div><p className="learning-row-label">Diagnostic</p><h3>{item.diagnostic.name}</h3><p className="learning-muted">{item.diagnostic.description}</p><p className="learning-diagnostic-progress">{item.diagnostic.complete ? <><Check size={16} aria-hidden="true" /> Completed</> : `${item.diagnostic.completedQuestions} of ${item.diagnostic.totalQuestions} questions completed`}</p></div>
                <Link className="learning-text-link" to={`/dashboard/student/learning/diagnostic/${encodeURIComponent(item.diagnostic.code)}`}>{item.diagnostic.complete ? 'Review completion' : item.diagnostic.started ? 'Continue diagnostic' : 'Start diagnostic'}<ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {item.diagnostic.name}</span></Link>
              </li>;
              return <li key={item.id}><div><p className="learning-row-label">Quick review</p><h3>{item.review.name}</h3><p className="learning-muted">Optional practice to revisit what you have learned. No deadline.</p></div><Link className="learning-text-link" to={`/dashboard/student/learning/activity/${encodeURIComponent(item.review.activityCode)}?retentionCheck=${encodeURIComponent(item.review.retentionCheckId)}`}>Start quick review <ArrowRight size={16} aria-hidden="true" /></Link></li>;
            })}
          </ul> : null}
          {upcomingActions.length > 3 ? <button className="learning-text-link learning-show-all" type="button" aria-expanded={showAllActions} onClick={() => setShowAllActions((show) => !show)}>{showAllActions ? 'Show fewer upcoming items' : 'View all upcoming items'} <ArrowRight size={16} aria-hidden="true" /></button> : null}
        </section>
      </div>
    </PageShell>
  );
}
