import { Navigate, useParams } from 'react-router-dom';

/**
 * Keep old deep links working while the topic route owns the single lesson
 * experience. Maintaining two renderers caused learner-facing wording and
 * teaching flow to drift apart.
 */
export function StudentLearningLessonRoute() {
  const topicCode = useParams().topicCode ?? '';
  const skillCode = useParams().skillCode ?? '';

  if (!topicCode || !skillCode) return <Navigate replace to="/dashboard/student/learning" />;

  const route = `/dashboard/student/learning/topic/${encodeURIComponent(topicCode)}?${new URLSearchParams({ lesson: skillCode })}`;
  return <Navigate replace to={route} />;
}
