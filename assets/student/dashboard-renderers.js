import { renderList } from '/assets/common.js';

function toText(value, fallback = '') {
  if (value === null || value === undefined) {return fallback;}
  return String(value);
}

function escapeHtml(value) {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) {return '';}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return String(value).slice(0, 10);}
  return date.toLocaleDateString('en-ZA', options);
}

export function smartEmpty(target, title, detail, action) {
  if (!target) {return;}
  target.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('div');
  p.textContent = detail;
  empty.append(strong, p);
  if (action) {
    const link = document.createElement('a');
    link.className = 'button secondary';
    link.href = action.href;
    link.textContent = action.label;
    link.style.marginTop = '0.75rem';
    empty.append(link);
  }
  target.append(empty);
}

export function renderRows(rows, className = 'detail-card') {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  rows.filter((row) => row !== null && row !== undefined && row !== '').forEach((row, index) => {
    const el = document.createElement(index === 0 ? 'strong' : 'div');
    el.textContent = String(row);
    wrapper.appendChild(el);
  });
  return wrapper;
}

export function renderSingleCard(target, rows, emptyTitle, emptyDetail) {
  if (!target) {return;}
  if (!rows || rows.length === 0) {
    smartEmpty(target, emptyTitle, emptyDetail);
    return;
  }
  renderList(target, [rows], (item) => renderRows(item));
}

