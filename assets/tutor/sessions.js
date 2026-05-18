import { apiFetch, loadJson, renderList, setActiveNav } from '/assets/common.js';

setActiveNav('sessions');

let sessions = [];

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {el.value = value || '';}
}

function feedback(text) {
  const el = document.getElementById('sessionReportFeedback');
  if (el) {el.textContent = text;}
}

async function saveJson(path, method, payload) {
  const res = await apiFetch(path, { method, body: payload });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'request_failed');
  }
  return res.json();
}

function selectSession(item) {
  setValue('sessionId', item.id);
  setValue('attendanceStatus', item.attendance_status || 'present');
  setValue('topicsCovered', item.topics_covered || '');
  setValue('learnerStruggles', item.learner_struggles || '');
  setValue('homeworkAssigned', item.homework_assigned || '');
  setValue('studentSummary', item.student_summary || item.notes || '');
  setValue('tutorPrivateNotes', item.tutor_private_notes || '');
}

function renderSession(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  const title = document.createElement('strong');
  title.textContent = item.student_name || item.studentName || 'Student';
  const meta = document.createElement('div');
  meta.textContent = `${String(item.date).slice(0, 10)} - ${String(item.start_time || item.startTime || '').slice(0, 5)} ${String(item.end_time || item.endTime || '').slice(0, 5)}`;
  const status = document.createElement('div');
  status.textContent = `Status: ${item.status}`;
  const button = document.createElement('button');
  button.className = 'button secondary';
  button.type = 'button';
  button.textContent = item.status === 'DRAFT' ? 'Open report' : 'View report';
  button.addEventListener('click', () => selectSession(item));
  wrapper.append(title, meta, status, button);
  return wrapper;
}

async function load() {
  const data = await loadJson('/tutor/sessions').catch(() => ({ sessions: [] }));
  sessions = data.sessions || [];
  renderList(document.getElementById('tutorSessionsList'), sessions, renderSession);
}

document.getElementById('sessionReportForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const sessionId = document.getElementById('sessionId')?.value;
  if (!sessionId) {
    feedback('Select a session first.');
    return;
  }
  try {
    await saveJson(`/tutor/sessions/${sessionId}/report`, 'PATCH', {
      attendanceStatus: document.getElementById('attendanceStatus').value,
      topicsCovered: document.getElementById('topicsCovered').value,
      learnerStruggles: document.getElementById('learnerStruggles').value,
      homeworkAssigned: document.getElementById('homeworkAssigned').value,
      studentSummary: document.getElementById('studentSummary').value,
      tutorPrivateNotes: document.getElementById('tutorPrivateNotes').value,
    });
    feedback('Report draft saved.');
    await load();
  } catch (err) {
    feedback(err.message || 'Unable to save report.');
  }
});

document.getElementById('submitSessionReport')?.addEventListener('click', async () => {
  const sessionId = document.getElementById('sessionId')?.value;
  if (!sessionId) {
    feedback('Select a session first.');
    return;
  }
  try {
    await saveJson(`/tutor/sessions/${sessionId}/submit`, 'POST', {});
    feedback('Report submitted for admin review.');
    await load();
  } catch (err) {
    feedback(err.message || 'Unable to submit report.');
  }
});

load();
