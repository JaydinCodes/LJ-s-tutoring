import { apiFetch, loadJson, renderList, renderLoading, renderError, setActiveNav, setText } from '/assets/common.js';
import { track } from '/assets/analytics.js';
import {
  fetchClassStats,
  fetchStudentAssignments,
  fetchStudentResults,
  sortAssignmentsByUrgency,
  uploadAssignmentSubmission,
  validateSubmissionFile,
} from '/assets/student/learning-api.js';

setActiveNav('dashboard');

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

function renderSession(session) {
  const subject = document.createElement('strong');
  subject.textContent = toText(session.subject, 'Upcoming session');

  const when = document.createElement('div');
  when.textContent = `${toText(session.date)} - ${toText(session.startTime)}`.trim();

  const mode = document.createElement('div');
  mode.textContent = toText(session.mode, '');

  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  wrapper.append(subject, when, mode);
  return wrapper;
}

function smartEmpty(target, title, detail, action) {
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

function renderSnapshot(topic) {
  const title = document.createElement('strong');
  title.textContent = toText(topic.topic, 'Topic');

  const meta = document.createElement('div');
  const minutes = Number(topic.minutes || 0);
  const sessions = Number(topic.sessions || 0);
  meta.textContent = `${minutes} minutes - ${sessions} sessions`;

  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  const fill = document.createElement('span');
  const completion = Math.max(0, Math.min(100, Number(topic.completion || 0)));
  fill.style.width = `${completion}%`;
  bar.appendChild(fill);

  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  wrapper.append(title, meta, bar);
  return wrapper;
}

function statusLabel(value) {
  return String(value || 'upcoming').replace(/_/g, ' ');
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

function renderAssignmentCard(assignment, apiAvailable) {
  const due = assignment.dueDate || assignment.due_date;
  const status = resolveAssignmentStatus(assignment);
  const card = document.createElement('article');
  card.className = 'assignment-card';
  card.dataset.urgency = status;

  const header = document.createElement('div');
  header.className = 'status-row';
  header.innerHTML = `
    <div>
      <span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span>
      <h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Learning task')}</h3>
    </div>
    <span class="status-pill ${statusPillClass(status)}">${escapeHtml(statusLabel(status))}</span>
  `;

  const meta = document.createElement('div');
  meta.className = 'assignment-meta';
  const delta = daysUntil(due);
  const dueLabel = due ? new Date(due).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'No due date';
  const urgencyLabel = delta === null
    ? ''
    : delta < 0
      ? `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`
      : delta === 0
        ? 'Due today'
        : `${delta} day${delta === 1 ? '' : 's'} left`;
  meta.textContent = [assignment.topic, `Due ${dueLabel}`, urgencyLabel].filter(Boolean).join(' • ');

  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('span');
  fill.style.width = `${Math.max(8, Math.min(100, Number(assignment.progress || (status === 'submitted' ? 75 : status === 'marked' ? 100 : 35))))}%`;
  progress.append(fill);

  const upload = document.createElement('div');
  upload.className = 'upload-panel';
  const file = document.createElement('input');
  file.type = 'file';
  file.disabled = !apiAvailable || status === 'marked';
  file.setAttribute('aria-label', `Upload submission for ${toText(assignment.title, 'assignment')}`);
  const hint = document.createElement('span');
  hint.className = 'note';
  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['PDF', 'DOCX', 'PNG', 'JPG'];
  hint.textContent = apiAvailable
    ? `Accepted: ${allowed.join(', ')}. Max ${assignment.maxFileSizeMB || assignment.max_file_size_mb || 20} MB.`
    : 'Upload endpoint is not available yet. Your tutor/admin team needs to enable student submissions.';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'upload-progress';
  const progressFill = document.createElement('span');
  progressWrap.append(progressFill);

  const state = document.createElement('span');
  state.className = 'note';
  state.setAttribute('aria-live', 'polite');
  if (assignment.submittedAt || assignment.submitted_at) {
    const submittedAt = new Date(assignment.submittedAt || assignment.submitted_at);
    state.textContent = `Submitted ${submittedAt.toLocaleString('en-ZA')}`;
  }

  let queuedFile = null;
  const selectFile = (fileInput) => {
    queuedFile = fileInput;
    if (queuedFile) {
      state.textContent = `Selected: ${queuedFile.name}`;
    }
  };

  file.addEventListener('change', () => selectFile(file.files?.[0]));
  upload.addEventListener('dragover', (event) => {
    event.preventDefault();
    upload.classList.add('drag-active');
  });
  upload.addEventListener('dragleave', () => upload.classList.remove('drag-active'));
  upload.addEventListener('drop', (event) => {
    event.preventDefault();
    upload.classList.remove('drag-active');
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) {
      selectFile(dropped);
    }
  });

  const actions = document.createElement('div');
  actions.className = 'assignment-actions';
  const submit = document.createElement('button');
  submit.className = 'button secondary';
  submit.type = 'button';
  submit.textContent = status === 'submitted' ? 'Resubmit' : 'Upload submission';
  submit.disabled = file.disabled;
  const detail = document.createElement('a');
  detail.className = 'button secondary';
  detail.href = `/dashboard/assignments/detail/?id=${encodeURIComponent(assignment.id)}`;
  detail.textContent = 'View details';

  submit.addEventListener('click', async () => {
    const selected = queuedFile || file.files?.[0];
    const validation = validateSubmissionFile(selected, assignment);
    if (validation) {
      state.textContent = validation;
      return;
    }
    submit.disabled = true;
    state.textContent = 'Uploading...';
    progressFill.style.width = '8%';
    try {
      await uploadAssignmentSubmission(assignment.id, selected, (pct) => {
        progressFill.style.width = `${Math.max(8, Math.min(100, pct))}%`;
      });
      state.textContent = 'Upload confirmed. Your assignment is submitted.';
      track('assignment.submitted', { assignmentId: assignment.id });
    } catch {
      state.textContent = 'Upload failed. Please try again or contact your tutor.';
    } finally {
      submit.disabled = false;
    }
  });

  actions.append(submit, detail);
  upload.append(file, hint, progressWrap, actions, state);

  card.append(header, meta, progress, upload);
  return card;
}

function renderResultCard(result) {
  const card = document.createElement('article');
  card.className = 'result-card';
  const pct = result.percentage ?? (result.totalMarks ? Math.round((Number(result.score || 0) / Number(result.totalMarks)) * 100) : null);
  const strengths = Array.isArray(result.strengths) ? result.strengths.join(', ') : result.strengths;
  const improvements = Array.isArray(result.improvementAreas) ? result.improvementAreas.join(', ') : result.improvementAreas;
  card.innerHTML = `
    <div class="status-row">
      <div>
        <span class="tiny-label">${escapeHtml(result.subject || 'Result')}</span>
        <h3 class="panel-title">${escapeHtml(result.title || 'Marked work')}</h3>
      </div>
      <strong class="result-score">${pct === null || pct === undefined ? '—' : `${pct}%`}</strong>
    </div>
    <div class="result-meta">${escapeHtml([result.topic, result.markedAt ? `Marked ${new Date(result.markedAt).toLocaleDateString('en-ZA')}` : '', result.score !== undefined && result.totalMarks ? `${result.score}/${result.totalMarks}` : ''].filter(Boolean).join(' • '))}</div>
    <p>${escapeHtml(result.feedbackSummary || 'Feedback summary will appear here once your tutor marks the work.')}</p>
    <p class="note"><strong>Strengths:</strong> ${escapeHtml(strengths || 'Awaiting feedback')}</p>
    <p class="note"><strong>Next improvement:</strong> ${escapeHtml(improvements || 'Awaiting feedback')}</p>
  `;
  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const detail = document.createElement('a');
  detail.className = 'button secondary';
  detail.href = `/dashboard/results/detail/?id=${encodeURIComponent(result.id)}`;
  detail.textContent = 'View details';
  const report = document.createElement('a');
  report.className = 'button secondary';
  report.href = result.reportId ? `/reports/detail/?id=${encodeURIComponent(result.reportId)}` : '/reports/';
  report.textContent = 'Open report';
  actions.append(detail, report);
  card.append(actions);
  return card;
}

function renderComparison(target, statsResult, results) {
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
  const low = Number(stat.lowestScore ?? stat.lowest_score ?? 0);
  const percentile = stat.percentile ?? null;
  const message = learner >= average
    ? 'You are above the group average. Keep consolidating the method so it becomes reliable.'
    : 'You are close to the next band. Revise the target topic and try three focused questions.';

  const summary = document.createElement('p');
  summary.textContent = message;
  target.append(summary);

  const highlights = document.createElement('div');
  highlights.className = 'comparison-chart';
  [
    ['You', learner],
    ['Average', average],
    ['Highest', high],
    ['Lowest', low],
  ].filter((item) => !Number.isNaN(item[1])).forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'band-row';
    row.innerHTML = `<span>${escapeHtml(label)}</span><div class="band-track"><span style="width:${Math.max(4, Math.min(100, value))}%"></span></div><strong>${Math.round(value)}%</strong>`;
    highlights.append(row);
  });
  target.append(highlights);

  const distribution = Array.isArray(stat.distribution) ? stat.distribution : null;
  const bands = Array.isArray(stat.bands) ? stat.bands : null;
  if (distribution && distribution.length) {
    const maxValue = Math.max(...distribution.map((value) => Number(value || 0)), 1);
    const dist = document.createElement('div');
    dist.className = 'distribution';
    distribution.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'distribution-row';
      const label = bands?.[index]?.label || `Band ${index + 1}`;
      const pct = Math.round((Number(value || 0) / maxValue) * 100);
      row.innerHTML = `<span>${escapeHtml(label)}</span><div class="distribution-bar"><span style="width:${pct}%"></span></div><strong>${Number(value || 0)}</strong>`;
      dist.append(row);
    });
    target.append(dist);
  }

  const band = document.createElement('div');
  band.className = 'empty-state';
  band.innerHTML = `<strong>${escapeHtml(percentile ? `Percentile ${percentile}` : 'Growth band')}</strong>${learner >= average ? 'You are in a strong working band.' : 'Support band does not mean stuck; it means your next practice step is clear.'}`;
  target.append(band);
}

