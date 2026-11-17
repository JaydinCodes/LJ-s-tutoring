import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell } from '../../components/dashboard/DashboardDesignSystem';
import { LessonSteps, TopicLearningMap } from './LearningMap';
import { useApprovedLearningVideos, useGrade9LearningTopic, useGrade9Term1LearningJourney, useGrade9Term1TopicLearningMap, useSetGrade9Term1LearningContextMutation } from './studentLearningQueries';
import './student-learning.css';

export function StudentLearningTopicRoute() {
  const topicCode = useParams().topicCode ?? '';
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const topicQuery = useGrade9LearningTopic(topicCode);
  const mapQuery = useGrade9Term1TopicLearningMap(topicCode);
  const videosQuery = useApprovedLearningVideos();
  const journeyQuery = useGrade9Term1LearningJourney();
  const setContext = useSetGrade9Term1LearningContextMutation();
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const lessonCode = searchParams.get('lesson');
  const lesson = topicQuery.data?.skills.find((skill) => lessonCode
    ? skill.skillCode === lessonCode
    : location.hash === `#skill-${encodeURIComponent(skill.skillCode)}`);
  const step = searchParams.get('step') === 'example' ? 'example' : 'concept';
  const lessonReady = topicQuery.isSuccess && mapQuery.isSuccess && journeyQuery.isSuccess;

  useEffect(() => {
    if (!lessonReady) return;
    window.scrollTo(0, 0);
    if (lesson?.skillCode) lessonHeading.current?.focus({ preventScroll: true });
  }, [topicCode, lesson?.skillCode, step, lessonReady]);

  const subtitle = 'Grade 9 Mathematics · Term 1';
  if (topicQuery.isPending || mapQuery.isPending || journeyQuery.isPending) {
    return <PageShell title="Learning topic" subtitle={subtitle} section="student"><div className="learning-overview" role="status" aria-busy="true"><span className="sr-only">Loading your topic...</span><div className="learning-placeholder" aria-hidden="true" /></div></PageShell>;
  }
  if (topicQuery.isError || mapQuery.isError || journeyQuery.isError) {
    return <PageShell title="Learning topic" subtitle={subtitle} section="student"><ErrorState title="Topic could not be loaded" description="Check your connection and try again." onRetry={() => { void topicQuery.refetch(); void mapQuery.refetch(); void journeyQuery.refetch(); }} /></PageShell>;
  }

  const topic = topicQuery.data;
  const map = mapQuery.data;
  const journey = journeyQuery.data;
  const journeyTopic = journey?.topics.find((item) => item.topicCode === topicCode);
  if (!topic || !journeyTopic || !map) {
    return <PageShell title="Learning topic" subtitle={subtitle} section="student"><div className="learning-overview"><EmptyState title="This topic is not ready yet" description="Reviewed content for this topic is not available." actionLabel="Back to Learning" actionHref="/dashboard/student/learning" /></div></PageShell>;
  }

  const topicRoute = `/dashboard/student/learning/topic/${encodeURIComponent(topicCode)}`;
  const nextSkill = map.skills.find((skill) => skill.practiceStatus !== 'completed' && topic.skills.some((item) => item.skillCode === skill.skillCode && item.content))
    ?? map.skills.find((skill) => topic.skills.some((item) => item.skillCode === skill.skillCode && item.content));
  const recommended = journey?.primary.topicCode === topicCode && journey.primary.action !== 'explore_topic' ? journey.primary : null;
  const completedSkills = map.skills.filter((skill) => skill.practiceStatus === 'completed').length;
  const selectedTopic = journey?.context.selectedTopicCode === topicCode;

  if (lessonCode && !lesson) {
    return <PageShell title={map.topicName} subtitle={subtitle} section="student"><div className="learning-overview"><EmptyState title="This lesson is not available" description="Return to the topic to choose a published lesson." actionLabel="Return to topic" actionHref={topicRoute} /></div></PageShell>;
  }

  if (lesson) {
    const lessonIndex = topic.skills.findIndex((skill) => skill.skillCode === lesson.skillCode);
    const skillVideos = (videosQuery.data ?? []).filter((video) => video.skillCode === lesson.skillCode);
    const exampleSteps = lesson.content?.workedExample
      ? Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(lesson.content.workedExample), ({ segment }) => segment.trim()).filter(Boolean)
      : [];
    const lessonParams = new URLSearchParams({ lesson: lesson.skillCode });
    const retentionCheck = searchParams.get('retentionCheck');
    if (retentionCheck) lessonParams.set('retentionCheck', retentionCheck);
    const practiceQuestion = searchParams.get('question');
    if (practiceQuestion) lessonParams.set('question', practiceQuestion);
    const conceptRoute = `${topicRoute}?${lessonParams}`;
    const exampleRoute = `${conceptRoute}&step=example`;
    const practiceParams = new URLSearchParams({ topic: topicCode, skill: lesson.skillCode });
    if (retentionCheck) practiceParams.set('retentionCheck', retentionCheck);
    if (practiceQuestion) practiceParams.set('question', practiceQuestion);
    const practiceRoute = lesson.activityCode ? `/dashboard/student/learning/activity/${encodeURIComponent(lesson.activityCode)}?${practiceParams}` : undefined;

    return <PageShell title={lesson.skillName} subtitle={`${map.topicName} · Lesson ${lessonIndex + 1} of ${topic.skills.length}`} section="student">
      <div className="learning-overview learning-lesson">
        <Link className="learning-text-link" to={topicRoute}><ArrowLeft size={16} aria-hidden="true" /> {map.topicName}</Link>
        <LessonSteps stage={step} conceptRoute={conceptRoute} exampleRoute={exampleRoute} practiceRoute={practiceRoute} />
        {lesson.content ? <>
          <section className="learning-reading" aria-labelledby="lesson-content-heading">
            <p className="learning-eyebrow">{step === 'concept' ? 'Understand the idea' : 'Follow the reasoning'}</p>
            <h2 id="lesson-content-heading" ref={lessonHeading} tabIndex={-1}>{step === 'concept' ? lesson.content.title : 'Worked example'}</h2>
            {step === 'concept' ? <>
              {lesson.content.learningObjective ? <p className="learning-lesson-objective">{lesson.content.learningObjective}</p> : null}
              <p className="learning-lesson-copy">{lesson.content.explanation}</p>
            </> : <>
              <div className="learning-worked-example"><ol className="learning-example-steps" aria-label="Worked example reasoning">{exampleSteps.map((text, index) => <li key={`${lesson.skillCode}-${index}`}><span aria-hidden="true">{index + 1}</span><p>{text}</p></li>)}</ol></div>
              {lesson.content.commonMisconception ? <aside className="learning-useful-check"><h3>A useful check</h3><p>{lesson.content.commonMisconception}</p></aside> : null}
            </>}
          </section>
          <details className="learning-lesson-resources">
            <summary>Videos & resources <ChevronDown size={16} aria-hidden="true" /></summary>
            <div className="learning-resource-list">
              {lesson.content.videoUrl ? <a className="learning-text-link" href={lesson.content.videoUrl} target="_blank" rel="noreferrer">Watch the reviewed lesson <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : null}
              {skillVideos.map((video) => <div key={video.resourceCode}><a className="learning-text-link" href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title}<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><p className="learning-muted">{video.channelName}</p></div>)}
              {videosQuery.isPending ? <p role="status">Loading videos...</p> : videosQuery.isError ? <p className="learning-muted">Optional videos could not be loaded. <button className="learning-text-link" type="button" onClick={() => { void videosQuery.refetch(); }}>Try again</button></p> : !lesson.content.videoUrl && !skillVideos.length ? <p className="learning-muted">No additional videos for this lesson.</p> : null}
              {lesson.content.worksheetUrl ? <div><a className="learning-text-link" href={lesson.content.worksheetUrl} target="_blank" rel="noreferrer">Open permitted worksheet <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><p className="learning-muted">{lesson.content.worksheetPermissionNote}</p></div> : null}
            </div>
          </details>
          <nav className="learning-lesson-footer" aria-label="Lesson navigation">
            <Link className="learning-text-link" to={step === 'example' ? conceptRoute : topicRoute}><ArrowLeft size={16} aria-hidden="true" />{step === 'example' ? 'Back to the idea' : 'Topic overview'}</Link>
            {step === 'concept' ? <Link className="learning-primary" to={exampleRoute}>See worked example <ArrowRight size={16} aria-hidden="true" /></Link>
              : practiceRoute ? <Link className="learning-primary" to={practiceRoute}>Try it yourself <ArrowRight size={16} aria-hidden="true" /></Link>
                : <div><p className="learning-muted">Practice is awaiting publication.</p><Link className="learning-text-link" to={topicRoute}>Return to topic <ArrowRight size={16} aria-hidden="true" /></Link></div>}
          </nav>
        </> : <div><h2 ref={lessonHeading} tabIndex={-1}>This lesson is being reviewed</h2><p className="learning-muted learning-notice">The explanation will appear when it has been approved.</p>{practiceRoute ? <Link className="learning-primary" to={practiceRoute}>Open available practice <ArrowRight size={16} aria-hidden="true" /></Link> : null}</div>}
      </div>
    </PageShell>;
  }

  return <PageShell title={map.topicName} subtitle={subtitle} section="student">
    <div className="learning-overview">
      <Link className="learning-text-link" to="/dashboard/student/learning"><ArrowLeft size={16} aria-hidden="true" /> All learning topics</Link>
      <section className="learning-topic-intro" aria-labelledby="topic-overview-heading">
        <div><h2 id="topic-overview-heading">About this topic</h2>{topic.topicDescription ? <p className="learning-description">{topic.topicDescription}</p> : null}<p className="learning-muted learning-notice">{completedSkills} of {map.skills.length} skills practised{journeyTopic.status === 'mastered' ? ' · Topic mastered through formal assessment' : ''}</p></div>
        <button className="learning-secondary" type="button" disabled={setContext.isPending || selectedTopic} onClick={() => setContext.mutate({ topicCode })}>{setContext.isPending ? 'Saving focus...' : selectedTopic ? 'This is my current topic' : 'Make this my current topic'}</button>
        {setContext.isError ? <p className="learning-error" role="alert">Your current topic could not be saved. Please try again.</p> : null}
      </section>
      {recommended ? <section className="learning-topic-next" aria-label="Recommended next action"><p className="learning-eyebrow">Next step</p><h2>{recommended.title}</h2><p className="learning-muted">{recommended.description}</p><Link className="learning-primary" to={recommended.route}>{recommended.action === 'resume_assessment' ? 'Resume assessment' : recommended.action === 'start_baseline' ? 'Start your baseline' : recommended.action === 'start_endline' ? 'Start your endline' : recommended.action === 'start_mastery_challenge' ? 'Open mastery challenge' : 'Continue learning'}<ArrowRight size={16} aria-hidden="true" /></Link></section>
        : nextSkill ? <section className="learning-topic-next" aria-label="Next lesson"><p className="learning-eyebrow">{completedSkills === map.skills.length ? 'Revisit a lesson' : 'Next lesson'}</p><h2>{nextSkill.skillName}</h2><Link className="learning-primary" to={`${topicRoute}?${new URLSearchParams({ lesson: nextSkill.skillCode })}`}>{completedSkills === map.skills.length ? 'Review lesson' : 'Start lesson'}<ArrowRight size={16} aria-hidden="true" /></Link></section> : null}
      <TopicLearningMap map={map} journey={journey} topic={journeyTopic} />
      {!topic.skills.length ? <div className="learning-empty"><h2>Learning content is being reviewed</h2><p className="learning-muted learning-notice">Lessons and practice will appear when approved content is published.</p></div> : null}
    </div>
  </PageShell>;
}