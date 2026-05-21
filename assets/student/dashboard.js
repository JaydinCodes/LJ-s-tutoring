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

function renderRows(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  rows.filter((row) => row !== null && row !== undefined && row !== '').forEach((row, index) => {
    const el = document.createElement(index === 0 ? 'strong' : 'div');
    el.textContent = String(row);
    wrapper.appendChild(el);
  });
  return wrapper;
}

function renderSingleCard(target, rows, emptyTitle, emptyDetail) {
  if (!target) {return;}
  if (!rows || rows.length === 0) {
    smartEmpty(target, emptyTitle, emptyDetail);
    return;
  }
  renderList(target, [rows], renderRows);
}

function formatDate(value) {
  if (!value) {return '';}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return String(value).slice(0, 10);}
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderGoal(goal) {
  const progress = goal.target_value ? Math.round((Number(goal.current_value || 0) / Number(goal.target_value)) * 100) : null;
  return renderRows([
    goal.title,
    [goal.category, goal.subject, goal.due_date ? `Due ${formatDate(goal.due_date)}` : '', goal.status].filter(Boolean).join(' - '),
    progress === null ? (goal.description || 'Goal progress will update as your tutor/admin records progress.') : `${Math.max(0, Math.min(100, progress))}% progress`,
  ]);
}

