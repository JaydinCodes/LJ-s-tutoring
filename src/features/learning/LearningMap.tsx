import { ArrowRight, Check, CircleDot, Flag, LockKeyhole, Play, Route, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { LearningJourney, LearningJourneyTopic, LearningJourneyTopicStatus, TopicLearningMap } from './studentLearningRepository';

const TOPIC_STATUS: Record<LearningJourneyTopicStatus, { label: string; icon: typeof CircleDot }> = {
  not_started: { label: 'Ready', icon: Play },
  baseline_available: { label: 'Baseline ready', icon: Flag },
  assessment_in_progress: { label: 'Assessment in progress', icon: Play },
  learning_in_progress: { label: 'In progress', icon: Route },
  ready_for_endline: { label: 'Endline ready', icon: Flag },
  mastery_challenge_available: { label: 'Challenge ready', icon: Sparkles },
  mastered: { label: 'Mastered', icon: Trophy },
  content_unavailable: { label: 'Coming soon', icon: LockKeyhole },
};

function topicStatusCopy(status: LearningJourneyTopicStatus) {
  if (status === 'mastered') return 'Mastered with formal evidence';
  if (status === 'baseline_available') return 'Start with a short baseline';
  if (status === 'assessment_in_progress') return 'Return to your saved assessment';
  if (status === 'learning_in_progress') return 'Continue your learning pathway';
  if (status === 'ready_for_endline') return 'Ready for an endline';
  if (status === 'mastery_challenge_available') return 'Ready for a mastery challenge';
  if (status === 'content_unavailable') return 'Content is being prepared';
  return 'Ready when you are';
}

/** The only topic picker on the learning home: four concise, linked stops. */
export function JourneyMap({ journey }: { journey: LearningJourney }) {
  const currentCode = journey.currentTopic?.topicCode ?? journey.primary.topicCode ?? journey.context.selectedTopicCode;
  return (
    <section aria-labelledby="learning-roadmap-heading" className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Your roadmap</p><h2 id="learning-roadmap-heading" className="mt-1 text-xl font-semibold text-brand-navy dark:text-brand-parchment">Grade 9 Mathematics · Term 1</h2></div>
        <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-brand-marble">Four topics, one connected route. Your next step is always shown above.</p>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Grade 9 Term 1 topics">
        {journey.topics.map((topic, index) => {
          const meta = TOPIC_STATUS[topic.status];
          const Icon = meta.icon;
          const isCurrent = topic.topicCode === currentCode;
          return <li key={topic.topicCode}>
            <Link to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`} aria-current={isCurrent ? 'step' : undefined} className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aegean ${isCurrent ? 'border-brand-gold bg-brand-navy text-white' : 'border-slate-200 bg-slate-50 hover:border-brand-aegean hover:bg-white dark:border-white/10 dark:bg-slate-950/50 dark:hover:bg-slate-900'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${isCurrent ? 'bg-brand-gold text-brand-navy' : 'bg-brand-aegean/10 text-brand-aegean dark:bg-brand-gold/10 dark:text-brand-gold'}`}>{isCurrent ? <CircleDot className="h-4 w-4" aria-hidden="true" /> : index + 1}</span>
              <span className="min-w-0"><span className={`text-xs font-bold uppercase tracking-wide ${isCurrent ? 'text-brand-gold' : 'text-brand-aegean dark:text-brand-gold'}`}>{isCurrent ? 'Current topic' : meta.label}</span><span className="mt-1 block font-semibold">{topic.topicName}</span><span className={`mt-1 block text-xs ${isCurrent ? 'text-brand-marble' : 'text-slate-500 dark:text-brand-marble'}`}>{topicStatusCopy(topic.status)}</span></span>
            </Link>
          </li>;
        })}
      </ol>
    </section>
  );
}

type Checkpoint = { label: string; status: 'available' | 'in_progress' | 'completed' | 'unavailable'; route?: string; copy: string };

