import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, PageShell } from '../../components/dashboard/DashboardDesignSystem';
import { LessonSteps, TopicLearningMap } from './LearningMap';
import { NumberFamiliesExplorer, WorkedExampleVisual } from './NumberFamiliesVisuals';
import { formatLearnerMath, learnerSkillPresentation, learnerTopicDescription, lessonPresentation, type ConceptStep, type WorkedExample } from './studentLearningPresentation';
import { useApprovedLearningVideos, useGrade9LearningTopic, useGrade9Term1LearningJourney, useGrade9Term1TopicLearningMap, useSetGrade9Term1LearningContextMutation } from './studentLearningQueries';
import './student-learning.css';

function WorkedExamples({ examples, skillCode, activeIndex, exampleRoute }: { examples: WorkedExample[]; skillCode: string; activeIndex: number; exampleRoute: string }) {
  const example = examples[activeIndex];
  const [visibleStepCount, setVisibleStepCount] = useState(1);
  useEffect(() => setVisibleStepCount(1), [example.title]);
  const previousRoute = activeIndex > 0 ? `${exampleRoute}&example=${activeIndex - 1}` : null;
  const nextRoute = activeIndex < examples.length - 1 ? `${exampleRoute}&example=${activeIndex + 1}` : null;

  return <div className="learning-worked-examples" aria-label="Worked examples">
    <ol className="learning-example-progress" aria-label={`${examples.length} worked examples`}>
      {examples.map((item, index) => <li aria-current={index === activeIndex ? 'step' : undefined} key={`${skillCode}-${item.title}`}><span>{index + 1}</span><span className="sr-only">{item.title}: {item.subtitle}</span></li>)}
      <li className="learning-example-practice"><span aria-hidden="true">✎</span><span className="sr-only">Your turn</span></li>
    </ol>
    <article className="learning-worked-example" key={`${skillCode}-${example.title}`}>
      <p className="learning-eyebrow">{example.title} <span aria-hidden="true">·</span> {example.subtitle}</p>
      <h3>{example.prompt}</h3>
      {example.setup ? <p className="learning-example-setup">{example.setup}</p> : null}
      <WorkedExampleVisual example={example} />
      <ol className="learning-example-steps" aria-label={`${example.title} reasoning`}>
        {example.steps.slice(0, visibleStepCount).map((item, index) => <li key={`${example.title}-${item.title}`}><span aria-hidden="true">{index + 1}</span><div><h4>{item.title}</h4><p>{item.body}</p></div></li>)}
      </ol>
      {visibleStepCount < example.steps.length ? <button className="learning-secondary" type="button" onClick={() => setVisibleStepCount((count) => Math.min(count + 1, example.steps.length))}>Reveal the next reasoning step</button> : <><p className="learning-example-answer"><strong>Answer</strong>{example.answer}</p>{example.keyIdea ? <p className="learning-example-key-idea"><strong>Key idea</strong>{example.keyIdea}</p> : null}</>}
      <nav className="learning-example-navigation" aria-label="Worked example navigation">
        {previousRoute ? <Link className="learning-text-link" to={previousRoute}><ArrowLeft size={16} aria-hidden="true" /> Previous example</Link> : <span />}
        {nextRoute ? <Link className="learning-primary" to={nextRoute}>Next example <ArrowRight size={16} aria-hidden="true" /></Link> : <p className="learning-example-ready">You have seen the full pattern. Ready to try it?</p>}
      </nav>
    </article>
  </div>;
}

function ConceptSteps({ items }: { items: ConceptStep[] | undefined }) {
  if (!items?.length) return null;

  return <ol className="learning-concept-steps" aria-label="Building the number system">
    {items.map((item, index) => <li key={item.title} style={{ '--concept-depth': item.depth } as CSSProperties}><span aria-hidden="true">{index + 1}</span><div><h4>{item.title}</h4><p>{item.body}</p><p className="learning-concept-example"><strong>Picture it</strong>{item.example}</p></div></li>)}
  </ol>;
}