function updateTodayDate() {
  const target = document.getElementById('todayDate');
  const greeting = document.getElementById('todayGreeting');
  if (!target) {return;}

  const now = new Date();
  target.textContent = now.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (greeting) {
    const hour = now.getHours();
    greeting.textContent = hour < 12
      ? 'Good morning'
      : hour < 18
        ? 'Good afternoon'
        : 'Good evening';
  }
}

function setupReflection() {
  const input = document.getElementById('reflectionInput');
  const save = document.getElementById('saveReflection');
  if (!input) {return;}

  const key = 'po_student_reflection';
  try {
    input.value = localStorage.getItem(key) || '';
  } catch {
    input.value = '';
  }

  const persist = () => {
    try {
      localStorage.setItem(key, input.value);
    } catch {
      /* local storage may be unavailable */
    }
  };

  input.addEventListener('input', persist);
  save?.addEventListener('click', persist);
}

async function waitForStudentAuth() {
  if (!window.__PO_STUDENT_AUTH__) {
    return null;
  }
  try {
    return await window.__PO_STUDENT_AUTH__;
  } catch {
    return null;
  }
}

function setupStudentSession(authState) {
  const user = authState?.user;
  const profile = user?.profile || {};
  const shell = document.getElementById('studentSession');
  const avatar = document.getElementById('studentAvatar');
  const name = document.getElementById('studentName');
  const logout = document.getElementById('studentLogout');

  if (!shell || !user) {
    return;
  }

  const displayName = profile.name || profile.email || 'Student';
  if (name) {
    name.textContent = displayName;
    name.title = displayName;
  }
  if (avatar) {
    if (profile.picture) {
      avatar.src = profile.picture;
      avatar.hidden = false;
    } else {
      avatar.hidden = true;
    }
  }
  shell.hidden = false;

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/dashboard/login.html');
    }
  });
}

