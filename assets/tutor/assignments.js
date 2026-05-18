import { apiFetch, loadJson, renderList, setActiveNav } from '/assets/common.js';

setActiveNav('assignments');

let teachingAssignments = [];

function item(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';
  rows.forEach((row, index) => {
    const el = document.createElement(index === 0 ? 'strong' : 'div');
    el.textContent = row;
    wrapper.appendChild(el);
  });
  return wrapper;
}

async function saveJson(path, method, payload) {
  const res = await apiFetch(path, { method, body: payload });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'request_failed');
  }
  return res.json();
}

function populateAssignmentSelect() {
  const select = document.getElementById('teachingAssignmentSelect');
  if (!select) {return;}
  select.replaceChildren();
  teachingAssignments.forEach((assignment) => {
    const option = document.createElement('option');
    option.value = assignment.id;
    option.textContent = `${assignment.full_name || assignment.studentName || 'Student'} - ${assignment.subject}`;
    select.appendChild(option);
  });
}

async function load() {
  const data = await loadJson('/tutor/assignments').catch(() => ({ assignments: [] }));
  teachingAssignments = data.assignments || [];
  renderList(document.getElementById('tutorAssignmentsList'), teachingAssignments, (assignment) => item([
    assignment.subject,
    assignment.full_name || assignment.studentName || 'Student',
    `${String(assignment.start_date || assignment.startDate).slice(0, 10)} to ${assignment.end_date || assignment.endDate || 'Open-ended'}`,
  ]));
  populateAssignmentSelect();

  const learning = await loadJson('/tutor/learning-assignments').catch(() => ({ assignments: [] }));
  renderList(document.getElementById('learningAssignmentsList'), learning.assignments || [], (assignment) => item([
    assignment.title,
    `${assignment.student_name || 'Student'} - ${assignment.subject}`,
    `Due: ${assignment.due_date ? String(assignment.due_date).slice(0, 10) : 'No due date'} - ${assignment.status}`,
  ]));
}

document.getElementById('learningAssignmentForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const feedback = document.getElementById('learningAssignmentFeedback');
  const assignmentId = document.getElementById('teachingAssignmentSelect')?.value;
  const teaching = teachingAssignments.find((item) => item.id === assignmentId);
  if (!teaching) {
    feedback.textContent = 'Choose an assigned learner first.';
    return;
  }
  try {
    await saveJson('/tutor/learning-assignments', 'POST', {
      assignmentId,
      studentId: teaching.student_id,
      subject: teaching.subject,
      title: document.getElementById('learningTitle').value,
      instructions: document.getElementById('learningInstructions').value,
      dueDate: document.getElementById('learningDueDate').value || undefined,
    });
    feedback.textContent = 'Assignment created for learner and admin views.';
    await load();
  } catch (err) {
    feedback.textContent = err.message || 'Unable to create assignment.';
  }
});

load();
