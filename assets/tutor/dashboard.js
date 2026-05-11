import { loadJson, renderList, renderEmpty, setActiveNav, setText } from '/assets/common.js';

setActiveNav('dashboard');

function toText(value, fallback = '') {
  if (value === null || value === undefined) {return fallback;}
  return String(value);
}

function renderTodaySession(item) {
  const title = document.createElement('strong');
  title.textContent = `${toText(item.time, 'Time TBC')} - ${toText(item.studentName, 'Student')}`;

  const status = document.createElement('div');
  status.textContent = `Status: ${toText(item.status, 'scheduled')}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  wrapper.append(title, status);
  return wrapper;
}

function renderAttentionItem(item) {
  const title = document.createElement('strong');
  title.textContent = toText(item.studentName, 'Student');

  const scores = document.createElement('div');
  scores.textContent = `Risk: ${toText(item.riskScore, '-')} - Momentum: ${toText(item.momentumScore, '-')}`;

  const reasons = document.createElement('div');
  reasons.textContent = Array.isArray(item.reasons) && item.reasons.length
    ? item.reasons.join(' - ')
    : 'No reasons listed yet.';

  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  wrapper.append(title, scores, reasons);
  return wrapper;
}

function renderQuickTools(target, tools) {
  target.innerHTML = '';
  if (!tools.length) {
    renderEmpty(target, 'No quick tools available yet.');
    return;
  }

  tools.forEach((tool) => {
    const a = document.createElement('a');
    a.className = 'list-item';
    a.href = toText(tool.href, '#');
    const label = document.createElement('strong');
    label.textContent = toText(tool.label, 'Open tool');
    const hint = document.createElement('div');
    hint.textContent = 'Open workspace';
    a.append(label, hint);
    target.appendChild(a);
  });
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function localDummyData() {
  return {
    todaySessions: [
      { time: '15:00', studentName: 'Dev Student', status: 'Scheduled' },
      { time: '16:15', studentName: 'Dev Student', status: 'Draft notes' },
    ],
    studentsNeedingAttention: [
      { studentName: 'Dev Student', riskScore: 38, momentumScore: 76, reasons: ['Missed last homework', 'Streak down', 'Exam in 2 weeks'] },
      { studentName: 'Alex Demo', riskScore: 62, momentumScore: 41, reasons: ['Low practice consistency', 'Needs algebra revision'] },
    ],
    quickTools: [
      { label: 'Log a session', href: '/tutor/sessions.html' },
      { label: 'View assignments', href: '/tutor/assignments.html' },
      { label: 'Generate a report', href: '/tutor/reports/' },
      { label: 'Review risk dashboard', href: '/tutor/risk/' },
    ],
  };
}

(async () => {
  const host = window.location.hostname;
  const isLocal = isLoopbackHost(host);

  let data;
  try {
    data = await loadJson('/tutor/dashboard');
  } catch {
    data = isLocal
      ? localDummyData()
      : { todaySessions: [], studentsNeedingAttention: [], quickTools: [] };
  }

  if (isLocal) {
    const todayCount = Array.isArray(data?.todaySessions) ? data.todaySessions.length : 0;
    const attentionCount = Array.isArray(data?.studentsNeedingAttention) ? data.studentsNeedingAttention.length : 0;
    const toolCount = Array.isArray(data?.quickTools) ? data.quickTools.length : 0;
    if (todayCount === 0 && attentionCount === 0 && toolCount === 0) {
      data = localDummyData();
    }
  }

  const todaySessions = data.todaySessions || [];
  const attention = data.studentsNeedingAttention || [];
  const quickTools = data.quickTools || [];

  setText('#tutorMetricSessions', String(todaySessions.length));
  setText('#tutorMetricAttention', String(attention.length));
  setText('#tutorMetricTools', String(quickTools.length));

  renderList(document.getElementById('tutorTodaySessions'), todaySessions, renderTodaySession);
  renderQuickTools(document.getElementById('tutorQuickTools'), quickTools);
  renderList(document.getElementById('tutorAttentionList'), attention, renderAttentionItem);
})();