function updateWeeklyRhythm(data) {
  const label = document.getElementById('weeklyRhythmLabel');
  const bar = document.getElementById('weeklyRhythmBar');
  const minutes = Number(data.thisWeek?.minutesStudied ?? 0);
  const sessions = Number(data.thisWeek?.sessionsAttended ?? 0);
  const progress = Math.max(12, Math.min(100, Math.round((minutes / 180) * 70 + sessions * 10)));

  if (bar) {
    bar.style.width = `${progress}%`;
  }
  if (label) {
    label.textContent = progress >= 80 ? 'Strong' : progress >= 45 ? 'Growing' : 'Starting';
  }
}

function updateHeroKpis(data, assignments) {
  const nextSession = document.getElementById('heroNextSession');
  const sessionMeta = document.getElementById('heroSessionMeta');
  const dueCount = document.getElementById('heroDueCount');
  const dueMeta = document.getElementById('heroDueMeta');
  const momentum = document.getElementById('heroMomentum');
  const momentumMeta = document.getElementById('heroMomentumMeta');

  if (data.today?.hasUpcoming && data.today.session && nextSession && sessionMeta) {
    nextSession.textContent = `${data.today.session.subject || 'Session'} · ${data.today.session.startTime || ''}`.trim();
    sessionMeta.textContent = data.today.session.mode ? `Mode: ${data.today.session.mode}` : 'Upcoming session confirmed';
  } else if (nextSession && sessionMeta) {
    nextSession.textContent = 'No session scheduled';
    sessionMeta.textContent = 'Use the time to review a topic or upload work.';
  }

  const dueSoon = assignments.filter((item) => ['overdue', 'due_soon'].includes(resolveAssignmentStatus(item)));
  if (dueCount && dueMeta) {
    dueCount.textContent = String(dueSoon.length);
    dueMeta.textContent = dueSoon.length ? 'Assignments need attention' : 'No urgent work today';
  }

  if (momentum && momentumMeta) {
    if (data.predictiveScore?.momentumScore !== undefined) {
      momentum.textContent = `${data.predictiveScore.momentumScore}/100`;
      momentumMeta.textContent = 'Momentum score';
    } else {
      momentum.textContent = `${data.thisWeek?.minutesStudied ?? 0}m`;
      momentumMeta.textContent = 'Focused minutes this week';
    }
  }
}

