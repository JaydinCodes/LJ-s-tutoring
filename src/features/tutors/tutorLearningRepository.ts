import { requireSupabase } from '../../lib/supabase/client';

export type LearningReviewQueueItem = {
  reviewId: string; attemptId: string; studentId: string; studentName: string;
  questionPrompt: string; learnerResponse: unknown; confidence: number | null;
  timeSpentSeconds: number | null; hintCount: number; targetSkill: string | null;
  submittedAt: string; explanationCode: string;
};

export type TutorLearningInsights = {
  repeatedMisconceptions: Array<{ studentId: string; studentName: string; skillName: string | null; pattern: string; observedCount: number }>;
  stalledLearners: Array<{ studentId: string; studentName: string; skillName: string; masteryState: string; independentAttempts: number }>;
  hintDependency: Array<{ studentId: string; studentName: string; skillName: string; correctAttempts: number; assistedCorrectAttempts: number }>;
  recentlyImproved: Array<{ studentId: string; studentName: string; skillName: string; previousState: string; currentState: string; determinedAt: string }>;
};

export async function loadTutorLearningInsights(): Promise<TutorLearningInsights> {
  const { data, error } = await requireSupabase().rpc('get_tutor_learning_insights');
  if (error) throw error;
  const value = data as unknown as TutorLearningInsights | null;
  return value ?? { repeatedMisconceptions: [], stalledLearners: [], hintDependency: [], recentlyImproved: [] };
}

export async function loadLearningReviewQueue(): Promise<LearningReviewQueueItem[]> {
  const { data, error } = await requireSupabase().rpc('get_tutor_learning_review_queue');
  if (error) throw error;
  return (data ?? []).map((row) => ({ reviewId: row.review_id, attemptId: row.attempt_id,
    studentId: row.student_id, studentName: row.student_name, questionPrompt: row.question_prompt,
    learnerResponse: row.learner_response, confidence: row.confidence,
    timeSpentSeconds: row.time_spent_seconds, hintCount: Number(row.hint_count),
    targetSkill: row.target_skill, submittedAt: row.submitted_at, explanationCode: row.explanation_code }));
}

export async function reviewLearningAttempt(input: { reviewId: string; outcome: 'correct'|'partially_correct'|'incorrect'; marksAwarded: number; feedbackNote: string }) {
  const { data, error } = await requireSupabase().functions.invoke('evaluate-learning-attempt', { body: {
    p_review_id: input.reviewId, p_outcome: input.outcome,
    p_marks_awarded: input.marksAwarded, p_feedback_note: input.feedbackNote || null,
  } });
  if (error) throw error;
  return data;
}
