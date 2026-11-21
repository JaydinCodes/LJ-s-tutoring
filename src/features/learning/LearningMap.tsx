import { AlertCircle, ArrowRight, Check, Circle, CircleDot, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { LearningJourney, LearningJourneyTopic, LearningJourneyTopicStatus, TopicLearningMap } from './studentLearningRepository';
import { learnerSkillPresentation } from './studentLearningPresentation';

const TOPIC_STATUS: Record<LearningJourneyTopicStatus, string> = {
  not_started: 'Available',
  baseline_available: 'Assessment ready',
  assessment_in_progress: 'Assessment in progress',
  learning_in_progress: 'Learning in progress',
  ready_for_endline: 'Assessment ready',
  mastery_challenge_available: 'Challenge ready',
  mastered: 'Completed',
  content_unavailable: 'Not yet available',
};

function topicState(topic: LearningJourneyTopic, isCurrent: boolean) {
  if (topic.status === 'mastered') return { label: 'Completed', className: 'is-complete', icon: <Check size={16} aria-hidden="true" /> };
  if (topic.status === 'content_unavailable') return { label: 'Locked', className: 'is-unavailable', icon: <LockKeyhole size={16} aria-hidden="true" /> };
  if (isCurrent) return { label: "You're here", className: 'is-current', icon: <CircleDot size={16} aria-hidden="true" /> };
  if (topic.status === 'baseline_available' || topic.status === 'assessment_in_progress' || topic.status === 'ready_for_endline' || topic.status === 'mastery_challenge_available') {
    return { label: TOPIC_STATUS[topic.status], className: 'needs-attention', icon: <AlertCircle size={16} aria-hidden="true" /> };
  }
  return { label: TOPIC_STATUS[topic.status], className: 'is-available', icon: <Circle size={16} aria-hidden="true" /> };
}

export function JourneyMap({ journey }: { journey: LearningJourney }) {
  const currentCode = journey.currentTopic?.topicCode ?? journey.primary.topicCode ?? journey.context.selectedTopicCode;

  return (
    <section id="learning-path" aria-labelledby="learning-map-heading" className="learning-section">
      <div className="learning-section-heading"><h2 id="learning-map-heading">Your learning path</h2><span className="learning-muted">Grade 9 Mathematics · Term 1</span></div>
      <ol className="learning-journey" aria-label="Grade 9 Term 1 topic map">
        {journey.topics.map((topic, index) => {
          const isCurrent = topic.topicCode === currentCode;
          const state = topicState(topic, isCurrent);
          return <li key={topic.topicCode}>
            <Link
              to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`learning-journey-link ${state.className}`}
            >
              <span className="learning-step-number">{state.icon}<span className="sr-only">{`${index + 1}. `}</span></span>
              <span className="learning-step-copy"><span className="learning-step-name">{topic.topicName}</span><span className="learning-step-state">{state.label}</span></span>
            </Link>
          </li>;
        })}
      </ol>
      {!journey.topics.length ? <p className="learning-muted learning-empty">Your learning path will appear when topics are published.</p> : null}
    </section>
  );
}

type AssessmentNode = { label: string; status: 'available' | 'in_progress' | 'completed' | 'unavailable'; route?: string; explanation: string };

function AssessmentCheckpoint({ node }: { node: AssessmentNode }) {
  const body = <>
    <span className="learning-topic-milestone-title">{node.status === 'completed' ? <Check size={16} aria-hidden="true" /> : null}{node.label}</span>
    <span className="learning-muted">{node.explanation}</span>
  </>;
  return node.route && (node.status === 'available' || node.status === 'in_progress')
    ? <Link to={node.route} className="learning-topic-milestone">{body}<ArrowRight size={16} aria-hidden="true" /></Link>
    : <div className="learning-topic-milestone">{body}</div>;
}

function firstAssessmentRoute(journey: LearningJourney | undefined, topicCode: string, assessmentType: string) {
  if (journey?.primary.topicCode === topicCode && journey.primary.route && (
    (assessmentType === 'topic_baseline' && journey.primary.action === 'start_baseline')
    || (assessmentType === 'endline' && journey.primary.action === 'start_endline')
    || (assessmentType === 'mastery_challenge' && journey.primary.action === 'start_mastery_challenge')
    || journey.primary.action === 'resume_assessment'
  )) return journey.primary.route;
  return journey?.alternatives.find((item) => item.topicCode === topicCode && item.assessmentType === assessmentType)?.route;
}