function updatePrimaryAction(assignments, results) {
  const primary = document.getElementById('primaryNextAction');
  const secondary = document.getElementById('secondaryAction');
  if (!primary || !secondary) {return;}

  const overdue = assignments.find((item) => resolveAssignmentStatus(item) === 'overdue');
  const dueSoon = assignments.find((item) => resolveAssignmentStatus(item) === 'due_soon');
  const latestResult = results?.[0];

  if (overdue) {
    primary.textContent = 'Upload overdue work';
    primary.href = `/dashboard/assignments/detail/?id=${encodeURIComponent(overdue.id)}`;
    secondary.textContent = 'Open assignments';
    secondary.href = '/dashboard/assignments/';
    return;
  }
  if (dueSoon) {
    primary.textContent = 'Upload due work';
    primary.href = `/dashboard/assignments/detail/?id=${encodeURIComponent(dueSoon.id)}`;
    secondary.textContent = 'Open assignments';
    secondary.href = '/dashboard/assignments/';
    return;
  }
  if (latestResult) {
    primary.textContent = 'Review latest result';
    primary.href = `/dashboard/results/detail/?id=${encodeURIComponent(latestResult.id)}`;
    secondary.textContent = 'Open results';
    secondary.href = '/dashboard/results/';
    return;
  }
  primary.textContent = 'Open weekly plan';
  primary.href = '#growthPlan';
  secondary.textContent = 'Open assignments';
  secondary.href = '/dashboard/assignments/';
}

function updateUploadGuide(target, assignmentsResult, assignments) {
  if (!target) {return;}
  if (!assignmentsResult.available) {
    target.innerHTML = '<strong>Waiting for assignment API</strong>Upload controls activate when due assignments are available from the learner assignment endpoint.';
    return;
  }
  if (!assignments.length) {
    target.innerHTML = '<strong>No uploads needed right now</strong>When your tutor assigns work, this panel will guide you through upload and confirmation.';
    return;
  }
  const focus = assignments[0];
  const due = focus.dueDate || focus.due_date;
  const dueLabel = due ? new Date(due).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'No due date';
  target.innerHTML = `<strong>${escapeHtml(focus.title || focus.topic || 'Next assignment')}</strong>${escapeHtml([focus.subject, `Due ${dueLabel}`].filter(Boolean).join(' • '))}<div class="note">Use the upload controls to confirm submission and keep your tutor updated.</div>`;
}

updateTodayDate();
setupReflection();

