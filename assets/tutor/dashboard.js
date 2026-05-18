import { apiFetch, loadJson, renderList, renderEmpty, setActiveNav, setText } from '/assets/common.js';

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

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

async function saveJson(path, method, payload) {
  const res = await apiFetch(path, { method, body: payload });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'request_failed');
  }
  return res.json();
}

function renderSimpleItem(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  rows.forEach((row, index) => {
    const el = document.createElement(index === 0 ? 'strong' : 'div');
    el.textContent = row;
    wrapper.appendChild(el);
  });
  return wrapper;
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
    approval: { approval_status: 'approved' },
    performance: { reportSubmissionRate: 0, missingReports: 0, verifiedVolunteerHours: 0, assignedLearners: 0 },
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
  setText('#tutorMetricReportRate', `${Number(data.performance?.reportSubmissionRate || 0)}%`);

  renderList(document.getElementById('tutorTodaySessions'), todaySessions, renderTodaySession);
  renderQuickTools(document.getElementById('tutorQuickTools'), quickTools);
  renderList(document.getElementById('tutorAttentionList'), attention, renderAttentionItem);

  renderList(document.getElementById('approvalStatusCard'), [data.approval || {}], (item) => renderSimpleItem([
    `Status: ${toText(item.approval_status || item.application_status || 'draft')}`,
    item.approval_note ? `Note: ${item.approval_note}` : 'Keep your profile, documents, and availability up to date.',
    `Missing reports: ${Number(data.performance?.missingReports || 0)}`,
    `Verified volunteer hours: ${Number(data.performance?.verifiedVolunteerHours || 0)}`,
  ]));

  const application = await loadJson('/tutor/application').catch(() => ({ application: null }));
  const appRow = application.application || {};
  document.getElementById('applicationSubjects').value = Array.isArray(appRow.subjects_json) ? appRow.subjects_json.join(', ') : '';
  document.getElementById('applicationGrades').value = Array.isArray(appRow.grades_json) ? appRow.grades_json.join(', ') : '';
  document.getElementById('applicationPreferences').value = Array.isArray(appRow.teaching_preferences_json) ? appRow.teaching_preferences_json.join(', ') : '';
  document.getElementById('applicationExperience').value = appRow.experience || '';
  document.getElementById('applicationAvailability').value = appRow.availability_notes || '';

  const docs = await loadJson('/tutor/documents').catch(() => ({ documents: [] }));
  renderList(document.getElementById('documentList'), docs.documents || [], (doc) => renderSimpleItem([
    `${doc.document_type}: ${doc.original_filename}`,
    `Status: ${doc.verification_status}`,
  ]));

  const availability = await loadJson('/tutor/availability').catch(() => ({ slots: [] }));
  renderList(document.getElementById('availabilityList'), availability.slots || [], (slot) => renderSimpleItem([
    `Day ${slot.day_of_week}: ${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(0, 5)}`,
    `Mode: ${slot.mode}`,
  ]));

  const volunteer = await loadJson('/tutor/volunteer/logs').catch(() => ({ logs: [] }));
  renderList(document.getElementById('volunteerList'), volunteer.logs || [], (log) => renderSimpleItem([
    log.event_title || 'Volunteer hours',
    `${log.hours || 0} hours - ${log.status}`,
  ]));

  document.getElementById('applicationForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.getElementById('applicationFeedback');
    try {
      await saveJson('/tutor/application', 'PATCH', {
        subjects: splitCsv(document.getElementById('applicationSubjects').value),
        grades: splitCsv(document.getElementById('applicationGrades').value),
        teachingPreferences: splitCsv(document.getElementById('applicationPreferences').value),
        experience: document.getElementById('applicationExperience').value,
        availabilityNotes: document.getElementById('applicationAvailability').value,
      });
      feedback.textContent = 'Application saved.';
    } catch (err) {
      feedback.textContent = err.message || 'Unable to save application.';
    }
  });

  document.getElementById('submitApplication')?.addEventListener('click', async () => {
    const feedback = document.getElementById('applicationFeedback');
    try {
      await saveJson('/tutor/application/submit', 'POST', {});
      feedback.textContent = 'Application submitted.';
    } catch (err) {
      feedback.textContent = err.message || 'Unable to submit application.';
    }
  });

  document.getElementById('documentForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = document.getElementById('documentFile').files?.[0];
    const feedback = document.getElementById('documentFeedback');
    if (!file) {
      feedback.textContent = 'Choose a file.';
      return;
    }
    try {
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await saveJson('/tutor/documents', 'POST', {
        documentType: document.getElementById('documentType').value,
        originalFilename: file.name,
        mimeType: file.type,
        contentBase64,
      });
      feedback.textContent = 'Document uploaded.';
    } catch (err) {
      feedback.textContent = err.message || 'Unable to upload document.';
    }
  });

  document.getElementById('availabilityForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.getElementById('availabilityFeedback');
    try {
      await saveJson('/tutor/availability', 'PATCH', {
        slots: [{
          dayOfWeek: Number(document.getElementById('availabilityDay').value),
          startTime: document.getElementById('availabilityStart').value,
          endTime: document.getElementById('availabilityEnd').value,
          mode: document.getElementById('availabilityMode').value || 'online',
        }],
      });
      feedback.textContent = 'Availability saved.';
    } catch (err) {
      feedback.textContent = err.message || 'Unable to save availability.';
    }
  });

  document.getElementById('volunteerForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.getElementById('volunteerFeedback');
    try {
      await saveJson('/tutor/volunteer/logs', 'POST', {
        hours: Number(document.getElementById('volunteerHours').value),
        volunteeredOn: document.getElementById('volunteerDate').value || undefined,
        notes: document.getElementById('volunteerNotes').value || undefined,
      });
      feedback.textContent = 'Volunteer hours submitted.';
    } catch (err) {
      feedback.textContent = err.message || 'Unable to submit volunteer hours.';
    }
  });
})();
