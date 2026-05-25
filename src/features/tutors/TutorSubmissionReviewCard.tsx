import type { FormEvent } from 'react';
import { useState } from 'react';
import { FormField, TextArea, TextInput } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../lib/utils/format';
import type { AssignmentSubmission } from '../../types/lms';
import { markSubmission } from '../assignments/assignmentMutations';

export function TutorSubmissionReviewCard({
  submission,
  onSaved,
}: {
  submission: AssignmentSubmission & { assignment_title?: string; student_label?: string };
  onSaved: () => Promise<void>;
}) {
  const [marksAwarded, setMarksAwarded] = useState(submission.marks_awarded == null ? '' : String(submission.marks_awarded));
  const [feedback, setFeedback] = useState(submission.feedback || '');
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
      await markSubmission({ submissionId: submission.id, marksAwarded, feedback, status });
      setMessage('Submission review saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save submission review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{submission.assignment_title || submission.assignment_id}</h3>
          <p className="mt-1 text-sm text-slate-600">{submission.student_label || submission.student_id}</p>
        </div>
        <StatusBadge value={submission.status} />
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-600">
        <div><dt className="font-semibold text-slate-800">Submitted</dt><dd>{formatDate(submission.submitted_at)}</dd></div>
        {submission.file_url ? <div><dt className="font-semibold text-slate-800">File</dt><dd className="break-all font-mono text-xs">{submission.file_url}</dd></div> : null}
        {submission.text_answer ? <div><dt className="font-semibold text-slate-800">Answer</dt><dd className="rounded-lg bg-slate-50 p-3">{submission.text_answer}</dd></div> : null}
      </dl>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Marks awarded">
            <TextInput type="number" min="0" max="100" step="0.01" value={marksAwarded} onChange={(event) => setMarksAwarded(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={status} onChange={(event) => setStatus(event.target.value as 'submitted' | 'marked' | 'returned')}>
              <option value="marked">Marked</option>
              <option value="returned">Returned</option>
              <option value="submitted">Submitted</option>
            </select>
          </FormField>
        </div>
        <FormField label="Feedback">
          <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback for the learner..." />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit">
            {busy ? 'Saving...' : 'Save review'}
          </button>
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </form>
    </article>
  );
}