(async () => {
  const authState = await waitForStudentAuth();
  if (!authState) {
    return;
  }
  setupStudentSession(authState);

  const upcoming = document.getElementById('upcomingSession');
  const snapshot = document.getElementById('progressSnapshot');
  renderLoading(upcoming, 'Loading your next session...');
  renderLoading(snapshot, 'Loading progress snapshot...');
  const assignmentsList = document.getElementById('assignmentsList');
  const resultsList = document.getElementById('resultsList');
  const comparison = document.getElementById('classComparison');
  renderLoading(assignmentsList, 'Checking assignments due...');
  renderLoading(resultsList, 'Loading marked results...');
  renderLoading(comparison, 'Preparing anonymised comparison...');

  let data = null;
  let assignmentsResult = { available: false, items: [] };
  let resultsResult = { available: false, items: [] };
  let statsResult = { available: false, items: [] };
  try {
    [data, assignmentsResult, resultsResult, statsResult] = await Promise.all([
      loadJson('/dashboard'),
      fetchStudentAssignments(),
      fetchStudentResults(),
      fetchClassStats(),
    ]);
  } catch (_err) {
    renderError(upcoming, 'Could not load your dashboard.');
    renderError(snapshot, 'Could not load progress snapshot.');
    return;
  }

  track('dashboard.viewed', {});

  setText('#metricXp', String(data.streak?.xp ?? 0));
  setText('#metricStreak', `${data.streak?.current ?? 0} days`);
  setText('#metricMinutes', String(data.thisWeek?.minutesStudied ?? 0));
  setText('#metricSessions', String(data.thisWeek?.sessionsAttended ?? 0));
  const sortedAssignments = sortAssignmentsByUrgency(assignmentsResult.items || []);
  const openAssignments = sortedAssignments.filter((item) => !['submitted', 'marked'].includes(String(item.status || '').toLowerCase()));
  setText('#metricAssignments', String(assignmentsResult.available ? openAssignments.length : 0));
  setText('#assignmentMetricHint', assignmentsResult.available ? 'Open learner tasks' : 'Assignment API needed');
  const resultItems = resultsResult.items || [];
  const percentages = resultItems.map((item) => Number(item.percentage)).filter(Number.isFinite);
  const average = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  setText('#metricAverage', average === null ? '—' : `${average}%`);
  setText('#confidenceTrend', data.predictiveScore ? `Momentum ${data.predictiveScore.momentumScore}/100` : 'Awaiting confidence data');
  setText('#recommendedTitle', data.recommendedNext?.title || 'Build one strong study block');
  setText('#recommendedDescription', data.recommendedNext?.description || 'Choose one subject, work calmly, and leave a note for your next session.');
  setText('#heroTitle', data.recommendedNext?.title || "Today's next step");
  setText('#heroSubtitle', data.recommendedNext?.description || 'Your next best step will appear here as sessions, assignments, and results build up.');
  updateWeeklyRhythm(data);
  updateHeroKpis(data, sortedAssignments);
  updatePrimaryAction(sortedAssignments, resultItems);
  updateUploadGuide(document.getElementById('uploadHelp'), assignmentsResult, sortedAssignments);

  const todayPace = document.getElementById('todayPace');
  if (todayPace) {
    const minutes = Number(data.thisWeek?.minutesStudied ?? 0);
    todayPace.textContent = minutes >= 150 ? 'On pace' : minutes >= 60 ? 'Building' : 'Starting';
  }

  if (data.today?.hasUpcoming && data.today.session) {
    renderList(upcoming, [data.today.session], renderSession);
  } else {
    smartEmpty(upcoming, data.today?.emptyState?.title || 'No session scheduled today.', 'Use this window to review one topic, upload any due work, or prepare a focused question for your tutor.');
  }

  if (data.progressSnapshot?.length) {
    renderList(snapshot, data.progressSnapshot || [], renderSnapshot);
  } else {
    smartEmpty(snapshot, 'No progress snapshot yet.', 'Once sessions are approved, your subject rhythm and topic minutes will appear here.');
  }

  if (!assignmentsResult.available) {
    smartEmpty(assignmentsList, 'Assignments API not enabled yet.', 'When the learner assignment endpoint is available, due work will appear here with upload, submitted, and marked states.');
  } else if (!sortedAssignments.length) {
    smartEmpty(assignmentsList, 'No assignments due right now.', 'When your tutor gives you homework or a task, it will appear here with the due date and upload button.');
  } else {
    renderList(assignmentsList, sortedAssignments.slice(0, 4), (item) => renderAssignmentCard(item, assignmentsResult.available));
  }

  if (!resultsResult.available) {
    smartEmpty(resultsList, 'Results API not enabled yet.', 'Marked assignments and tutor feedback will appear here once the results endpoint is available.');
  } else if (!resultItems.length) {
    smartEmpty(resultsList, 'No marked assignments yet.', 'Once your tutor marks your work, your scores, strengths, and improvement areas will appear here.');
  } else {
    renderList(resultsList, resultItems.slice(0, 3), renderResultCard);
  }

  renderComparison(comparison, statsResult, resultItems);
})();