function renderAttendance(item) {
  return renderRows([
    `${item.subject || 'Session'} - ${String(item.attendance_status || item.status || '').replace(/_/g, ' ')}`,
    `${formatDate(item.date)} ${String(item.start_time || '').slice(0, 5)}`.trim(),
    item.tutor_name ? `Tutor: ${item.tutor_name}` : '',
  ]);
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

function renderAssignmentCard(assignment, apiAvailable) {
  const due = assignment.dueDate || assignment.due_date;
  const status = String(assignment.submission_status || assignment.status || '').toLowerCase() || (daysUntil(due) < 0 ? 'overdue' : 'upcoming');
  const card = document.createElement('article');
  card.className = 'assignment-card';
  card.dataset.urgency = status;

  const title = document.createElement('div');
  title.className = 'status-row';
  title.innerHTML = `<div><span class="tiny-label">${escapeHtml(assignment.subject || 'Assignment')}</span><h3 class="panel-title">${escapeHtml(assignment.title || assignment.topic || 'Learning task')}</h3></div><span class="badge subtle ${status === 'overdue' ? 'down overdue' : status === 'submitted' || status === 'marked' ? 'up submitted' : 'flat due-soon'}">${escapeHtml(statusLabel(status))}</span>`;

  const meta = document.createElement('p');
  meta.className = 'note';
  const delta = daysUntil(due);
  meta.textContent = [
    assignment.topic,
    due ? `Due ${new Date(due).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : 'No due date set',
    delta === null ? '' : delta < 0 ? `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue` : delta === 0 ? 'Due today' : `${delta} day${delta === 1 ? '' : 's'} left`,
  ].filter(Boolean).join(' • ');

  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('span');
  fill.style.width = `${Math.max(8, Math.min(100, Number(assignment.progress || (status === 'submitted' ? 75 : status === 'marked' ? 100 : 35))))}%`;
  progress.append(fill);

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
    : 'Upload endpoint is not available yet. Your tutor/admin team needs to enable student submissions.';
  const submit = document.createElement('button');
  submit.className = 'button secondary';
  submit.type = 'button';
  submit.textContent = assignment.submission_id ? 'Replace submission' : 'Upload submission';
  if (assignment.original_filename) {
    state.textContent = `Current file: ${assignment.original_filename}${assignment.submitted_at ? `, submitted ${formatDate(assignment.submitted_at)}` : ''}.`;
  }
  submit.disabled = file.disabled;
  const state = document.createElement('span');
  state.className = 'note';
  state.setAttribute('aria-live', 'polite');
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
  card.append(title, meta, progress, upload);
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
      <div><span class="tiny-label">${escapeHtml(result.subject || 'Result')}</span><h3 class="panel-title">${escapeHtml(result.title || 'Marked work')}</h3></div>
      <strong class="metric-value">${pct === null || pct === undefined ? '—' : `${pct}%`}</strong>
    </div>
    <p class="note">${escapeHtml([result.topic, result.markedAt ? `Marked ${new Date(result.markedAt).toLocaleDateString('en-ZA')}` : '', result.score !== undefined && result.totalMarks ? `${result.score}/${result.totalMarks}` : ''].filter(Boolean).join(' • '))}</p>
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

function initOdiePanel() {
  const form = document.getElementById('odieForm');
  const input = document.getElementById('odieInput');
  const messages = document.getElementById('odieMessages');
  const state = document.getElementById('odieState');
  if (!form || !input || !messages || !state) {return;}

  let conversationId = null;
  const addMessage = (role, text) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'You' : 'Odie';
    const body = document.createElement('div');
    body.textContent = text;
    item.append(label, body);
    messages.append(item);
  };

  messages.innerHTML = '<div class="empty-state"><strong>Ask Odie anything about your learning.</strong><span>Odie uses your dashboard context when it is available and will say when something is missing.</span></div>';

  async function send(message) {
    const clean = String(message || '').trim();
    if (!clean) {return;}
    if (messages.querySelector('.empty-state')) {messages.innerHTML = '';}
    addMessage('user', clean);
    input.value = '';
    state.textContent = 'Odie is thinking...';
    try {
      const res = await apiFetch('/student/odie/chat', {
        method: 'POST',
        body: { message: clean, conversationId },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {throw new Error(payload?.error || 'odie_failed');}
      conversationId = payload.conversationId || conversationId;
      addMessage('assistant', payload.message || payload.text || 'I need a little more context before I can help.');
      state.textContent = '';
    } catch {
      state.textContent = 'Odie is unavailable right now. Please try again later.';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value);
  });
  document.querySelectorAll('[data-odie-prompt]').forEach((button) => {
    button.addEventListener('click', () => send(button.dataset.odiePrompt));
  });
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

updateTodayDate();
setupReflection();
initOdiePanel();

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
  setText('#assignmentMetricHint', assignmentsResult.available ? 'Open learner tasks' : 'API contract needed');
  const resultItems = resultsResult.items || [];
  const percentages = resultItems.map((item) => Number(item.percentage)).filter(Number.isFinite);
  const average = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  setText('#metricAverage', average === null ? '—' : `${average}%`);
  setText('#confidenceTrend', data.predictiveScore ? `Momentum ${data.predictiveScore.momentumScore}/100` : 'Awaiting confidence data');
  setText('#recommendedTitle', data.recommendedNext?.title || 'Build one strong study block');
  setText('#recommendedDescription', data.recommendedNext?.description || 'Choose one subject, work calmly, and leave a note for your next session.');
  setText('#heroTitle', data.recommendedNext?.title || 'Settle in. Grow steadily.');
  setText('#heroSubtitle', data.recommendedNext?.description || 'Your next best step will appear here as sessions, assignments, and results build up.');
  updateWeeklyRhythm(data);

  const profile = data.profile || {};
  const profileCompletion = profile.completion?.required?.length
    ? Math.round((Number(profile.completion.completed || 0) / profile.completion.required.length) * 100)
    : 0;
  renderSingleCard(document.getElementById('profileCard'), [
    profile.name || 'Learner',
    [profile.grade, profile.school].filter(Boolean).join(' - '),
    profile.guardian?.name ? `Guardian: ${profile.guardian.name}${profile.guardian.relationship ? ` (${profile.guardian.relationship})` : ''}` : 'Guardian not recorded',
    profile.guardian?.contactStatus === 'available_through_admin' ? 'Guardian contact available through admin' : 'Guardian contact not recorded',
    profile.partnerAffiliation ? `Partner: ${profile.partnerAffiliation}` : '',
    `Profile completion: ${profileCompletion}%`,
  ], 'Profile is not available yet.', 'Ask admin to complete your learner profile.');

  const academicProfile = data.academicProfile || {};
  const enrolledSubjects = academicProfile.enrolledSubjects || [];
  const activeTutoringSubjects = academicProfile.activeTutoringSubjects || [];
  renderSingleCard(document.getElementById('academicProfileCard'), [
    academicProfile.grade || 'Grade not recorded',
    academicProfile.school ? `School: ${academicProfile.school}` : 'School not recorded',
    enrolledSubjects.length ? `Subjects: ${enrolledSubjects.join(', ')}` : 'Subjects not recorded',
    activeTutoringSubjects.length ? `Tutoring: ${activeTutoringSubjects.join(', ')}` : 'No active tutoring subjects yet',
  ], 'Academic profile is not available yet.', 'Admin manages grade, school, and subject records.');

  const tutorTarget = document.getElementById('assignedTutorList');
  if (Array.isArray(data.assignedTutors) && data.assignedTutors.length) {
    renderList(tutorTarget, data.assignedTutors, (tutor) => renderRows([
      tutor.full_name || 'Tutor',
      tutor.subject ? `Subject: ${tutor.subject}` : '',
      tutor.qualification_band ? `Approved band: ${tutor.qualification_band}` : '',
    ]));
  } else {
    smartEmpty(tutorTarget, 'No tutor assigned yet.', 'When admin assigns a tutor, their name and subject will appear here.');
  }

  const support = data.supportStatus;
  renderSingleCard(document.getElementById('supportStatusCard'), support ? [
    support.label,
    support.explanation,
    `Next action: ${support.recommendedAction}`,
    data.predictiveScore ? `Momentum: ${data.predictiveScore.momentumScore}/100` : '',
  ] : [], 'Support status is waiting for data.', 'Risk/support bands are calculated from learning signals once enough data exists.');

  const baseline = data.baseline;
  renderSingleCard(document.getElementById('baselineCard'), baseline ? [
    `${baseline.subject} - ${Math.round(Number(baseline.percentage || 0))}%`,
    [baseline.level_band, baseline.grade, baseline.completed_at ? `Completed ${formatDate(baseline.completed_at)}` : ''].filter(Boolean).join(' - '),
    Array.isArray(baseline.recommended_next_steps_json) && baseline.recommended_next_steps_json.length
      ? `Next: ${baseline.recommended_next_steps_json[0]}`
      : 'Next steps will appear after review.',
  ] : [], 'No baseline assessment yet.', 'Your baseline summary appears after admin records or uploads a diagnostic result.');

  const latestReport = data.latestReport;
  renderSingleCard(document.getElementById('latestReportCard'), latestReport ? [
    `Week ${latestReport.weekStart} to ${latestReport.weekEnd}`,
    `Generated ${formatDate(latestReport.createdAt)}`,
    Array.isArray(latestReport.summary) && latestReport.summary.length ? latestReport.summary[0] : 'Open reports for the full weekly summary.',
  ] : [], 'No progress report yet.', 'Generate a weekly report once you have approved sessions and activity.');

  const goalsTarget = document.getElementById('goalsList');
  if (Array.isArray(data.goals) && data.goals.length) {
    renderList(goalsTarget, data.goals, renderGoal);
  } else {
    smartEmpty(goalsTarget, 'No active goals yet.', 'Admin or your tutor can add academic, attendance, assignment, career, or support goals.');
  }

  const attendanceTarget = document.getElementById('attendanceList');
  if (data.attendance?.items?.length) {
    const rate = data.attendance.total > 0 ? Math.round((data.attendance.attended / data.attendance.total) * 100) : null;
    const rateNode = renderRows([rate === null ? 'Attendance rate pending' : `Attendance rate: ${rate}%`]);
    attendanceTarget.replaceChildren(rateNode);
    data.attendance.items.slice(0, 6).forEach((item) => attendanceTarget.appendChild(renderAttendance(item)));
  } else {
    smartEmpty(attendanceTarget, 'No attendance history yet.', 'Approved sessions and submitted reports will build your attendance record.');
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
