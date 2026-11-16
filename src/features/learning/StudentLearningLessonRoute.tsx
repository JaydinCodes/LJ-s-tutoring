import { ArrowLeft, BookOpen, ExternalLink, Lightbulb, PlayCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { FocusedLessonSection, LessonStartLink, WorkedExample } from './LearningExperienceDesignSystem';
import { useApprovedLearningVideos, useGrade9LearningTopic } from './studentLearningQueries';

/** A single-skill teaching space; the topic route deliberately stays a pathway. */
export function StudentLearningLessonRoute() {
  const topicCode = useParams().topicCode ?? '';
  const skillCode = useParams().skillCode ?? '';
  const topicQuery = useGrade9LearningTopic(topicCode);
  const videosQuery = useApprovedLearningVideos();
  const returnTo = `/dashboard/student/learning/topic/${encodeURIComponent(topicCode)}`;

  if (topicQuery.isPending) return <PageShell title="Lesson" subtitle="Preparing your lesson." section="student"><SkeletonCard className="min-h-80" /></PageShell>;
  if (topicQuery.isError) return <PageShell title="Lesson" subtitle="Grade 9 Mathematics" section="student"><ErrorState title="Lesson could not be loaded" description="Check your connection and try again." onRetry={() => void topicQuery.refetch()} /></PageShell>;

  const topic = topicQuery.data;
  const skill = topic?.skills.find((item) => item.skillCode === skillCode);
  if (!topic || !skill?.content) return <PageShell title="Lesson" subtitle="Grade 9 Mathematics" section="student"><EmptyState icon={BookOpen} title="This lesson is not ready yet" description="Only reviewed lessons can be opened here." actionLabel="Return to topic" actionHref={returnTo} /></PageShell>;

  const videos = (videosQuery.data ?? []).filter((video) => video.skillCode === skillCode);
  return <PageShell title="Lesson" subtitle={topic.topicName} section="student">
    <article className="mx-auto max-w-3xl space-y-5">
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-slate-700 hover:text-brand-aegean dark:text-brand-marble" to={returnTo}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {topic.topicName}</Link>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-aegean">Lesson</p><h1 className="mt-2 font-display text-3xl font-semibold text-brand-navy dark:text-brand-parchment sm:text-4xl">{skill.content.title}</h1>{skill.content.learningObjective ? <p className="mt-3 text-lg leading-7 text-slate-700 dark:text-slate-200">{skill.content.learningObjective}</p> : <p className="mt-3 leading-7 text-slate-600 dark:text-brand-marble">{skill.skillDescription}</p>}</header>

      <FocusedLessonSection title="Understand" icon={<BookOpen className="h-5 w-5 text-brand-aegean" aria-hidden="true" />}>
        <p className="whitespace-pre-line leading-7">{skill.content.explanation}</p>
      </FocusedLessonSection>
      <WorkedExample>{skill.content.workedExample}</WorkedExample>

      {skill.activityCode ? <FocusedLessonSection title="Try it yourself" icon={<Lightbulb className="h-5 w-5 text-brand-aegean" aria-hidden="true" />} tone="quiet"><p className="mb-4 leading-7">Practise this one skill with immediate, useful feedback. Your work is saved if you leave and return.</p><LessonStartLink to={`/dashboard/student/learning/activity/${encodeURIComponent(skill.activityCode)}`} label="Start practice" /></FocusedLessonSection> : <FocusedLessonSection title="Try it yourself" tone="quiet"><p className="leading-7">Practice will appear here after its questions are approved.</p></FocusedLessonSection>}

      {(skill.content.commonMisconception || skill.content.videoUrl || skill.content.worksheetUrl || videos.length) ? <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><summary className="cursor-pointer font-semibold text-brand-navy marker:text-brand-aegean dark:text-brand-parchment">More support</summary><div className="mt-4 space-y-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
        {skill.content.commonMisconception ? <p><span className="font-semibold">A useful check: </span>{skill.content.commonMisconception}</p> : null}
        {skill.content.videoUrl ? <a className="inline-flex items-center gap-2 font-semibold text-brand-aegean underline-offset-4 hover:underline" href={skill.content.videoUrl} target="_blank" rel="noreferrer"><PlayCircle className="h-4 w-4" aria-hidden="true" /> Optional video lesson <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
        {videos.map((video) => <a className="block rounded-xl bg-slate-50 p-3 font-semibold text-brand-navy hover:bg-slate-100 dark:bg-slate-950/50 dark:text-brand-parchment" href={video.youtubeUrl} key={video.resourceCode} target="_blank" rel="noreferrer">{video.title}<span className="mt-1 block text-xs font-normal text-slate-500 dark:text-brand-marble">{video.channelName} · Watch on YouTube</span></a>)}
        {skill.content.worksheetUrl ? <p><a className="font-semibold text-brand-aegean underline-offset-4 hover:underline" href={skill.content.worksheetUrl} target="_blank" rel="noreferrer">Open worksheet <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></a>{skill.content.worksheetPermissionNote ? <span className="block text-xs text-slate-500 dark:text-brand-marble">{skill.content.worksheetPermissionNote}</span> : null}</p> : null}
      </div></details> : null}
    </article>
  </PageShell>;
}
