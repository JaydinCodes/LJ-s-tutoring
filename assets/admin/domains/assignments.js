import { apiGet, apiPatch, apiPost, qs, setActiveNav, escapeHtml, renderSkeletonCards, renderStateCard } from '/assets/portal-shared.js';

export async function initAssignments() {
  setActiveNav('assignments');
  const list = qs('#assignmentList');
  const form = qs('#assignmentForm');
  const formError = qs('#assignmentFormError') || qs('#formError');
  if (!list || !form || !formError) {return;}

  let assignmentsCache = [];

  const toolbar = document.createElement('div');
  toolbar.className = 'ds-toolbar';
  toolbar.innerHTML = '<input id="assignmentSearch" type="search" placeholder="Search assignment by student, tutor, or subject" aria-label="Search assignments">';
  list.parentElement?.insertBefore(toolbar, list);

  const capsSubjects = [
    'Mathematics',
    'Mathematical Literacy',
    'Physical Sciences',
    'Life Sciences',
    'Accounting',
    'English Home Language',
    'Afrikaans Home Language',
  ];

  const subjectList = qs('#capsSubjects') || qs('#subjectList');
  if (subjectList) {
    subjectList.innerHTML = capsSubjects
      .map((subject) => `<option value="${escapeHtml(subject)}"></option>`)
      .join('');
  }

  const [tutors, students] = await Promise.all([
    apiGet('/admin/tutors'),
    apiGet('/admin/students'),
  ]);

  qs('#assignmentTutor').innerHTML = tutors.tutors
    .map((t) => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`)
    .join('');
  qs('#assignmentStudent').innerHTML = students.students
    .map((s) => `<option value="${s.id}">${escapeHtml(s.full_name)}</option>`)
    .join('');

  const subjectField = qs('#assignmentSubject')?.closest('.field');
  if (subjectField && !qs('#learningAssignmentTitle')) {
    subjectField.insertAdjacentHTML('afterend', `
      <div class="field form-col-full">
        <label for="learningAssignmentTitle">Assignment title</label>
        <input id="learningAssignmentTitle" placeholder="e.g. Algebra revision task" autocomplete="off">
      </div>
      <div class="field form-col-full">
        <label for="learningAssignmentDescription">Instructions</label>
        <textarea id="learningAssignmentDescription" rows="4" placeholder="What should the learner complete?"></textarea>
      </div>
      <div class="field">
        <label for="learningAssignmentStatus">Visibility</label>
        <select id="learningAssignmentStatus">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>
    `);
  }

  const renderList = (items) => {
    if (!items.length) {
      renderStateCard(list, {
        variant: 'empty',
        title: 'No assignments match',
        description: 'Try a different search term or create a new assignment.',
      });
      return;
    }
    list.innerHTML = items
      .map((a) => `<div class="panel">
          <div><strong>${escapeHtml(a.title || a.subject)}</strong> - ${escapeHtml(a.student_name)}</div>
          <div class="note">Tutor: ${escapeHtml(a.tutor_name)} | ${escapeHtml(a.subject)} | due ${escapeHtml(a.due_date || 'not set')} | ${escapeHtml(a.status || 'draft')} | submissions ${Number(a.submission_count || 0)}</div>
          <div class="btn-row">
            <button class="btn btn-secondary" type="button" data-publish="${escapeHtml(a.id)}">${a.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          </div>
        </div>`)
      .join('');
    list.querySelectorAll('[data-publish]').forEach((button) => {
      button.addEventListener('click', async () => {
        const item = assignmentsCache.find((a) => a.id === button.dataset.publish);
        if (!item) {return;}
        await apiPatch(`/admin/learning-assignments/${encodeURIComponent(item.id)}`, {
          status: item.status === 'published' ? 'draft' : 'published',
        });
        await load();
      });
    });
  };

  const applyFilter = () => {
    const query = (qs('#assignmentSearch')?.value || '').trim().toLowerCase();
    const filtered = assignmentsCache.filter((a) => {
      if (!query) {return true;}
      return [a.subject, a.student_name, a.tutor_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
    renderList(filtered);
  };

  const load = async () => {
    renderSkeletonCards(list, 3);
    try {
      const data = await apiGet('/admin/learning-assignments?sort=dueDate');
      assignmentsCache = Array.isArray(data.assignments) ? data.assignments : [];
      applyFilter();
    } catch {
      renderStateCard(list, {
        variant: 'error',
        title: 'Unable to load assignments',
        description: 'Refresh and try again.',
      });
    }
  };

  await load();
  qs('#assignmentSearch')?.addEventListener('input', applyFilter);
  qs('#clearBtn')?.addEventListener('click', () => {
    form.reset();
    if (formError) {
      formError.textContent = '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';
    const payload = {
      tutorId: qs('#assignmentTutor').value,
      studentId: qs('#assignmentStudent').value,
      subject: qs('#assignmentSubject').value,
      title: qs('#learningAssignmentTitle')?.value || qs('#assignmentSubject').value,
      description: qs('#learningAssignmentDescription')?.value || null,
      dueDate: qs('#assignmentEnd').value || qs('#assignmentStart').value || null,
      status: qs('#learningAssignmentStatus')?.value || 'draft',
    };
    if (!payload.subject?.trim()) {
      formError.textContent = 'Subject is required.';
      qs('#assignmentSubject')?.setAttribute('aria-invalid', 'true');
      return;
    }
    qs('#assignmentSubject')?.setAttribute('aria-invalid', 'false');
    if (!payload.title?.trim()) {
      formError.textContent = 'Assignment title is required.';
      qs('#learningAssignmentTitle')?.setAttribute('aria-invalid', 'true');
      return;
    }
    qs('#learningAssignmentTitle')?.setAttribute('aria-invalid', 'false');
    try {
      await apiPost('/admin/learning-assignments', payload);
      form.reset();
      formError.textContent = 'Assignment created successfully.';
      await load();
    } catch (err) {
      const message = err?.message || 'Unable to create assignment.';
      formError.textContent = message.replace(/_/g, ' ');
    }
  });
}
