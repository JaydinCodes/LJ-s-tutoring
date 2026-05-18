import { renderError, renderLoading, setActiveNav } from '/assets/common.js';
import {
  fetchStudentAssignments,
  sortAssignmentsByUrgency,
  uploadAssignmentSubmission,
  validateSubmissionFile,
} from '/assets/student/learning-api.js';

setActiveNav('assignments');

const list = document.getElementById('assignmentPageList');
const filter = document.getElementById('assignmentStatusFilter');
const uploadPanel = document.getElementById('assignmentUploadPanel');
let assignments = [];
let apiAvailable = false;
let activeAssignmentId = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function empty(title, copy) {
  list.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(copy)}</div>`;
}

function daysUntil(value) {
  if (!value) {return null;}
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) {return null;}
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / 86400000);
}

function resolveAssignmentStatus(assignment) {
  const due = assignment.dueDate || assignment.due_date;
  const raw = String(assignment.status || '').toLowerCase();
  if (['submitted', 'marked', 'returned_for_revision'].includes(raw)) {
    return raw;
  }
  const delta = daysUntil(due);
  if (delta === null) {return raw || 'upcoming';}
  if (delta < 0) {return 'overdue';}
  if (delta <= 2) {return 'due_soon';}
  return 'upcoming';
}

function statusPillClass(status) {
  if (status === 'due_soon') {return 'due-soon';}
  if (status === 'overdue') {return 'overdue';}
  if (status === 'submitted' || status === 'marked') {return 'submitted';}
  return '';
}

function renderUploadPanel(assignment) {
  if (!uploadPanel) {return;}
  if (!apiAvailable) {
    uploadPanel.innerHTML = '<strong>Uploads are not enabled yet.</strong>When /student/assignments is available, this panel will show file upload status, progress, and confirmation.';
    return;
  }
  if (!assignment) {
    uploadPanel.innerHTML = '<strong>No assignment selected yet.</strong>Choose a task on the left to see upload details and submission status.';
    return;
  }

  const due = assignment.dueDate || assignment.due_date;
  const dueLabel = due ? new Date(due).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'No due date';
  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['PDF', 'DOCX', 'PNG', 'JPG'];

  uploadPanel.innerHTML = `
    <div class="upload-panel" id="assignmentUploadDrop">
      <div>
        <span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span>
        <h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Learning task')}</h3>
        <div class="assignment-meta">${escapeHtml([assignment.topic, `Due ${dueLabel}`].filter(Boolean).join(' • '))}</div>
      </div>
      <input id="assignmentUploadInput" type="file" aria-label="Upload submission" />
      <span class="note">Accepted: ${escapeHtml(allowed.join(', '))}. Max ${escapeHtml(assignment.maxFileSizeMB || assignment.max_file_size_mb || 20)} MB.</span>
      <div class="upload-progress"><span id="assignmentUploadProgress"></span></div>
      <div class="assignment-actions">
        <button class="button" type="button" id="assignmentUploadBtn">${assignment.status === 'submitted' ? 'Resubmit' : 'Upload submission'}</button>
        <a class="button secondary" href="/dashboard/assignments/detail/?id=${encodeURIComponent(assignment.id)}">View details</a>
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

function render() {
  const status = filter?.value || 'all';
  const filtered = assignments.filter((item) => status === 'all' || resolveAssignmentStatus(item) === status);
  if (!apiAvailable) {
    empty('Assignments API not enabled yet.', 'When /student/assignments is available, this page will show due work, upload controls, and submission status.');
    renderUploadPanel(null);
    return;
  }
  if (!filtered.length) {
    empty('No assignments match this filter.', 'When your tutor gives you homework or a task, it will appear here with its due date and upload button.');
    renderUploadPanel(null);
    return;
  }
  list.innerHTML = '';
  filtered.forEach((assignment) => {
    const card = document.createElement('article');
    const statusValue = resolveAssignmentStatus(assignment);
    card.className = 'assignment-card';
    card.dataset.urgency = statusValue;
    card.dataset.active = String(activeAssignmentId === assignment.id);
    const due = assignment.dueDate || assignment.due_date;
    const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['pdf', 'docx', 'png', 'jpg'];
    const meta = [
      assignment.subject,
      assignment.topic,
      due ? `Due ${new Date(due).toLocaleDateString('en-ZA')}` : 'No due date',
    ].filter(Boolean).join(' | ');
    card.innerHTML = `
      <div class="status-row">
        <div>
          <span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span>
          <h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Assignment')}</h3>
          <div class="note">${escapeHtml(meta)}</div>
        </div>
        <span class="status-pill ${statusPillClass(statusValue)}">${escapeHtml(String(statusValue).replace(/_/g, ' '))}</span>
      </div>
      <div class="progress-bar"><span style="width:${Math.max(8, Math.min(100, Number(assignment.progress || 35)))}%"></span></div>
      <div class="assignment-meta">Accepted: ${escapeHtml(allowed.join(', '))}. Max ${escapeHtml(assignment.maxFileSizeMB || assignment.max_file_size_mb || 20)} MB.</div>
      <div class="assignment-actions">
        <button class="button secondary" type="button" data-select="${escapeHtml(assignment.id)}">Upload</button>
        <a class="button secondary" href="/dashboard/assignments/detail/?id=${encodeURIComponent(assignment.id)}">View details</a>
      </div>
    `;
    card.addEventListener('click', (event) => {
      if (event.target?.matches?.('button, a')) {return;}
      activeAssignmentId = assignment.id;
      render();
      renderUploadPanel(assignment);
    });
    const selectBtn = card.querySelector('[data-select]');
    selectBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      activeAssignmentId = assignment.id;
      render();
      renderUploadPanel(assignment);
    });
    list.append(card);
  });
}

filter?.addEventListener('change', render);

renderLoading(list, 'Loading assignments...');
try {
  const result = await fetchStudentAssignments();
  apiAvailable = result.available;
  assignments = sortAssignmentsByUrgency(result.items || []);
  if (assignments[0]) {
    activeAssignmentId = assignments[0].id;
    renderUploadPanel(assignments[0]);
  } else {
    renderUploadPanel(null);
  }
  render();
} catch {
  renderError(list, 'Could not load assignments.');
  renderUploadPanel(null);
}
