import { useState } from 'react';
import type { AssignmentItem } from '../../types';
import { daysUntil, formatDate } from '../../lib/format';

export function AssignmentCard({
  assignment,
  onUpload,
  validateUpload,
}: {
  assignment: AssignmentItem;
  onUpload: (assignmentId: string, file: File) => Promise<void>;
  validateUpload: (file: File | undefined, assignment: AssignmentItem) => string;
}) {
  const [message, setMessage] = useState(assignment.original_filename ? `Current file: ${assignment.original_filename}` : '');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const due = assignment.dueDate || assignment.due_date;
  const delta = daysUntil(due);

  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">{assignment.subject || 'Assignment'}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{assignment.title || assignment.topic || 'Learning task'}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">{String(assignment.submission_status || assignment.status || 'upcoming').replace(/_/g, ' ')}</span>
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        {[assignment.topic, due ? `Due ${formatDate(due, { day: 'numeric', month: 'short' })}` : 'No due date set', delta === null ? '' : delta < 0 ? `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue` : delta === 0 ? 'Due today' : `${delta} day${delta === 1 ? '' : 's'} left`].filter(Boolean).join(' | ')}
      </p>
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
        <input className="block w-full text-sm" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0])} />
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Accepted: {(assignment.allowedFileTypes || assignment.allowed_file_types || ['pdf', 'jpg', 'png']).join(', ')}. Max {assignment.maxFileSizeMB || assignment.max_file_size_mb || 10} MB.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const validation = validateUpload(selectedFile, assignment);
              if (validation) {
                setMessage(validation);
                return;
              }
              if (!selectedFile) {return;}
              setBusy(true);
              try {
                await onUpload(assignment.id, selectedFile);
                setMessage('Upload confirmed.');
              } catch {
                setMessage('Upload failed. Please try again.');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {busy ? 'Uploading...' : assignment.submission_id ? 'Replace submission' : 'Upload submission'}
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">{message}</span>
        </div>
      </div>
    </article>
  );
}