export function TopicLearningMap({ map, journey, topic }: { map: TopicLearningMap; journey?: LearningJourney; topic?: LearningJourneyTopic | null }) {
  const prerequisite = journey?.prerequisiteRecommendation;
  const returnTopic = prerequisite?.originTopicCode || topic?.topicCode || map.topicCode;
  const baselineRoute = firstAssessmentRoute(journey, map.topicCode, 'topic_baseline');
  const endlineRoute = firstAssessmentRoute(journey, map.topicCode, 'endline');
  const challengeRoute = firstAssessmentRoute(journey, map.topicCode, 'mastery_challenge');
  const challengeAvailable = topic?.status === 'mastery_challenge_available';

  const topicRoute = `/dashboard/student/learning/topic/${encodeURIComponent(map.topicCode)}`;
  const currentSkill = map.skills.find((skill) => skill.practiceStatus !== 'completed' && (skill.lessonAvailable || skill.activityCode));

  return <section aria-labelledby="topic-roadmap-heading" className="learning-section learning-topic-path">
    <div className="learning-section-heading"><h2 id="topic-roadmap-heading">Your learning path</h2><span className="learning-muted">{map.skills.length} skills</span></div>
    <p className="learning-path-start">Start</p>
    <AssessmentCheckpoint node={{ label: 'Baseline assessment', status: map.baseline.status, route: baselineRoute, explanation: map.baseline.status === 'available' ? 'Find your starting point.' : map.baseline.status === 'completed' ? 'Your starting evidence is saved.' : map.baseline.status === 'in_progress' ? 'Resume your saved assessment.' : 'Not available yet.' }} />
    {prerequisite ? <Link to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(returnTopic)}`} className="learning-topic-foundation"><span className="learning-text-link">Helpful Grade 8 detour <ArrowRight size={16} aria-hidden="true" /></span><span className="learning-muted">Review this foundation, then return to {map.topicName}.</span></Link> : null}
    <ol className="learning-topic-journey" aria-label={`${map.topicName} curriculum skills`}>
        {map.skills.map((skill, index) => {
          const presentation = learnerSkillPresentation(map.topicCode, skill.skillCode, { title: skill.skillName, description: skill.skillDescription });
          const practiceLabel = skill.practiceStatus === 'completed' ? 'Completed' : skill.practiceStatus === 'in_progress' || skill.practiceAttempted ? 'In progress' : 'Not started';
          const lessonRoute = `${topicRoute}?${new URLSearchParams({ lesson: skill.skillCode })}`;
          const isCurrent = skill.skillCode === currentSkill?.skillCode;
          return <li key={skill.skillCode} aria-current={skill.skillCode === currentSkill?.skillCode ? 'step' : undefined}>
            <span className="learning-topic-step" aria-hidden="true">{skill.practiceStatus === 'completed' ? <Check size={16} /> : index + 1}</span>
            <div className="learning-topic-skill"><h3>{skill.lessonAvailable ? <Link to={lessonRoute}>{presentation.title}</Link> : presentation.title}</h3><p className="learning-muted">{presentation.description}</p><p className="learning-topic-status">{practiceLabel}</p></div>
            <div className="learning-topic-skill-action">{isCurrent && skill.lessonAvailable ? <Link className="learning-text-link" to={lessonRoute}>{skill.practiceStatus === 'completed' ? 'Review' : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></Link> : isCurrent && skill.activityCode ? <Link className="learning-text-link" to={`/dashboard/student/learning/activity/${encodeURIComponent(skill.activityCode)}?${new URLSearchParams({ topic: map.topicCode, skill: skill.skillCode })}`}>Continue<ArrowRight size={16} aria-hidden="true" /></Link> : !skill.lessonAvailable && !skill.activityCode ? <span className="learning-muted">Awaiting content</span> : null}</div>
          </li>;
        })}
    </ol>
    <AssessmentCheckpoint node={{ label: challengeAvailable ? 'Mastery challenge' : 'Mastery milestone', status: challengeAvailable ? 'available' : topic?.status === 'mastered' ? 'completed' : 'unavailable', route: challengeRoute, explanation: challengeAvailable ? 'Your independent challenge is ready.' : topic?.status === 'mastered' ? 'Formal evidence has recorded mastery.' : 'Available when your assessment evidence makes it eligible.' }} />
    <AssessmentCheckpoint node={{ label: 'Endline assessment', status: map.endline.status, route: endlineRoute, explanation: map.endline.status === 'available' ? 'Your independent endline is ready.' : map.endline.status === 'completed' ? 'Your endline evidence is saved.' : map.endline.status === 'in_progress' ? 'Resume your saved endline.' : 'Available when you are eligible.' }} />
    <p className="learning-muted learning-notice">Practice builds skills. Only formal assessments record topic mastery.</p>
  </section>;
}

export function LessonSteps({ stage, conceptRoute, exampleRoute, practiceRoute }: { stage: 'concept' | 'example' | 'practice' | 'feedback'; conceptRoute?: string; exampleRoute?: string; practiceRoute?: string }) {
  const steps = [
    { id: 'concept', label: 'The idea', route: conceptRoute },
    { id: 'example', label: 'See it', route: exampleRoute },
    { id: 'practice', label: 'Your turn', route: practiceRoute },
    { id: 'feedback', label: 'Feedback' },
  ];
  return <nav aria-label="Lesson steps"><ol className="learning-lesson-steps">{steps.map((step, index) => <li key={step.id} aria-current={stage === step.id ? 'step' : undefined}>{step.route ? <Link to={step.route}><span aria-hidden="true">{index + 1}</span>{step.label}</Link> : <span><span aria-hidden="true">{index + 1}</span>{step.label}</span>}</li>)}</ol></nav>;
}