function NumberSetHierarchy({ items }: { items: NonNullable<ReturnType<typeof lessonPresentation>>['numberHierarchy'] }) {
  if (!items?.length) return null;

  return <section className="learning-number-hierarchy" aria-label="How number sets fit together">
    <p className="learning-eyebrow">How the sets fit together</p>
    <ol>{items.map((item) => <li key={item.label} style={{ '--number-set-depth': item.depth } as CSSProperties}><strong>{item.label}</strong>{item.detail ? <span>{item.detail}</span> : null}</li>)}</ol>
  </section>;
}

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
  const exampleParam = searchParams.get('example');
  const lessonReady = topicQuery.isSuccess && mapQuery.isSuccess && journeyQuery.isSuccess;

  useEffect(() => {
    if (!lessonReady) return;
    window.scrollTo(0, 0);
    if (lesson?.skillCode) lessonHeading.current?.focus({ preventScroll: true });
  }, [topicCode, lesson?.skillCode, step, exampleParam, lessonReady]);

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
  const topicDescription = learnerTopicDescription(topicCode, topic.topicDescription);
  const nextPresentation = nextSkill ? learnerSkillPresentation(topicCode, nextSkill.skillCode, { title: nextSkill.skillName, description: nextSkill.skillDescription }) : null;

  if (lessonCode && !lesson) {
    return <PageShell title={map.topicName} subtitle={subtitle} section="student"><div className="learning-overview"><EmptyState title="This lesson is not available" description="Return to the topic to choose a published lesson." actionLabel="Return to topic" actionHref={topicRoute} /></div></PageShell>;
  }

  if (lesson) {
    const lessonIndex = topic.skills.findIndex((skill) => skill.skillCode === lesson.skillCode);
    const skillVideos = (videosQuery.data ?? []).filter((video) => video.skillCode === lesson.skillCode);
    const presentation = lessonPresentation(lesson.skillCode);
    const exampleCount = presentation?.examples?.length ?? 0;
    const requestedExample = Number(exampleParam);
    const activeExampleIndex = Number.isInteger(requestedExample) && requestedExample >= 0 && requestedExample < exampleCount ? requestedExample : 0;
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

    return <PageShell title={presentation?.learnerTitle ?? lesson.skillName} subtitle={`${map.topicName} · Lesson ${lessonIndex + 1} of ${topic.skills.length}`} section="student">
      <div className="learning-overview learning-lesson">
        <Link className="learning-text-link" to={topicRoute}><ArrowLeft size={16} aria-hidden="true" /> {map.topicName}</Link>
        <LessonSteps stage={step} conceptRoute={conceptRoute} exampleRoute={exampleRoute} practiceRoute={practiceRoute} />
        {lesson.content ? <>
          <section className="learning-reading" aria-labelledby="lesson-content-heading">
            <p className="learning-eyebrow">{step === 'concept' ? 'The idea' : 'See it'}</p>
            <h2 id="lesson-content-heading" ref={lessonHeading} tabIndex={-1}>{step === 'concept' ? presentation?.learnerTitle ?? lesson.content.title : presentation?.examples?.length ? 'Worked examples' : 'Worked example'}</h2>
            {step === 'concept' ? <>
              {presentation?.learnerSummary ? <p className="learning-lesson-objective">{presentation.learnerSummary}</p> : lesson.content.learningObjective ? <p className="learning-lesson-objective">{lesson.content.learningObjective}</p> : null}
              {presentation?.hook ? <aside className="learning-lesson-hook"><h3>{presentation.hook.title}</h3><p>{presentation.hook.body}</p></aside> : null}
              {presentation?.idea ? <><h3 className="learning-idea-heading">{presentation.idea.title}</h3><p className="learning-lesson-copy">{presentation.idea.body}</p><ConceptSteps items={presentation.conceptSteps} />{lesson.skillCode === 'G9-NUM-REAL-IRRATIONAL' ? <NumberFamiliesExplorer /> : <NumberSetHierarchy items={presentation.numberHierarchy} />}</> : <p className="learning-lesson-copy">{formatLearnerMath(lesson.content.explanation)}</p>}
            </> : <>
              {presentation?.examples?.length ? <WorkedExamples activeIndex={activeExampleIndex} exampleRoute={exampleRoute} examples={presentation.examples} skillCode={lesson.skillCode} /> : <div className="learning-worked-example"><p>{formatLearnerMath(lesson.content.workedExample)}</p></div>}
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
            {step === 'concept' ? <Link className="learning-primary" to={`${exampleRoute}&example=0`}>See examples <ArrowRight size={16} aria-hidden="true" /></Link>
              : presentation?.examples?.length && activeExampleIndex < presentation.examples.length - 1 ? <Link className="learning-primary" to={`${exampleRoute}&example=${activeExampleIndex + 1}`}>Next example <ArrowRight size={16} aria-hidden="true" /></Link>
                : practiceRoute ? <Link className="learning-primary" to={practiceRoute}>Move up a level <ArrowRight size={16} aria-hidden="true" /></Link>
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
        <div><h2 id="topic-overview-heading">Topic progress</h2>{topicDescription ? <p className="learning-description">{topicDescription}</p> : null}<p className="learning-topic-completion"><strong>{completedSkills} / {map.skills.length}</strong> skills completed</p><progress max={map.skills.length} value={completedSkills} aria-label={`${completedSkills} of ${map.skills.length} skills completed`} /><p className="learning-muted learning-topic-evidence">Practice helps you build each skill. <strong>Assessments confirm mastery.</strong>{journeyTopic.status === 'mastered' ? ' This topic has been mastered.' : ''}</p></div>
        <button className="learning-secondary" type="button" disabled={setContext.isPending || selectedTopic} onClick={() => setContext.mutate({ topicCode })}>{setContext.isPending ? 'Saving focus...' : selectedTopic ? 'This is my current topic' : 'Make this my current topic'}</button>
        {setContext.isError ? <p className="learning-error" role="alert">Your current topic could not be saved. Please try again.</p> : null}
      </section>
      {recommended ? <section className="learning-topic-next" aria-label="Recommended next action"><p className="learning-eyebrow">Up next</p><h2>{recommended.title}</h2><p className="learning-muted">{recommended.description}</p><Link className="learning-primary" to={recommended.route}>{recommended.action === 'resume_assessment' ? 'Resume assessment' : recommended.action === 'start_baseline' ? 'Start your baseline' : recommended.action === 'start_endline' ? 'Start your endline' : recommended.action === 'start_mastery_challenge' ? 'Open mastery challenge' : 'Continue lesson'}<ArrowRight size={16} aria-hidden="true" /></Link></section>
        : nextSkill && nextPresentation ? <section className="learning-topic-next" aria-label="Next lesson"><p className="learning-eyebrow">{completedSkills === map.skills.length ? 'Revisit a lesson' : 'Up next'}</p><h2>{nextPresentation.title}</h2><p className="learning-muted">{nextPresentation.description}</p><Link className="learning-primary" to={`${topicRoute}?${new URLSearchParams({ lesson: nextSkill.skillCode })}`}>{completedSkills === map.skills.length ? 'Review lesson' : 'Continue lesson'}<ArrowRight size={16} aria-hidden="true" /></Link></section> : null}
      <TopicLearningMap map={map} journey={journey} topic={journeyTopic} />
      {!topic.skills.length ? <div className="learning-empty"><h2>Learning content is being reviewed</h2><p className="learning-muted learning-notice">Lessons and practice will appear when approved content is published.</p></div> : null}
    </div>
  </PageShell>;
}
