import { apiFetch, apiUrl, loadJson } from '/assets/common.js';

function normalizeArrayPayload(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {return payload[key];}
  }
  if (Array.isArray(payload)) {return payload;}
  return [];
}

async function optionalJson(path, keys) {
  try {
    const payload = await loadJson(path);
    return { available: true, items: normalizeArrayPayload(payload, keys), payload };
  } catch (err) {
    if (err?.status === 404 || err?.status === 501) {
      return { available: false, items: [], error: err };
    }
    throw err;
  }
}

async function optionalItem(path, keys = []) {
  try {
    const payload = await loadJson(path);
    for (const key of keys) {
      if (payload && payload[key]) {
        return { available: true, item: payload[key], payload };
      }
    }
    return { available: true, item: payload, payload };
  } catch (err) {
    if (err?.status === 404 || err?.status === 501) {
      return { available: false, item: null, error: err };
    }
    throw err;
  }
}

export async function fetchStudentAssignments() {
  return optionalJson('/student/assignments', ['assignments', 'items']);
}

export async function fetchStudentAssignmentDetail(assignmentId) {
  if (!assignmentId) {
    return { available: false, item: null };
  }
  return optionalItem(`/student/assignments/${encodeURIComponent(assignmentId)}`, ['assignment', 'item']);
}

export async function fetchStudentAssignmentSubmissions(assignmentId) {
  if (!assignmentId) {
    return { available: false, items: [] };
  }
  return optionalJson(`/student/assignments/${encodeURIComponent(assignmentId)}/submissions`, ['submissions', 'items']);
}

export async function fetchStudentResults() {
  return optionalJson('/student/results', ['results', 'items']);
}

export async function fetchStudentResultDetail(resultId) {
  if (!resultId) {
    return { available: false, item: null };
  }
  return optionalItem(`/student/results/${encodeURIComponent(resultId)}`, ['result', 'item']);
}

export async function fetchClassStats(assignmentId) {
  const suffix = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : '';
  return optionalJson(`/student/class-stats${suffix}`, ['stats', 'items']);
}

export async function fetchReportDetail(reportId) {
  if (!reportId) {
    return { available: false, item: null };
  }
  return optionalItem(`/reports/${encodeURIComponent(reportId)}`, ['report']);
}

export function sortAssignmentsByUrgency(assignments) {
  const statusWeight = {
    overdue: 0,
    due_soon: 1,
    upcoming: 2,
    submitted: 3,
    marked: 4,
  };
  return [...assignments].sort((a, b) => {
    const aw = statusWeight[String(a.status || '').toLowerCase()] ?? 2;
    const bw = statusWeight[String(b.status || '').toLowerCase()] ?? 2;
    if (aw !== bw) {return aw - bw;}
    return new Date(a.dueDate || a.due_date || 8640000000000000) - new Date(b.dueDate || b.due_date || 8640000000000000);
  });
}

export function validateSubmissionFile(file, assignment = {}) {
  if (!file) {return 'Choose a file before uploading.';}
  const maxMb = Number(assignment.maxFileSizeMB || assignment.max_file_size_mb || 20);
  if (file.size > maxMb * 1024 * 1024) {
    return `This file is larger than ${maxMb} MB.`;
  }
  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (Array.isArray(allowed) && allowed.length && !allowed.map((item) => String(item).replace('.', '').toLowerCase()).includes(ext)) {
    return `Upload ${allowed.map((item) => String(item).replace('.', '').toUpperCase()).join(', ')} files only.`;
  }
  return '';
}

export async function uploadAssignmentSubmission(assignmentId, file, onProgress) {
  const form = new FormData();
  form.set('file', file);

  if (typeof onProgress === 'function' && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl(`/student/assignments/${encodeURIComponent(assignmentId)}/submissions`));
      xhr.withCredentials = true;
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) {return;}
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      });
      xhr.addEventListener('load', () => {
        onProgress(100);
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`upload_failed:${xhr.status}`));
          return;
        }
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } catch {
          resolve({});
        }
      });
      xhr.addEventListener('error', () => reject(new Error('upload_failed')));
      xhr.send(form);
    });
  }

  const res = await apiFetch(`/student/assignments/${encodeURIComponent(assignmentId)}/submissions`, {
    method: 'POST',
    body: form,
  });
  onProgress?.(100);
  if (!res.ok) {
    throw new Error(`upload_failed:${res.status}`);
  }
  return res.json().catch(() => ({}));
}
