import type { FormEvent } from 'react';
import { useState } from 'react';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { InlineFeedback } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { captureAppError } from '../../lib/monitoring/errorReporting';
import { toUserFacingError } from '../../lib/utils/errors';
import { formatDate } from '../../lib/utils/format';
import type { AssignmentSubmission } from '../../types/lms';
import { getAiGradingPrefill } from '../assignments/aiGradingPrefill';
import { markSubmission } from '../assignments/assignmentMutations';
import { addLearningAction, parseCriteria, parseLearningAction, type LearningActionType } from '../assignments/learningEvidence';

export function TutorSubmissionReviewCard({
  submission,
  onSaved,
}: {
  submission: AssignmentSubmission & { assignment_title?: string; student_label?: string; assignment_rubric?: unknown };
  onSaved: () => Promise<void>;
}) {
  const aiPrefill = getAiGradingPrefill(submission);
  const [marksAwarded, setMarksAwarded] = useState(aiPrefill.marksAwarded);
  const [feedback, setFeedback] = useState(aiPrefill.feedback);
  const [rubricScoresJson, setRubricScoresJson] = useState(aiPrefill.rubricScoresJson);
  const criteria = parseCriteria(submission.assignment_rubric);
  const initialScores = safeScoreMap(aiPrefill.rubricScoresJson);
  const [criterionScores, setCriterionScores] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((criterion) => [criterion.id, String(initialScores[criterion.id] ?? '')])));
  const savedAction = parseLearningAction(submission.rubric_scores_json);
  const [strengths, setStrengths] = useState(savedAction?.strengths || '');
  const [fixNext, setFixNext] = useState(savedAction?.fixNext || '');
  const [actionType, setActionType] = useState<LearningActionType>(savedAction?.actionType || 'practice');
  const [actionDetail, setActionDetail] = useState(savedAction?.actionDetail || '');
  const [actionDueDate, setActionDueDate] = useState(savedAction?.dueDate || '');
  const [allowResubmission, setAllowResubmission] = useState(Boolean(savedAction?.allowResubmission));
  const [marksReleased, setMarksReleased] = useState(Boolean(submission.marks_released));
  const [feedbackReleased, setFeedbackReleased] = useState(Boolean(submission.feedback_released));
  const [status, setStatus] = useState<'submitted' | 'marked' | 'returned'>(
    submission.status === 'marked' || submission.status === 'returned' ? submission.status : 'marked',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      let scores: Record<string, unknown> = {};
      try { scores = rubricScoresJson.trim() ? JSON.parse(rubricScoresJson) as Record<string, unknown> : {}; } catch { throw new Error('The rubric scores could not be read. Use the simple criterion values or clear the field.'); }
      for (const criterion of criteria) {
        const value = criterionScores[criterion.id]?.trim();
        if (!value) continue;
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > criterion.maxMarks) throw new Error(`${criterion.label} must be between 0 and ${criterion.maxMarks}.`);
        scores[criterion.id] = numeric;
      }
      await markSubmission({ submissionId: submission.id, marksAwarded, feedback, status, rubricScoresJson: JSON.stringify(addLearningAction(scores, { strengths, fixNext, actionType, actionDetail, dueDate: actionDueDate || undefined, allowResubmission })), marksReleased, feedbackReleased });
      setMessage('Submission review saved.');
      await onSaved();
    } catch (err) {
      captureAppError(err, {
        featureArea: 'tutor',
        action: 'submission_review.save_failed',
        role: 'tutor',
        metadata: {
          submission_id: submission.id,
          status,
          marks_released: marksReleased,
          feedback_released: feedbackReleased,
        },
      });
      setError(toUserFacingError(err));
    } finally {
      setBusy(false);
    }
  }

  function updateCriterionScore(criterionId: string, value: string) {
    const next = { ...criterionScores, [criterionId]: value };
    setCriterionScores(next);
    const awarded = criteria.reduce((total, criterion) => total + Math.min(criterion.maxMarks, Math.max(0, Number(next[criterion.id]) || 0)), 0);
    const available = criteria.reduce((total, criterion) => total + criterion.maxMarks, 0);
    if (available > 0) setMarksAwarded((awarded / available * 100).toFixed(1));
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{submission.assignment_title || submission.assignment_id}</h3>
          <p className="mt-1 text-sm text-slate-600">{submission.student_label || submission.student_id}</p>
        </div>
        <StatusBadge value={submission.status === 'returned' ? 'returned_for_correction' : submission.status === 'submitted' ? 'under_review' : submission.status} />
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-600">
        <div><dt className="font-semibold text-slate-800">Submitted</dt><dd>{formatDate(submission.submitted_at)}</dd></div>
        {submission.file_url ? <div><dt className="font-semibold text-slate-800">File</dt><dd><a className="break-all text-xs font-semibold text-brand-aegean hover:text-brand-gold" href={submission.file_url} rel="noreferrer" target="_blank">Open submitted file</a></dd></div> : null}
        {submission.text_answer ? <div><dt className="font-semibold text-slate-800">Answer</dt><dd className="rounded-lg bg-slate-50 p-3">{submission.text_answer}</dd></div> : null}
      </dl>
      {aiPrefill.isAiDraft ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          AI-suggested draft{aiPrefill.aiConfidence != null ? ` (confidence ${aiPrefill.aiConfidence}%)` : ''} -- review before releasing.
        </p>
      ) : null}
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Marks awarded">
            <TextInput type="number" min="0" max="100" step="0.01" value={marksAwarded} onChange={(event) => setMarksAwarded(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'submitted' | 'marked' | 'returned')}>
              <option value="marked">Marked</option>
              <option value="returned">Returned for correction</option>
              <option value="submitted">Under review</option>
            </select>
          </FormField>
        </div>
        <FormField label="Feedback">
          <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback for the learner..." />
        </FormField>
        {criteria.length ? <fieldset className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3"><legend className="px-1 text-sm font-semibold text-slate-900">Criteria and evidence</legend>{criteria.map((criterion) => <div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem]" key={criterion.id}><div><p className="font-semibold text-slate-900">{criterion.label}</p><p className="text-xs text-slate-600">{[criterion.topic, criterion.cognitiveLevel].filter(Boolean).join(' · ') || 'Assessment criterion'}</p></div><FormField label={`${criterion.label} marks`}><TextInput type="number" min="0" max={String(criterion.maxMarks)} step="0.5" value={criterionScores[criterion.id] || ''} onChange={(event) => updateCriterionScore(criterion.id, event.target.value)} /></FormField></div>)}<p className="text-sm font-semibold text-slate-700">Overall mark updates automatically from the criterion scores.</p></fieldset> : null}
        <fieldset className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-storage-format="Rubric scores JSON">
          <legend className="px-1 text-sm font-semibold text-slate-900">Turn feedback into a next step</legend>
          <FormField label="What went well"><TextInput value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="A specific strength the learner can keep using" /></FormField>
          <FormField label="Fix next"><TextInput value={fixNext} onChange={(event) => setFixNext(event.target.value)} placeholder="One misconception or skill to improve" /></FormField>
          <div className="grid gap-3 sm:grid-cols-2"><FormField label="Action"><select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={actionType} onChange={(event) => setActionType(event.target.value as LearningActionType)}><option value="practice">Complete focused practice</option><option value="retry">Retry selected questions</option><option value="revise">Revise the method</option><option value="discuss">Discuss next session</option></select></FormField><FormField label="Aim to complete by"><TextInput type="date" value={actionDueDate} onChange={(event) => setActionDueDate(event.target.value)} /></FormField></div>
          <FormField label="20-minute action"><TextInput value={actionDetail} onChange={(event) => setActionDetail(event.target.value)} placeholder="For example: redo questions 3–5 without notes" /></FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} /> Learner may submit a correction</label>
        </fieldset>
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={marksReleased} onChange={(event) => setMarksReleased(event.target.checked)} /> Release marks to learner</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={feedbackReleased} onChange={(event) => setFeedbackReleased(event.target.checked)} /> Release feedback and rubric to learner</label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save review'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <InlineFeedback>Marking or release failed. {error}</InlineFeedback> : null}
        </div>
      </form>
    </article>
  );
}

function safeScoreMap(value: string): Record<string, unknown> { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
