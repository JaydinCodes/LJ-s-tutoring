import type { AssignmentSubmission } from '../../types/lms';

export interface AiGradingPrefill {
  marksAwarded: string;
  feedback: string;
  rubricScoresJson: string;
  isAiDraft: boolean;
  aiConfidence: number | null;
}

// Shared by every submission review surface (TutorSubmissionReviewCard,
// AdminAssignmentsRoute's SubmissionReviewCard, AdminResultsRoute's
// MarkEditPanel): once a human has actually marked a submission,
// marks_awarded/feedback/rubric_scores_json win as always. Until then, if
// grade-submission has already produced a draft, prefill the form from it
// instead of leaving it blank -- the human still explicitly reviews and
// saves through the unchanged markSubmission() path; nothing here writes
// anywhere or auto-releases.
export function getAiGradingPrefill(submission: AssignmentSubmission): AiGradingPrefill {
  const hasHumanMark = submission.marks_awarded != null;
  const isAiDraft = !hasHumanMark && submission.ai_marks_awarded != null;

  return {
    marksAwarded: hasHumanMark
      ? String(submission.marks_awarded)
      : isAiDraft
        ? String(submission.ai_marks_awarded)
        : '',
    feedback: hasHumanMark
      ? submission.feedback || ''
      : isAiDraft
        ? submission.ai_feedback || ''
        : '',
    rubricScoresJson: JSON.stringify(
      hasHumanMark
        ? submission.rubric_scores_json || {}
        : isAiDraft
          ? submission.ai_rubric_scores_json || {}
          : {},
      null,
      2,
    ),
    isAiDraft,
    aiConfidence: isAiDraft ? submission.ai_confidence ?? null : null,
  };
}
