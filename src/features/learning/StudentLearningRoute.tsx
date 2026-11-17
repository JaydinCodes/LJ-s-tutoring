import { ArrowRight, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, PageShell } from '../../components/dashboard/DashboardDesignSystem';
import { useApprovedLearningVideos, useAvailableLearningAssessments, useAvailableLearningDiagnostics, useDueRetentionStep, useGrade9LearningCatalogue, useGrade9Term1LearningJourney, useLearnerMasterySummary } from './studentLearningQueries';
import { JourneyMap } from './LearningMap';
import './student-learning.css';

export function StudentLearningRoute() {
  const [progressOpen, setProgressOpen] = useState(false);
  const diagnosticsQuery =
    useAvailableLearningDiagnostics();
  const retentionQuery = useDueRetentionStep();
  const masteryQuery = useLearnerMasterySummary();
  const catalogueQuery = useGrade9LearningCatalogue();
  const videosQuery = useApprovedLearningVideos();
  const assessmentsQuery = useAvailableLearningAssessments();
  const journeyQuery = useGrade9Term1LearningJourney();

  if (catalogueQuery.isPending || journeyQuery.isPending) {
    return (
      <PageShell
        title="Learning"
        subtitle="Grade 9 Mathematics · Term 1"
        section="student"
      >
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
      <PageShell
        title="Learning"
        subtitle="Grade 9 Mathematics · Term 1"
        section="student"
      >
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

  const diagnostics = diagnosticsQuery.data ?? [];
  const mastery = masteryQuery.data ?? [];
  const catalogue = catalogueQuery.data ?? [];
  const foundationVideos = (videosQuery.data ?? []).filter((video) => video.skillCode.startsWith('G8-'));
  const journey = journeyQuery.data;
  // This supporting query renders an optional retrieval link only. The
  // journey RPC remains the single source for the dominant action and its
  // precedence when work is resumable.
  const dueRetention = retentionQuery.data;
  const masteredTopicCount = journey?.topics.filter((topic) => topic.status === 'mastered').length ?? 0;
  const currentTopicCode = journey?.currentTopic?.topicCode ?? journey?.primary.topicCode ?? journey?.context.selectedTopicCode;
  const currentTopic = journey?.topics.find((topic) => topic.topicCode === currentTopicCode);
  const focusSkillCode = journey?.currentTopic?.focusSkillCode ?? journey?.context.focusSkillCode;
  const focusSkill = catalogue.flatMap((topic) => topic.skills).find((skill) => skill.skillCode === focusSkillCode)
    ?? mastery.find((skill) => skill.skillCode === focusSkillCode);
  const prerequisite = journey?.prerequisiteRecommendation ?? null;
  // Preserve the Grade 9 origin when the optional origin field is empty.
  // Selected topic and the current journey topic are safe fallbacks.
  const bridgeReturnTopic =
    journey?.context.originTopicCode
    || journey?.context.selectedTopicCode
    || journey?.currentTopic?.topicCode
    || journey?.primary.topicCode
    || '';
  const prerequisiteVideos = prerequisite
    ? foundationVideos.filter((video) => video.skillCode === prerequisite.skillCode)
    : [];
  const primary = journey?.primary;
  const hasNextAction = primary && !(primary.action === 'explore_topic' && primary.route === '/dashboard/student/learning');
  const assessments = (assessmentsQuery.data ?? []).filter((assessment) => primary?.route !== `/dashboard/student/learning/assessment/${encodeURIComponent(assessment.definitionId)}`);
  const otherDiagnostics = diagnostics.filter((diagnostic) => primary?.route !== `/dashboard/student/learning/diagnostic/${encodeURIComponent(diagnostic.code)}`);
  const optionalReview = dueRetention && primary?.action !== 'retention_review';
  const actionsLoading = assessmentsQuery.isPending || diagnosticsQuery.isPending || retentionQuery.isPending;
  const actionsError = assessmentsQuery.isError || diagnosticsQuery.isError || retentionQuery.isError;
  const hasActions = assessments.length > 0 || otherDiagnostics.length > 0 || optionalReview || prerequisite;
  const incompleteDiagnostics = otherDiagnostics.filter((diagnostic) => !diagnostic.complete).length;
  const actionSummary = [
    assessments.length ? `${assessments.length} ${assessments.length === 1 ? 'assessment' : 'assessments'}` : '',
    incompleteDiagnostics ? `${incompleteDiagnostics} ${incompleteDiagnostics === 1 ? 'diagnostic' : 'diagnostics'}` : '',
    prerequisite ? 'foundation support' : '',
    optionalReview ? 'an optional review' : '',
  ].filter(Boolean).join(', ');

  return (
    <PageShell
      title="Learning"
      subtitle="Grade 9 Mathematics · Term 1"
      section="student"
    >
      <div className="learning-overview">
        <section className="learning-continue" aria-label="Continue learning">
          <div className="learning-next">
            <p className="learning-eyebrow">Continue learning{currentTopic ? <span> / {currentTopic.topicName}</span> : null}</p>
            <h2>{primary?.title ?? 'Choose a topic to begin'}</h2>
            <p className="learning-description">{hasNextAction ? primary.description : catalogue.length ? 'Your next step starts with a topic.' : 'Reviewed lessons and activities will appear here when they are published.'}</p>
            {focusSkill ? <p className="learning-focus">Current focus: {focusSkill.skillName}</p> : null}
            {hasNextAction ? <Link className="learning-primary" to={primary.route}>{primary.action === 'resume_assessment' ? 'Resume assessment' : primary.action === 'explore_topic' ? 'Explore topic' : 'Continue learning'}<ArrowRight size={16} aria-hidden="true" /></Link>
              : catalogue.length || journey?.topics.some((topic) => topic.contentAvailable) ? <a className="learning-primary" href={catalogue.length ? '#course-content' : '#learning-map-heading'}>Choose a topic <ArrowRight size={16} aria-hidden="true" /></a>
                : <p className="learning-muted learning-notice">No learning action is available yet.</p>}
            {actionSummary || actionsError ? <p className="learning-attention"><a href="#upcoming-actions">{actionsError ? 'Some available actions could not be loaded' : `Also available: ${actionSummary}`}</a></p> : null}
          </div>
          {journey?.topics.length ? <div className="learning-summary" aria-label="Term progress">
            <p><strong>{masteredTopicCount} of {journey.topics.length}</strong> topics mastered</p>
            <progress max={journey.topics.length} value={masteredTopicCount} aria-label={`${masteredTopicCount} of ${journey.topics.length} topics mastered`} />
            <p className="learning-muted">Based on formal assessments</p>
            <a className="learning-text-link" href="#learning-progress" onClick={() => setProgressOpen(true)}>View progress <ArrowRight size={16} aria-hidden="true" /></a>
          </div> : null}
        </section>

        {journey ? <JourneyMap journey={journey} /> : null}

        <section id="course-content" className="learning-section" aria-labelledby="catalogue-heading">
          <div className="learning-section-heading"><h2 id="catalogue-heading">Course content</h2><span className="learning-muted">{catalogue.length} {catalogue.length === 1 ? 'topic' : 'topics'} published</span></div>
          {catalogue.length ? <div className="learning-content-list">{catalogue.map((topic) => <details className="learning-disclosure" key={topic.topicCode}>
            <summary><ChevronDown className="learning-chevron" size={16} aria-hidden="true" /><span className="learning-topic-name">{topic.topicName}<span className="learning-muted">{topic.areaName}</span></span><span className="learning-muted learning-count">{topic.skills.length} {topic.skills.length === 1 ? 'skill' : 'skills'}</span></summary>
            <div className="learning-disclosure-body">
              {topic.topicDescription ? <p className="learning-muted">{topic.topicDescription}</p> : null}
              <ul className="learning-skill-list" aria-label={`${topic.topicName} available skills`}>{topic.skills.map((skill) => <li key={skill.skillCode}><span>{skill.skillName}</span><span className="learning-muted">{skill.hasExplanation ? skill.activityCode ? 'Lesson & practice' : 'Lesson' : skill.activityCode ? 'Practice' : 'Awaiting content'}</span></li>)}</ul>
              <Link className="learning-text-link" to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`}>Open topic <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </details>)}</div> : <p className="learning-muted learning-empty">No reviewed topics have been published yet.</p>}
        </section>

        <section id="upcoming-actions" className="learning-section" aria-labelledby="actions-heading">
          <div className="learning-section-heading"><h2 id="actions-heading">Upcoming actions</h2></div>
          {actionsLoading ? <p className="learning-muted learning-notice" role="status">Checking available assessments and reviews...</p> : null}
          {actionsError ? <div className="learning-error" role="alert"><p>Some assessments or reviews could not be loaded. You can still use the learning content above.</p><button className="learning-text-link" type="button" onClick={() => {
            void assessmentsQuery.refetch();
            void diagnosticsQuery.refetch();
            void retentionQuery.refetch();
          }}>Try again</button></div> : null}
          {!hasActions && !actionsLoading && !actionsError ? <p className="learning-muted learning-empty">No additional actions right now.</p> : null}
          {hasActions ? <ul className="learning-action-list">
            {prerequisite ? <li className="learning-foundation">
              <div><p className="learning-row-label">Grade 8 foundations</p><h3 id="foundation-heading">A useful foundation before your next step</h3><p className="learning-muted">Review this foundation, then return to your Grade 9 topic.</p></div>
              <Link className="learning-text-link" to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(bridgeReturnTopic)}`}>Open the bridge lesson <ArrowRight size={16} aria-hidden="true" /></Link>
              <details className="learning-support-details"><summary>Supporting resources <ChevronDown size={16} aria-hidden="true" /></summary><div>
                {videosQuery.isPending ? <p role="status">Loading videos...</p> : videosQuery.isError ? <p className="learning-error" role="alert">Videos could not be loaded. <button className="learning-text-link" type="button" onClick={() => { void videosQuery.refetch(); }}>Try again</button></p> : prerequisiteVideos.length ? <ul>{prerequisiteVideos.map((video) => <li key={video.resourceCode}><a className="learning-text-link" href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title} <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><span className="learning-muted">{video.channelName}</span></li>)}</ul> : <p className="learning-muted">No supporting videos available.</p>}
                {bridgeReturnTopic ? <Link className="learning-text-link" to={`/dashboard/student/learning/topic/${encodeURIComponent(bridgeReturnTopic)}`}>Return to your Grade 9 topic</Link> : null}
              </div></details>
            </li> : null}
            {assessments.map((assessment) => <li key={assessment.definitionId}>
              <div><p className="learning-row-label">{assessment.assessmentType.replaceAll('_', ' ')}</p><h3>{assessment.name}</h3><p className="learning-muted">{assessment.questionCount} questions · {assessment.durationMinutes} minutes</p></div>
              <Link className="learning-text-link" to={`/dashboard/student/learning/assessment/${encodeURIComponent(assessment.definitionId)}`}>Read instructions <ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {assessment.name}</span></Link>
            </li>)}
            {otherDiagnostics.map((diagnostic) => <li key={diagnostic.code}>
              <div><p className="learning-row-label">Diagnostic</p><h3>{diagnostic.name}</h3><p className="learning-muted">{diagnostic.description}</p><p className="learning-diagnostic-progress">{diagnostic.complete ? <><Check size={16} aria-hidden="true" /> Completed</> : `${diagnostic.completedQuestions} of ${diagnostic.totalQuestions} questions completed`}</p></div>
              <Link className="learning-text-link" to={`/dashboard/student/learning/diagnostic/${encodeURIComponent(diagnostic.code)}`}>{diagnostic.complete ? 'Review completion' : diagnostic.started ? 'Continue diagnostic' : 'Start diagnostic'}<ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {diagnostic.name}</span></Link>
            </li>)}
            {optionalReview ? <li><div><h3>Quick review</h3><p className="learning-muted">Optional practice to revisit what you have learned. No deadline.</p></div><Link className="learning-text-link" to={`/dashboard/student/learning/activity/${encodeURIComponent(dueRetention.activityCode)}?retentionCheck=${encodeURIComponent(dueRetention.retentionCheckId)}`}>Start quick review <ArrowRight size={16} aria-hidden="true" /></Link></li> : null}
          </ul> : null}
        </section>

        <section id="learning-progress" className="learning-section" aria-labelledby="progress-heading">
          <details className="learning-progress-details" open={progressOpen} onToggle={(event) => setProgressOpen(event.currentTarget.open)}>
            <summary><h2 id="progress-heading">Progress</h2><span className="learning-muted">Skill evidence</span><ChevronDown className="learning-chevron" size={16} aria-hidden="true" /></summary>
            <div className="learning-progress-body">
              <p className="learning-muted">Practice builds skill evidence. Topic mastery is recorded through formal assessments.</p>
              {masteryQuery.isPending ? <p className="learning-notice" role="status">Loading skill progress...</p> : masteryQuery.isError ? <div className="learning-error" role="alert"><p>Skill progress could not be loaded.</p><button className="learning-text-link" type="button" onClick={() => { void masteryQuery.refetch(); }}>Try again</button></div> : mastery.length ? <ul className="learning-skill-list">{mastery.map((item) => <li key={item.skillCode}><span>{item.skillName}</span><span className="learning-muted">{item.state.replaceAll('_', ' ')}</span></li>)}</ul> : <p className="learning-muted learning-notice">Your skill progress will appear after you complete learning activities.</p>}
            </div>
          </details>
        </section>
      </div>
    </PageShell>
  );
}
