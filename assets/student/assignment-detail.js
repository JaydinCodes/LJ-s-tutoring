import { renderError, renderLoading, setActiveNav } from '/assets/common.js';
import {
  fetchStudentAssignmentDetail,
  fetchStudentAssignmentSubmissions,
  uploadAssignmentSubmission,
  validateSubmissionFile,
} from '/assets/student/learning-api.js';

setActiveNav('assignments');

const assignmentId = new URLSearchParams(window.location.search).get('id');
const titleEl = document.getElementById('assignmentTitle');
const subtitleEl = document.getElementById('assignmentSubtitle');
const overviewEl = document.getElementById('assignmentOverview');
const uploadEl = document.getElementById('assignmentUploadDetail');
const historyEl = document.getElementById('submissionHistory');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderOverview(assignment) {
  if (!overviewEl) {return;}
  overviewEl.innerHTML = `
    <div class="list-item">
      <strong>${escapeHtml(assignment.title || assignment.topic || 'Assignment')}</strong>
      <div class="note">${escapeHtml(assignment.subject || 'Subject')} • ${escapeHtml(assignment.topic || 'Topic')}</div>
      <p>${escapeHtml(assignment.description || 'Your tutor will add notes or instructions here.')}</p>
    </div>
    <div class="list-item">
      <strong>Due date</strong>
      <p class="note">${assignment.dueDate || assignment.due_date ? new Date(assignment.dueDate || assignment.due_date).toLocaleDateString('en-ZA') : 'No due date set yet.'}</p>
    </div>
    <div class="list-item">
      <strong>Status</strong>
      <p class="note">${escapeHtml(String(assignment.status || 'upcoming').replace(/_/g, ' '))}</p>
    </div>
    <div class="list-item">
      <strong>Total marks</strong>
      <p class="note">${escapeHtml(assignment.totalMarks || assignment.total_marks || '—')}</p>
    </div>
  `;
}

function renderUploadPanel(assignment, apiAvailable) {
  if (!uploadEl) {return;}
  if (!apiAvailable) {
    uploadEl.innerHTML = '<strong>Uploads are not enabled yet.</strong>When /student/assignments is available, this panel will show file upload status, progress, and confirmation.';
    return;
  }

  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['PDF', 'DOCX', 'PNG', 'JPG'];
  uploadEl.innerHTML = `
    <div class="upload-panel" id="assignmentUploadDrop">
      <div>
        <span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span>
        <h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Assignment')}</h3>
        <div class="assignment-meta">${escapeHtml([assignment.topic, assignment.dueDate || assignment.due_date ? `Due ${new Date(assignment.dueDate || assignment.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : ''].filter(Boolean).join(' • '))}</div>
      </div>
      <input id="assignmentUploadInput" type="file" aria-label="Upload submission" />
      <span class="note">Accepted: ${escapeHtml(allowed.join(', '))}. Max ${escapeHtml(assignment.maxFileSizeMB || assignment.max_file_size_mb || 20)} MB.</span>
      <div class="upload-progress"><span id="assignmentUploadProgress"></span></div>
      <div class="assignment-actions">
        <button class="button" type="button" id="assignmentUploadBtn">${assignment.status === 'submitted' ? 'Resubmit' : 'Upload submission'}</button>
      </div>
      <span class="note" id="assignmentUploadState" aria-live="polite"></span>
    </div>
  `;

  const dropZone = document.getElementById('assignmentUploadDrop');
  const input = document.getElementById('assignmentUploadInput');
  const progress = document.getElementById('assignmentUploadProgress');
  const state = document.getElementById('assignmentUploadState');
  const submit = document.getElementById('assignmentUploadBtn');

  let queuedFile = null;
  const selectFile = (file) => {
    queuedFile = file;
    if (file) {
      state.textContent = `Selected: ${file.name}`;
    }
  };

  input?.addEventListener('change', () => selectFile(input.files?.[0]));
  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-active');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-active');
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) {
      selectFile(dropped);
    }
  });

  submit?.addEventListener('click', async () => {
    const selected = queuedFile || input?.files?.[0];
    const validation = validateSubmissionFile(selected, assignment);
    if (validation) {
      state.textContent = validation;
      return;
    }
    submit.disabled = true;
    state.textContent = 'Uploading...';
    if (progress) {progress.style.width = '8%';}
    try {
      await uploadAssignmentSubmission(assignment.id, selected, (pct) => {
        if (progress) {progress.style.width = `${Math.max(8, Math.min(100, pct))}%`;}
      });
      state.textContent = 'Upload confirmed. Your assignment is submitted.';
    } catch {
      state.textContent = 'Upload failed. Please try again or contact your tutor.';
    } finally {
      submit.disabled = false;
    }
  });
}

function renderHistory(result) {
  if (!historyEl) {return;}
  if (!result.available) {
    historyEl.innerHTML = '<div class="empty-state"><strong>Submission history is not available yet.</strong>Your uploads will appear here once the submissions endpoint is enabled.</div>';
    return;
  }
  if (!result.items?.length) {
    historyEl.innerHTML = '<div class="empty-state"><strong>No submissions yet.</strong>Upload your work to confirm submission and update your tutor.</div>';
    return;
  }
  historyEl.innerHTML = '';
  result.items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <strong>${escapeHtml(item.fileName || 'Submission')}</strong>
      <div class="note">${escapeHtml(item.status || 'uploaded')} • ${item.uploadedAt ? new Date(item.uploadedAt).toLocaleString('en-ZA') : 'Just now'}</div>
      ${item.fileUrl ? `<a class="button secondary" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noreferrer">Open file</a>` : ''}
    `;
    historyEl.appendChild(row);
  });
}

async function bootstrap() {
  if (!assignmentId) {
    if (subtitleEl) {
      subtitleEl.textContent = 'Select an assignment from your list to view details.';
    }
    if (overviewEl) {
      overviewEl.innerHTML = '<div class="empty-state"><strong>No assignment selected.</strong>Return to assignments to choose a task.</div>';
    }
    return;
  }

  renderLoading(overviewEl, 'Loading assignment details...');
  renderLoading(historyEl, 'Loading submission history...');

  try {
    const [detailResult, submissionsResult] = await Promise.all([
      fetchStudentAssignmentDetail(assignmentId),
      fetchStudentAssignmentSubmissions(assignmentId),
    ]);

    if (!detailResult.available || !detailResult.item) {
      if (subtitleEl) {
        subtitleEl.textContent = 'Assignment details are not available yet.';
      }
      if (overviewEl) {
        overviewEl.innerHTML = '<div class="empty-state"><strong>Assignment detail API not enabled.</strong>Your tutor will enable assignment detail access soon.</div>';
      }
      renderUploadPanel({}, false);
      renderHistory(submissionsResult || { available: false, items: [] });
      return;
    }

    const assignment = detailResult.item;
    if (titleEl) {
      titleEl.textContent = assignment.title || assignment.topic || 'Assignment';
    }
    if (subtitleEl) {
      subtitleEl.textContent = assignment.subject ? `${assignment.subject} • ${assignment.topic || 'Learning task'}` : 'Assignment detail';
    }

    renderOverview(assignment);
    renderUploadPanel(assignment, true);
    renderHistory(submissionsResult || { available: false, items: [] });
  } catch {
    renderError(overviewEl, 'Could not load assignment details.');
    renderError(historyEl, 'Could not load submission history.');
  }
}

bootstrap();