export function renderSession(session) {
  const wrapper = document.createElement('div');
  wrapper.className = 'agenda-item';
  wrapper.innerHTML = `
    <div class="agenda-item-head">
      <strong>${escapeHtml(session.subject || 'Upcoming session')}</strong>
      <span class="badge subtle flat">${escapeHtml(session.mode || 'Scheduled')}</span>
    </div>
    <div>${escapeHtml(formatDate(session.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</div>
    <div class="note">${escapeHtml(`${toText(session.startTime)}${session.tutorName ? ` | ${session.tutorName}` : ''}`)}</div>
  `;
  return wrapper;
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

function statusLabel(value) {
  return String(value || 'upcoming').replace(/_/g, ' ');
}

export function renderAssignmentCard(assignment, apiAvailable, validateSubmissionFile, uploadAssignmentSubmission, track) {
  const due = assignment.dueDate || assignment.due_date;
  const status = String(assignment.submission_status || assignment.status || '').toLowerCase() || (daysUntil(due) < 0 ? 'overdue' : 'upcoming');
  const delta = daysUntil(due);
  const metaText = [
    assignment.topic,
    due ? `Due ${formatDate(due, { day: 'numeric', month: 'short' })}` : 'No due date set',
    delta === null ? '' : delta < 0 ? `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue` : delta === 0 ? 'Due today' : `${delta} day${delta === 1 ? '' : 's'} left`,
  ].filter(Boolean).join(' | ');
  const card = document.createElement('article');
  card.className = 'assignment-card list-item';
  card.dataset.urgency = status;

  card.innerHTML = `
    <div class="status-row">
      <div>
        <span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span>
        <h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Learning task')}</h3>
      </div>
      <span class="badge subtle ${status === 'overdue' ? 'down overdue' : status === 'submitted' || status === 'marked' ? 'up submitted' : 'flat due-soon'}">${escapeHtml(statusLabel(status))}</span>
    </div>
    <p class="note">${escapeHtml(metaText)}</p>
  `;

  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('span');
  fill.style.width = `${Math.max(8, Math.min(100, Number(assignment.progress || (status === 'submitted' ? 75 : status === 'marked' ? 100 : 35))))}%`;
  progress.append(fill);
  card.append(progress);

  const upload = document.createElement('div');
  upload.className = 'upload-box';
  const file = document.createElement('input');
  file.type = 'file';
  file.disabled = !apiAvailable || status === 'marked';
  file.setAttribute('aria-label', `Upload submission for ${toText(assignment.title, 'assignment')}`);

  const hint = document.createElement('span');
  hint.className = 'note';
  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['PDF', 'PNG', 'JPG'];
  hint.textContent = apiAvailable
    ? `Accepted: ${allowed.join(', ')}. Max ${assignment.maxFileSizeMB || assignment.max_file_size_mb || 10} MB.`
    : 'Upload endpoint is not available yet. Student submissions need to be enabled.';

  const submit = document.createElement('button');
  submit.className = 'button secondary';
  submit.type = 'button';
  submit.textContent = assignment.submission_id ? 'Replace submission' : 'Upload submission';
  submit.disabled = file.disabled;

  const state = document.createElement('span');
  state.className = 'note';
  state.setAttribute('aria-live', 'polite');
  if (assignment.original_filename) {
    state.textContent = `Current file: ${assignment.original_filename}${assignment.submitted_at ? `, submitted ${formatDate(assignment.submitted_at)}` : ''}.`;
  }

  submit.addEventListener('click', async () => {
    const selected = file.files?.[0];
    const validation = validateSubmissionFile(selected, assignment);
    if (validation) {
      state.textContent = validation;
      return;
    }
    submit.disabled = true;
    state.textContent = 'Uploading...';
    try {
      const uploaded = await uploadAssignmentSubmission(assignment.id, selected, () => {});
      state.textContent = `Upload confirmed${uploaded?.submission?.submitted_at ? ` at ${new Date(uploaded.submission.submitted_at).toLocaleString('en-ZA')}` : ''}.`;
      track('assignment.submitted', { assignmentId: assignment.id });
    } catch {
      state.textContent = 'Upload failed. Please try again or contact your tutor.';
    } finally {
      submit.disabled = false;
    }
  });

  upload.append(file, hint, submit, state);
  card.append(upload);
  return card;
}

export function renderResultCard(result) {
  const card = document.createElement('article');
  card.className = 'result-card list-item';
  const pct = result.percentage ?? (result.totalMarks ? Math.round((Number(result.score || 0) / Number(result.totalMarks)) * 100) : null);
  const strengths = Array.isArray(result.strengths) ? result.strengths.join(', ') : result.strengths;
  const improvements = Array.isArray(result.improvementAreas) ? result.improvementAreas.join(', ') : result.improvementAreas;
  card.innerHTML = `
    <div class="status-row">
      <div>
        <span class="tiny-label">${escapeHtml(result.subject || 'Result')}</span>
        <h3 class="panel-title">${escapeHtml(result.title || 'Marked work')}</h3>
      </div>
      <strong class="metric-value">${pct === null || pct === undefined ? '--' : `${pct}%`}</strong>
    </div>
    <p class="note">${escapeHtml([result.topic, result.markedAt ? `Marked ${formatDate(result.markedAt)}` : '', result.score !== undefined && result.totalMarks ? `${result.score}/${result.totalMarks}` : ''].filter(Boolean).join(' | '))}</p>
    <p>${escapeHtml(result.feedbackSummary || 'Feedback summary will appear here once your tutor marks the work.')}</p>
    <p class="note"><strong>Strengths:</strong> ${escapeHtml(strengths || 'Awaiting feedback')}</p>
    <p class="note"><strong>Next improvement:</strong> ${escapeHtml(improvements || 'Awaiting feedback')}</p>
  `;
  const btn = document.createElement('a');
  btn.className = 'button secondary';
  btn.href = result.reportId ? `/reports/?report=${encodeURIComponent(result.reportId)}` : '/reports/';
  btn.textContent = 'View report';
  card.append(btn);
  return card;
}

export function renderComparison(target, statsResult, results) {
  if (!target) {return;}
  target.innerHTML = '';
  const stat = statsResult.items?.[0] || statsResult.payload?.stats?.[0] || null;
  if (!statsResult.available) {
    smartEmpty(target, 'Class comparison is waiting for API support.', 'When anonymised class statistics are available, this area will compare your score with the group average without exposing any learner names.');
    return;
  }
  if (!stat) {
    smartEmpty(target, 'No comparison yet.', 'Class comparison appears after an assignment is marked and enough anonymised group data exists to make the comparison fair.');
    return;
  }
  const learner = Number(stat.learnerScore ?? stat.learner_score ?? results?.[0]?.percentage ?? 0);
  const average = Number(stat.classAverage ?? stat.class_average ?? 0);
  const high = Number(stat.highestScore ?? stat.highest_score ?? 0);
  const percentile = stat.percentile ?? null;
  const message = learner >= average
    ? 'You are above the group average. Keep consolidating the method so it becomes reliable.'
    : 'You are close to the next band. Revise the target topic and try three focused questions.';
  const summary = document.createElement('p');
  summary.textContent = message;
  target.append(summary);
  [
    ['You', learner],
    ['Average', average],
    ['Highest', high],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'band-row';
    row.innerHTML = `<span>${escapeHtml(label)}</span><div class="band-track"><span style="width:${Math.max(4, Math.min(100, value))}%"></span></div><strong>${Math.round(value)}%</strong>`;
    target.append(row);
  });
  const band = document.createElement('div');
  band.className = 'empty-state';
  band.innerHTML = `<strong>${escapeHtml(percentile ? `Percentile ${percentile}` : 'Growth band')}</strong>${learner >= average ? 'You are in a strong working band.' : 'Support band does not mean stuck; it means your next practice step is clear.'}`;
  target.append(band);
}

export function renderSubjectSnapshot(topic) {
  const card = document.createElement('article');
  card.className = 'subject-bar-card';
  const minutes = Number(topic.minutes || 0);
  const sessions = Number(topic.sessions || 0);
  const completion = Math.max(0, Math.min(100, Number(topic.completion || 0)));
  card.innerHTML = `
    <div class="subject-bar-head">
      <strong>${escapeHtml(topic.topic || 'Topic')}</strong>
      <span>${completion}%</span>
    </div>
    <div class="note">${minutes} minutes | ${sessions} sessions</div>
  `;
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  const fill = document.createElement('span');
  fill.style.width = `${completion}%`;
  bar.append(fill);
  card.append(bar);
  return card;
}
