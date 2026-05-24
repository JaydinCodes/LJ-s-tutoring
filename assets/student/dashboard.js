import { apiFetch, loadJson, renderList, renderLoading, renderError, setActiveNav, setText } from '/assets/common.js';
import { track } from '/assets/analytics-module.js';
import {
  fetchClassStats,
  fetchStudentAssignments,
  fetchStudentResults,
  sortAssignmentsByUrgency,
  uploadAssignmentSubmission,
  validateSubmissionFile,
} from '/assets/student/learning-api.js';
import {
  formatDate,
  renderAssignmentCard,
  renderComparison,
  renderResultCard,
  renderRows,
  renderSession,
  renderSingleCard,
  renderSubjectSnapshot,
  smartEmpty,
} from '/assets/student/dashboard-renderers.js';
import { renderNotificationCard as renderNotificationFeedCard } from '/assets/student/notifications.js';

setActiveNav('dashboard');

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

function buildAgendaItems(data, assignments) {
  const agendaItems = [];
  if (data.today?.session) {
    agendaItems.push([
      `Upcoming lesson | ${data.today.session.subject || 'Scheduled lesson'}`,
      `${formatDate(data.today.session.date, { weekday: 'short', day: 'numeric', month: 'short' })} | ${data.today.session.startTime || ''}`.trim(),
      `Status: ${data.today.session.mode || 'session'}`,
    ]);
  }

  assignments.slice(0, 3).forEach((item) => {
    agendaItems.push([
      `Assignment | ${item.title || item.topic || 'Assignment due'}`,
      item.due_date || item.dueDate ? `Due ${formatDate(item.due_date || item.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Due date pending',
      `Status: ${String(item.submission_status || item.status || 'upcoming').replace(/_/g, ' ')}`,
    ]);
  });

  (data.goals || []).slice(0, 2).forEach((goal) => {
    agendaItems.push([
      `Goal milestone | ${goal.title || 'Goal'}`,
      goal.due_date ? `Due ${formatDate(goal.due_date, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'No due date',
      `Status: ${goal.status || 'active'}`,
    ]);
  });

  return agendaItems;
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
  const assignmentsList = document.getElementById('assignmentsList');
  const resultsList = document.getElementById('resultsList');
  const comparison = document.getElementById('classComparison');
  const agenda = document.getElementById('upcomingAgenda');
  const recentActivity = document.getElementById('recentActivity');
  const notifications = document.getElementById('notificationsList');

  renderLoading(upcoming, 'Loading your next session...');
  renderLoading(snapshot, 'Loading progress snapshot...');
  renderLoading(assignmentsList, 'Checking assignments due...');
  renderLoading(resultsList, 'Loading marked results...');
  renderLoading(comparison, 'Preparing anonymised comparison...');
  renderLoading(agenda, 'Loading upcoming agenda...');
  renderLoading(recentActivity, 'Loading recent activity...');
  renderLoading(notifications, 'Loading notifications...');

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
  } catch {
    renderError(upcoming, 'Could not load your dashboard.');
    renderError(snapshot, 'Could not load progress snapshot.');
    renderError(assignmentsList, 'Could not load assignments.');
    renderError(resultsList, 'Could not load results.');
    renderError(comparison, 'Could not load comparison.');
    renderError(agenda, 'Could not load your upcoming agenda.');
    renderError(recentActivity, 'Could not load learning activity.');
    renderError(notifications, 'Could not load notifications.');
    return;
  }

  track('dashboard.viewed', {});

  const sortedAssignments = sortAssignmentsByUrgency(assignmentsResult.items || []);
  const openAssignments = sortedAssignments.filter((item) => !['submitted', 'marked'].includes(String(item.submission_status || item.status || '').toLowerCase()));
  const completedAssignments = sortedAssignments.filter((item) => ['submitted', 'marked'].includes(String(item.submission_status || item.status || '').toLowerCase()));
  const dueSoonAssignments = sortedAssignments.filter((item) => String(item.status || '').toLowerCase() === 'due_soon');
  const resultItems = resultsResult.items || [];
  const percentages = resultItems.map((item) => Number(item.percentage)).filter(Number.isFinite);
  const average = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  const attendanceRate = data.attendance?.total > 0 ? Math.round((data.attendance.attended / data.attendance.total) * 100) : 0;
  const rhythmLabel = `${data.thisWeek?.minutesStudied ?? 0} mins | ${data.thisWeek?.sessionsAttended ?? 0} sessions`;
  const unreadNotifications = Number(data.notificationsUnreadCount ?? data.notifications_unread_count ?? 0);
  const notificationItems = Array.isArray(data.notifications) ? data.notifications : [];

  setText('#metricAverage', average === null ? '--' : `${average}%`);
  setText('#metricCompleted', String(completedAssignments.length));
  setText('#metricPending', String(openAssignments.length));
  setText('#metricPendingInline', `${openAssignments.length} open`);
  setText('#metricDueSoon', `${dueSoonAssignments.length} item${dueSoonAssignments.length === 1 ? '' : 's'}`);
  setText('#metricStreak', `${data.streak?.current ?? 0} days`);
  setText('#metricAttendance', `${attendanceRate}%`);
  setText('#confidenceTrend', data.predictiveScore ? `Momentum ${data.predictiveScore.momentumScore}/100` : 'Awaiting confidence data');
  setText('#recommendedTitle', data.recommendedNext?.title || 'Build one strong study block');
  setText('#recommendedDescription', data.recommendedNext?.description || 'Choose one subject, work calmly, and leave a note for your next session.');
  setText('#heroTitle', `Hello ${data.profile?.name?.split(' ')[0] || 'Learner'}, keep moving with clarity.`);
  setText('#heroSubtitle', data.recommendedNext?.description || 'Your next best step will appear here as sessions, assignments, and results build up.');
  setText('#heroAverage', average === null ? '--' : `${average}%`);
  setText('#heroAverageNote', average === null ? 'Waiting for marked results' : `${resultItems.length} result${resultItems.length === 1 ? '' : 's'} tracked`);
  setText('#heroRhythm', `${data.streak?.current ?? 0} day streak`);
  setText('#heroRhythmNote', rhythmLabel);
  updateWeeklyRhythm(data);

  const topbarCount = document.getElementById('notificationCount');
  const panelCount = document.getElementById('notificationCountPanel');
  if (topbarCount) {
    topbarCount.hidden = unreadNotifications <= 0;
    topbarCount.textContent = unreadNotifications > 0 ? `${unreadNotifications} new` : '';
  }
  if (panelCount) {
    panelCount.textContent = unreadNotifications > 0 ? `${unreadNotifications} new` : 'All caught up';
  }

  const profile = data.profile || {};
  const profileCompletion = profile.completion?.required?.length
    ? Math.round((Number(profile.completion.completed || 0) / profile.completion.required.length) * 100)
    : 0;

  renderSingleCard(document.getElementById('profileSummary'), [
    profile.name || 'Learner',
    [profile.grade, profile.school].filter(Boolean).join(' - '),
    profile.guardian?.name ? `Guardian: ${profile.guardian.name}${profile.guardian.relationship ? ` (${profile.guardian.relationship})` : ''}` : 'Guardian not recorded',
    profile.guardian?.contactStatus === 'available_through_admin' ? 'Guardian contact available through admin' : 'Guardian contact not recorded',
    `Profile completion: ${profileCompletion}%`,
  ], 'Profile is not available yet.', 'Ask admin to complete your learner profile.');

  const academicProfile = data.academicProfile || {};
  const enrolledSubjects = academicProfile.enrolledSubjects || [];
  const activeTutoringSubjects = academicProfile.activeTutoringSubjects || [];
  const profilePills = document.getElementById('profilePills');
  if (profilePills) {
    profilePills.innerHTML = '';
    [academicProfile.grade || 'Grade pending', academicProfile.school || 'School pending', `${enrolledSubjects.length} subjects`, `${activeTutoringSubjects.length} tutoring tracks`]
      .forEach((label) => {
        const pill = document.createElement('span');
        pill.className = 'profile-pill';
        pill.textContent = label;
        profilePills.append(pill);
      });
  }

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

  const baselineAndReport = document.getElementById('baselineAndReport');
  if (baselineAndReport) {
    baselineAndReport.innerHTML = '';
  }
  const baseline = data.baseline;
  renderSingleCard(baselineAndReport, baseline ? [
    `${baseline.subject} - ${Math.round(Number(baseline.percentage || 0))}%`,
    [baseline.level_band, baseline.grade, baseline.completed_at ? `Completed ${formatDate(baseline.completed_at)}` : ''].filter(Boolean).join(' - '),
    Array.isArray(baseline.recommended_next_steps_json) && baseline.recommended_next_steps_json.length
      ? `Next: ${baseline.recommended_next_steps_json[0]}`
      : 'Next steps will appear after review.',
  ] : [], 'No baseline assessment yet.', 'Your baseline summary appears after admin records or uploads a diagnostic result.');

  const latestReport = data.latestReport;
  if (latestReport && baselineAndReport) {
    baselineAndReport.appendChild(renderRows([
      `Week ${latestReport.weekStart} to ${latestReport.weekEnd}`,
      `Generated ${formatDate(latestReport.createdAt)}`,
      Array.isArray(latestReport.summary) && latestReport.summary.length ? latestReport.summary[0] : 'Open reports for the full weekly summary.',
    ]));
  }

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
    data.attendance.items.slice(0, 4).forEach((item) => attendanceTarget.appendChild(renderAttendance(item)));
  } else {
    smartEmpty(attendanceTarget, 'No attendance history yet.', 'Approved sessions and submitted reports will build your attendance record.');
  }

  if (data.today?.hasUpcoming && data.today.session) {
    renderList(upcoming, [data.today.session], renderSession);
  } else {
    smartEmpty(upcoming, data.today?.emptyState?.title || 'No session scheduled today.', 'Use this window to review one topic, upload any due work, or prepare a focused question for your tutor.');
  }

  if (data.progressSnapshot?.length) {
    renderList(snapshot, data.progressSnapshot || [], renderSubjectSnapshot);
  } else {
    smartEmpty(snapshot, 'No progress snapshot yet.', 'Once sessions are approved, your subject rhythm and topic minutes will appear here.');
  }

  if (!assignmentsResult.available) {
    smartEmpty(assignmentsList, 'Assignments API not enabled yet.', 'When the learner assignment endpoint is available, due work will appear here with upload, submitted, and marked states.');
  } else if (!sortedAssignments.length) {
    smartEmpty(assignmentsList, 'No assignments due right now.', 'When your tutor gives you homework or a task, it will appear here with the due date and upload button.');
  } else {
    renderList(assignmentsList, sortedAssignments.slice(0, 4), (item) => renderAssignmentCard(item, assignmentsResult.available, validateSubmissionFile, uploadAssignmentSubmission, track));
  }

  if (!resultsResult.available) {
    smartEmpty(resultsList, 'Results API not enabled yet.', 'Marked assignments and tutor feedback will appear here once the results endpoint is available.');
  } else if (!resultItems.length) {
    smartEmpty(resultsList, 'No marked assignments yet.', 'Once your tutor marks your work, your scores, strengths, and improvement areas will appear here.');
  } else {
    renderList(resultsList, resultItems.slice(0, 3), renderResultCard);
  }

  renderComparison(comparison, statsResult, resultItems);

  const readiness = Math.max(0, Math.min(100, average ?? Number(data.predictiveScore?.momentumScore || 0)));
  const readinessGauge = document.getElementById('readinessGauge');
  if (readinessGauge) {
    readinessGauge.style.setProperty('--score-angle', `${Math.round((readiness / 100) * 360)}deg`);
  }
  setText('#readinessScore', `${readiness}%`);
  setText('#readinessCaption', data.supportStatus?.explanation || 'Momentum updates as attendance, progress, and results build.');

  if (data.sessionSummaries?.length) {
    renderList(recentActivity, data.sessionSummaries, (item) => renderRows([
      `${item.subject || 'Session'} | ${formatDate(item.date)}`,
      item.student_summary || 'Session summary pending',
      item.homework_assigned ? `Homework: ${item.homework_assigned}` : 'No homework captured for this session.',
    ]));
  } else {
    smartEmpty(recentActivity, 'No recent learning activity yet.', 'Approved sessions with tutor notes and homework will appear here.');
  }

  const markNotificationRead = async (notificationId) => {
    const response = await apiFetch(`/student/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
    if (!response.ok) {
      throw new Error(`notification_read_failed:${response.status}`);
    }
    window.location.reload();
  };

  if (!notificationItems.length) {
    smartEmpty(notifications, 'No notifications yet.', 'Assignments, goals, reports, and tutor updates will appear here automatically.');
  } else {
    renderList(notifications, notificationItems.slice(0, 6), (item) => renderNotificationFeedCard(item, markNotificationRead));
  }

  const agendaItems = buildAgendaItems(data, sortedAssignments);
  if (agendaItems.length) {
    renderList(agenda, agendaItems.slice(0, 6), (item) => renderRows(item, 'agenda-item'));
  } else {
    smartEmpty(agenda, 'No upcoming events yet.', 'Upcoming lessons, assignment due dates, and visible goals will appear here.');
  }
})();
