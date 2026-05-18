import { apiGet, apiPost, qs, setActiveNav, escapeHtml, renderSkeletonCards, renderStateCard } from '/assets/portal-shared.js';

export async function initStudents() {
  setActiveNav('students');
  const list = qs('#studentList');
  const form = qs('#studentForm');
  if (!list || !form) {return;}

  let studentsCache = [];

  let searchInput = qs('#filterSearch');
  const gradeFilter = qs('#filterGrade');
  let statusFilter = qs('#filterStatus');
  const countBadge = qs('#studentCount');

  if (!searchInput || !statusFilter) {
    const toolbar = document.createElement('div');
    toolbar.className = 'ds-toolbar';
    toolbar.innerHTML = `
      <input id="studentSearch" type="search" placeholder="Search by student, email, or guardian" aria-label="Search students">
      <select id="studentStatusFilter" aria-label="Filter students by status">
        <option value="all">All students</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    `;
    list.parentElement?.insertBefore(toolbar, list);
    searchInput = qs('#studentSearch');
    statusFilter = qs('#studentStatusFilter');
  }

  const feedback = document.createElement('p');
  feedback.id = 'studentFormFeedback';
  feedback.className = 'form-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  form.appendChild(feedback);

  if (!qs('#studentSchool')) {
    const notesField = qs('#studentNotes')?.closest('.field') || qs('#studentNotes')?.parentElement;
    const extra = document.createElement('div');
    extra.innerHTML = `
      <div class="field">
        <label for="studentSchool">School <span class="opt-tag">(optional)</span></label>
        <input id="studentSchool" type="text" name="school" placeholder="School or learning centre">
      </div>
      <div class="field">
        <label for="studentSubjects">Subjects <span class="opt-tag">(comma separated)</span></label>
        <input id="studentSubjects" type="text" name="subjects" placeholder="Mathematics, Physical Sciences">
      </div>
      <div class="field">
        <label for="guardianRelationship">Guardian relationship <span class="opt-tag">(optional)</span></label>
        <input id="guardianRelationship" type="text" name="guardianRelationship" placeholder="Parent, aunt, caregiver">
      </div>
      <div class="field">
        <label for="guardianEmail">Guardian email <span class="opt-tag">(optional)</span></label>
        <input id="guardianEmail" type="email" name="guardianEmail" placeholder="guardian@example.com">
      </div>
      <div class="field">
        <label for="partnerAffiliation">Partner / school / NGO <span class="opt-tag">(optional)</span></label>
        <input id="partnerAffiliation" type="text" name="partnerAffiliation" placeholder="ProVision, school, or NGO">
      </div>
    `;
    while (extra.firstElementChild) {
      form.insertBefore(extra.firstElementChild, notesField || feedback);
    }
  }

  const initials = (name) => String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');

  const renderList = (records) => {
    if (countBadge) {
      const total = studentsCache.length;
      countBadge.textContent = total === 1 ? '1 student' : `${total} students`;
    }
    if (!records.length) {
      renderStateCard(list, {
        variant: 'empty',
        title: 'No students found',
        description: 'Try a broader search or add a new student.',
      });
      return;
    }
    list.innerHTML = records
      .map((s) => `<div class="student-row">
          <div class="student-avatar" aria-hidden="true">${escapeHtml(initials(s.full_name))}</div>
          <div class="student-info">
            <div class="student-name">${escapeHtml(s.full_name)}</div>
            <div class="student-meta">${escapeHtml([s.grade || 'No grade', s.school || 'No school', s.email, s.guardian_name || 'No guardian'].filter(Boolean).join(' | '))}</div>
            <div class="student-meta">${escapeHtml([Array.isArray(s.subjects_json) ? s.subjects_json.join(', ') : '', s.partner_affiliation].filter(Boolean).join(' | '))}</div>
          </div>
          <span class="status-badge ${s.active ? 'status-active' : 'status-inactive'}">${s.active ? 'Active' : 'Inactive'}</span>
        </div>`)
      .join('');
  };

  const applyFilters = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const grade = gradeFilter?.value || '';
    const rawStatus = statusFilter?.value || 'all';
    const status = rawStatus || 'all';
    const filtered = studentsCache.filter((student) => {
      const matchesSearch = !query
        || student.full_name?.toLowerCase().includes(query)
        || student.email?.toLowerCase().includes(query)
        || student.guardian_name?.toLowerCase().includes(query);
      const matchesGrade = !grade || student.grade === grade;
      const matchesStatus = status === 'all' || (status === 'active' ? student.active : !student.active);
      return matchesSearch && matchesGrade && matchesStatus;
    });
    renderList(filtered);
  };

  const load = async () => {
    renderSkeletonCards(list, 4);
    try {
      const data = await apiGet('/admin/students');
      studentsCache = Array.isArray(data.students) ? data.students : [];
      applyFilters();
    } catch {
      renderStateCard(list, {
        variant: 'error',
        title: 'Unable to load students',
        description: 'Refresh and try again. If the issue persists, check API connectivity.',
      });
    }
  };

  await load();

  searchInput?.addEventListener('input', applyFilters);
  gradeFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = '';
    feedback.className = 'form-feedback';

    const studentName = qs('#studentName');
    const guardianPhone = qs('#guardianPhone');
    const phoneDigits = (guardianPhone.value || '').replace(/\D+/g, '');
    if (!studentName.value.trim()) {
      studentName.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Student name is required.';
      feedback.classList.add('error');
      return;
    }
    studentName.setAttribute('aria-invalid', 'false');
    if (phoneDigits && phoneDigits.length < 10) {
      guardianPhone.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Guardian phone must be at least 10 digits.';
      feedback.classList.add('error');
      return;
    }
    guardianPhone.setAttribute('aria-invalid', 'false');
    const studentEmail = qs('#studentEmail');
    const studentPassword = qs('#studentPassword');
    if (studentPassword?.value && !studentEmail?.value.trim()) {
      studentEmail.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Student login email is required when setting a password.';
      feedback.classList.add('error');
      return;
    }
    studentEmail?.setAttribute('aria-invalid', 'false');
    if (studentPassword?.value && studentPassword.value.length < 8) {
      studentPassword.setAttribute('aria-invalid', 'true');
      feedback.textContent = 'Temporary password must be at least 8 characters.';
      feedback.classList.add('error');
      return;
    }
    studentPassword?.setAttribute('aria-invalid', 'false');

    const payload = {
      fullName: qs('#studentName').value,
      email: qs('#studentEmail')?.value || undefined,
      password: qs('#studentPassword')?.value || undefined,
      grade: qs('#studentGrade').value || undefined,
      school: qs('#studentSchool')?.value || undefined,
      subjects: (qs('#studentSubjects')?.value || '').split(',').map((item) => item.trim()).filter(Boolean),
      guardianName: qs('#guardianName').value || undefined,
      guardianRelationship: qs('#guardianRelationship')?.value || undefined,
      guardianPhone: qs('#guardianPhone').value || undefined,
      guardianEmail: qs('#guardianEmail')?.value || undefined,
      partnerAffiliation: qs('#partnerAffiliation')?.value || undefined,
      notes: qs('#studentNotes').value || undefined,
      active: qs('#studentActive').checked,
    };
    try {
      await apiPost('/admin/students', payload);
      feedback.textContent = 'Student created successfully.';
      feedback.classList.add('success');
      form.reset();
      await load();
    } catch (err) {
      feedback.textContent = err?.message?.includes('student_account_exists')
        ? 'A student account already exists for that email.'
        : err?.message || 'Unable to create student.';
      feedback.classList.add('error');
    }
  });
}
