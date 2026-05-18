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
let assignments = [];
let apiAvailable = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function empty(title, copy) {
  list.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`;
}

function badgeClassForStatus(value) {
  const normalized = String(value || 'upcoming').toLowerCase();
  if (normalized === 'overdue') {return 'down overdue';}
  if (normalized === 'submitted' || normalized === 'marked') {return 'up submitted';}
  if (normalized === 'due_soon') {return 'flat due-soon';}
  return 'flat';
}

function render() {
  const status = filter?.value || 'all';
  const filtered = assignments.filter((item) => status === 'all' || String(item.status || 'upcoming').toLowerCase() === status);
  if (!apiAvailable) {
    empty('Assignments API not enabled yet.', 'When /student/assignments is available, this page will show due work, upload controls, and submission status.');
    return;
  }
  if (!filtered.length) {
    empty('No assignments match this filter.', 'When your tutor gives you homework or a task, it will appear here with its due date and upload button.');
    return;
  }
  list.innerHTML = '';
  filtered.forEach((assignment) => {
    const card = document.createElement('article');
    card.className = 'list-item';
    const due = assignment.dueDate || assignment.due_date;
    const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['pdf', 'docx', 'png', 'jpg'];
    const meta = [
      assignment.subject,
      assignment.topic,
      due ? `Due ${new Date(due).toLocaleDateString('en-ZA')}` : 'No due date',
    ].filter(Boolean).join(' | ');
    card.innerHTML = `
      <div class="row-head">
        <div>
          <strong>${escapeHtml(assignment.title || assignment.topic || 'Assignment')}</strong>
          <div class="note">${escapeHtml(meta)}</div>
        </div>
        <span class="badge subtle ${badgeClassForStatus(assignment.status)}">${escapeHtml(String(assignment.status || 'upcoming').replace(/_/g, ' '))}</span>
      </div>
      <div class="progress-bar"><span style="width:${Math.max(8, Math.min(100, Number(assignment.progress || 35)))}%"></span></div>
      <div class="upload-box">
        <input type="file" aria-label="Upload submission">
        <span class="note">Accepted: ${escapeHtml(allowed.join(', '))}. Max ${escapeHtml(assignment.maxFileSizeMB || assignment.max_file_size_mb || 20)} MB.</span>
        <button class="button secondary" type="button">Upload submission</button>
        <span class="note" aria-live="polite"></span>
      </div>`;
    const file = card.querySelector('input[type="file"]');
    const btn = card.querySelector('button');
    const state = card.querySelector('[aria-live]');
    btn.addEventListener('click', async () => {
      const validation = validateSubmissionFile(file.files?.[0], assignment);
      if (validation) {
        state.textContent = validation;
        return;
      }
      btn.disabled = true;
      state.textContent = 'Uploading...';
      try {
        await uploadAssignmentSubmission(assignment.id, file.files[0]);
        state.textContent = 'Upload confirmed. Your assignment is submitted.';
      } catch {
        state.textContent = 'Upload failed. Please try again.';
      } finally {
        btn.disabled = false;
      }
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
  render();
} catch {
  renderError(list, 'Could not load assignments.');
}
