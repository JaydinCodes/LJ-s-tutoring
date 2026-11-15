import {
  BookOpen,
  Check,
  CircleDot,
  Flag,
  LockKeyhole,
  Play,
  Route,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import type { LearningJourney, LearningJourneyTopic, LearningJourneyTopicStatus, TopicLearningMap } from './studentLearningRepository';

const TOPIC_STATUS: Record<LearningJourneyTopicStatus, { label: string; detail: string; tone: string; icon: typeof CircleDot }> = {
  not_started: { label: 'Ready to begin', detail: 'Choose this topic when you are ready.', tone: 'border-slate-200 bg-brand-aegean/10 text-brand-aegean', icon: Play },
  baseline_available: { label: 'Assessment available', detail: 'An independent starting check is ready.', tone: 'border-amber-200 bg-brand-gold/10 text-amber-900 dark:text-brand-gold', icon: Flag },
  assessment_in_progress: { label: 'Currently learning', detail: 'You have a saved assessment to resume.', tone: 'border-brand-aegean bg-brand-aegean/15 text-brand-aegean', icon: Play },
  learning_in_progress: { label: 'Needs more practice', detail: 'Continue with the recommended learning step.', tone: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200', icon: Route },
  ready_for_endline: { label: 'Assessment available', detail: 'Your independent endline is ready.', tone: 'border-amber-200 bg-brand-gold/10 text-amber-900 dark:text-brand-gold', icon: Flag },
  mastery_challenge_available: { label: 'Assessment available', detail: 'A mastery challenge is ready for you.', tone: 'border-amber-200 bg-brand-gold/10 text-amber-900 dark:text-brand-gold', icon: Sparkles },
  mastered: { label: 'Mastered', detail: 'Formal evidence has recorded topic mastery.', tone: 'border-slate-200 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200', icon: Trophy },
  content_unavailable: { label: 'Content awaiting publication', detail: 'Reviewed learner content has not been published yet.', tone: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-slate-800 dark:text-brand-marble', icon: LockKeyhole },
};

function MapConnector() {
  return <span aria-hidden="true" className="absolute left-4 top-full h-3 w-0.5 bg-brand-aegean/40 xl:left-auto xl:right-[-0.75rem] xl:top-1/2 xl:h-0.5 xl:w-3" />;
}

export function JourneyMap({ journey }: { journey: LearningJourney }) {
  const reducedMotion = usePrefersReducedMotion();
  const currentCode = journey.currentTopic?.topicCode ?? journey.primary.topicCode ?? journey.context.selectedTopicCode;

  return (
    <section aria-labelledby="learning-map-heading" className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">My learning map</p>
          <h2 id="learning-map-heading" className="mt-1 text-xl font-semibold text-brand-navy dark:text-brand-parchment">Grade 9 Mathematics · Term 1</h2>
        </div>
        <p className="max-w-lg text-sm leading-6 text-slate-600 dark:text-brand-marble">Follow the connected checkpoints. Your map uses saved activity and assessment evidence, not pages you have opened.</p>
      </div>
      <ol className="relative mt-6 grid gap-3 xl:grid-cols-4" aria-label="Grade 9 Term 1 topic map">
        {journey.topics.map((topic, index) => {
          const meta = TOPIC_STATUS[topic.status];
          const Icon = meta.icon;
          const isCurrent = topic.topicCode === currentCode;
          return <li key={topic.topicCode} className="relative min-w-0">
            {index < journey.topics.length - 1 ? <MapConnector /> : null}
            <Link
              to={`/dashboard/student/learning/topic/${encodeURIComponent(topic.topicCode)}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`group relative z-10 flex min-h-32 w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aegean ${isCurrent ? 'border-brand-gold bg-brand-navy text-white shadow-lg' : 'border-slate-200 bg-slate-50 hover:border-brand-aegean hover:bg-white dark:border-white/10 dark:bg-slate-950/50'}`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isCurrent ? 'bg-brand-gold text-brand-navy' : meta.tone}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-bold uppercase tracking-wide ${isCurrent ? 'text-brand-gold' : 'text-brand-aegean'}`}>{isCurrent ? 'Current checkpoint' : `Topic ${index + 1}`}</span>
                <span className="mt-1 block font-semibold">{topic.topicName}</span>
                <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isCurrent ? 'bg-white/15 text-white' : meta.tone}`}>{meta.label}</span>
              </span>
            </Link>
            {isCurrent && !reducedMotion ? <span aria-hidden="true" className="absolute rounded-[1.15rem] border border-brand-gold/30 animate-pulse" style={{ inset: '-0.25rem' }} /> : null}
          </li>;
        })}
      </ol>
      <p className="mt-4 text-xs text-slate-500 dark:text-brand-marble">Choose any topic to see its curriculum skills, available learning steps, and the reason a future step is not ready.</p>
    </section>
  );
}

type AssessmentNode = { label: string; status: 'available' | 'in_progress' | 'completed' | 'unavailable'; route?: string; explanation: string };

function AssessmentCheckpoint({ node }: { node: AssessmentNode }) {
  const Icon = node.status === 'completed' ? Check : node.status === 'available' ? Flag : node.status === 'in_progress' ? Play : LockKeyhole;
  const body = <>
    <span className={`grid h-9 w-9 place-items-center rounded-full ${node.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : node.status === 'available' ? 'bg-brand-gold/20 text-amber-900' : node.status === 'in_progress' ? 'bg-brand-aegean/15 text-brand-aegean' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-brand-marble'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
    <span className="min-w-0"><span className="block font-semibold text-brand-navy dark:text-brand-parchment">{node.label}</span><span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-brand-marble">{node.explanation}</span></span>
  </>;
  return node.route && (node.status === 'available' || node.status === 'in_progress')
    ? <Link to={node.route} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-brand-aegean dark:border-white/10 dark:bg-slate-950/50">{body}</Link>
    : <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/50">{body}</div>;
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

function skillEvidenceLabel(state: string | null) {
  if (!state) return 'No skill evidence yet';
  return state === 'secure' || state === 'retained' ? 'Skill evidence is secure' : `Skill evidence: ${state}`;
}

export function TopicLearningMap({ map, journey, topic }: { map: TopicLearningMap; journey?: LearningJourney; topic?: LearningJourneyTopic | null }) {
  const prerequisite = journey?.prerequisiteRecommendation;
  const returnTopic = prerequisite?.originTopicCode || topic?.topicCode || map.topicCode;
  const baselineRoute = firstAssessmentRoute(journey, map.topicCode, 'topic_baseline');
  const endlineRoute = firstAssessmentRoute(journey, map.topicCode, 'endline');
  const challengeRoute = firstAssessmentRoute(journey, map.topicCode, 'mastery_challenge');
  const challengeAvailable = topic?.status === 'mastery_challenge_available';

  return <section aria-labelledby="topic-roadmap-heading" className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-aegean">Interactive skill map</p><h2 id="topic-roadmap-heading" className="mt-1 text-xl font-semibold text-brand-navy dark:text-brand-parchment">Learn at your own pace through {map.topicName}</h2></div><p className="max-w-md text-sm leading-6 text-slate-600 dark:text-brand-marble">Lessons and practice help you prepare. Only formal assessment evidence can record topic mastery.</p></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <AssessmentCheckpoint node={{ label: 'Baseline assessment', status: map.baseline.status, route: baselineRoute, explanation: map.baseline.status === 'available' ? 'A secure starting check is ready.' : map.baseline.status === 'completed' ? 'Your starting evidence is saved.' : map.baseline.status === 'in_progress' ? 'Resume your saved assessment.' : 'This becomes available through the assessment rules.' }} />
        {prerequisite ? <Link to={`/dashboard/student/learning/bridge/${encodeURIComponent(prerequisite.skillCode)}?returnTopic=${encodeURIComponent(returnTopic)}`} className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 transition dark:border-amber-800 dark:bg-amber-950/20"><span className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200"><Route className="h-4 w-4" aria-hidden="true" /> Helpful Grade 8 detour</span><span className="mt-1 block text-sm leading-5 text-amber-900 dark:text-amber-100">OLA recommends this foundation from your saved evidence. You will return to {map.topicName}.</span></Link> : null}
        <AssessmentCheckpoint node={{ label: challengeAvailable ? 'Mastery challenge' : 'Mastery milestone', status: challengeAvailable ? 'available' : topic?.status === 'mastered' ? 'completed' : 'unavailable', route: challengeRoute, explanation: challengeAvailable ? 'Your independent challenge is ready.' : topic?.status === 'mastered' ? 'Formal evidence has recorded mastery.' : 'This appears only when the assessment rules make it eligible.' }} />
      </div>
      <ol className="relative space-y-3" aria-label={`${map.topicName} curriculum skills`}>
        {map.skills.map((skill, index) => {
          const practiceLabel = skill.practiceStatus === 'completed' ? 'Practice completed' : skill.practiceAttempted ? 'Practice attempted' : skill.activityCode ? 'Practice ready' : 'Practice awaiting publication';
          return <li key={skill.skillCode} className="relative flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
            {index < map.skills.length - 1 ? <span aria-hidden="true" className="absolute w-px bg-brand-aegean/10" style={{ left: '1.5rem', top: '3rem', height: 'calc(100% + 0.75rem)' }} /> : null}
            <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-aegean text-xs font-bold text-white">{index + 1}</span>
            <div className="min-w-0 flex-1"><h3 className="font-semibold text-brand-navy dark:text-brand-parchment">{skill.skillName}</h3><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-brand-marble">{skill.skillDescription}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">{skill.lessonAvailable ? <a href={`#skill-${encodeURIComponent(skill.skillCode)}`} className="rounded-full bg-brand-aegean/10 px-2.5 py-1 text-brand-aegean">Open lesson</a> : <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-brand-marble">Lesson awaiting publication</span>}{skill.activityCode ? <Link to={`/dashboard/student/learning/activity/${encodeURIComponent(skill.activityCode)}`} className="rounded-full bg-brand-gold/20 px-2.5 py-1 text-amber-900 dark:text-brand-gold">{practiceLabel}</Link> : <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-brand-marble">{practiceLabel}</span>}<span className="rounded-full bg-white px-2.5 py-1 text-slate-600 dark:bg-slate-900 dark:text-brand-marble">{skillEvidenceLabel(skill.skillEvidenceState)}</span></div></div>
          </li>;
        })}
      </ol>
    </div>
    <div className="mt-4"><AssessmentCheckpoint node={{ label: 'Endline assessment', status: map.endline.status, route: endlineRoute, explanation: map.endline.status === 'available' ? 'You are eligible for an independent endline.' : map.endline.status === 'completed' ? 'Your endline evidence is saved.' : map.endline.status === 'in_progress' ? 'Resume your saved endline.' : 'Your next eligible assessment will appear here.' }} /></div>
  </section>;
}