function AssessmentCheckpoint({ node }: { node: Checkpoint }) {
  const Icon = node.status === 'completed' ? Check : node.status === 'available' ? Flag : node.status === 'in_progress' ? Play : LockKeyhole;
  const content = <><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${node.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : node.status === 'available' ? 'bg-brand-gold/20 text-amber-900 dark:text-brand-gold' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-brand-marble'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span><span className="font-semibold text-brand-navy dark:text-brand-parchment">{node.label}</span><span className="mt-0.5 block text-sm text-slate-600 dark:text-brand-marble">{node.copy}</span></span></>;
  return node.route && (node.status === 'available' || node.status === 'in_progress')
    ? <Link className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-brand-aegean/30 bg-brand-aegean/5 p-3 transition hover:bg-brand-aegean/10" to={node.route}>{content}<ArrowRight className="h-4 w-4 shrink-0 text-brand-aegean" aria-hidden="true" /></Link>
    : <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/50">{content}</div>;
}

function firstAssessmentRoute(journey: LearningJourney | undefined, topicCode: string, assessmentType: string) {
  if (journey?.primary.topicCode === topicCode && journey.primary.route && ((assessmentType === 'topic_baseline' && journey.primary.action === 'start_baseline') || (assessmentType === 'endline' && journey.primary.action === 'start_endline') || (assessmentType === 'mastery_challenge' && journey.primary.action === 'start_mastery_challenge') || journey.primary.action === 'resume_assessment')) return journey.primary.route;
  return journey?.alternatives.find((item) => item.topicCode === topicCode && item.assessmentType === assessmentType)?.route;
}

function skillStatus(skill: TopicLearningMap['skills'][number]) {
  if (skill.practiceStatus === 'completed') return 'Practice completed';
  if (skill.practiceStatus === 'in_progress') return 'Practice in progress';
  if (skill.activityCode) return 'Lesson and practice ready';
  return skill.lessonAvailable ? 'Lesson ready' : 'Being prepared';
}

/** Compact topic pathway. Full teaching lives in a focused lesson route. */
export function TopicLearningMap({ map, journey, topic }: { map: TopicLearningMap; journey?: LearningJourney; topic?: LearningJourneyTopic | null }) {
  const prerequisite = journey?.prerequisiteRecommendation;
  const returnTopic = prerequisite?.originTopicCode || topic?.topicCode || map.topicCode;
  const baselineRoute = firstAssessmentRoute(journey, map.topicCode, 'topic_baseline');
  const endlineRoute = firstAssessmentRoute(journey, map.topicCode, 'endline');
  const challengeRoute = firstAssessmentRoute(journey, map.topicCode, 'mastery_challenge');
  const challengeAvailable = topic?.status === 'mastery_challenge_available';

  return <section aria-labelledby="topic-pathway-heading" className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Your pathway</p><h2 id="topic-pathway-heading" className="mt-1 text-xl font-semibold text-brand-navy dark:text-brand-parchment">One skill at a time</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-brand-marble">Open a lesson, see one worked example, then move into its linked practice.</p></div>
    <div className="mt-5 space-y-3">
      <AssessmentCheckpoint node={{ label: 'Baseline', status: map.baseline.status, route: baselineRoute, copy: map.baseline.status === 'available' ? 'A short independent starting check is ready.' : map.baseline.status === 'completed' ? 'Your starting evidence is saved.' : map.baseline.status === 'in_progress' ? 'Your answers are saved. Resume when ready.' : 'This opens when it is the right next step.' }} />
      <ol className="space-y-2" aria-label={`${map.topicName} skills`}>
        {map.skills.map((skill, index) => <li key={skill.skillCode} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-aegean/10 text-xs font-bold text-brand-aegean dark:bg-brand-gold/10 dark:text-brand-gold">{index + 1}</span>
          <div className="min-w-0 flex-1"><h3 className="font-semibold text-brand-navy dark:text-brand-parchment">{skill.skillName}</h3><p className="mt-0.5 text-sm text-slate-600 dark:text-brand-marble">{skillStatus(skill)}</p></div>
          {skill.lessonAvailable ? <Link className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand-aegean hover:bg-brand-aegean/10" to={`/dashboard/student/learning/topic/${encodeURIComponent(map.topicCode)}/lesson/${encodeURIComponent(skill.skillCode)}`}>Open <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
        </li>)}
      </ol>
      {prerequisite ? <Link to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(returnTopic)}`} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"><span><span className="font-semibold">Optional Grade 8 support</span><span className="mt-0.5 block text-sm">Use this bridge, then return here.</span></span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link> : null}
      <AssessmentCheckpoint node={{ label: challengeAvailable ? 'Mastery challenge' : 'Endline', status: challengeAvailable ? 'available' : map.endline.status, route: challengeAvailable ? challengeRoute : endlineRoute, copy: challengeAvailable ? 'Your independent challenge is ready.' : map.endline.status === 'available' ? 'You are ready for an independent endline.' : map.endline.status === 'completed' ? 'Your endline evidence is saved.' : 'Your next assessment will appear when eligible.' }} />
    </div>
  </section>;
}
