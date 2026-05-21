import { apiFetch, loadJson } from '/assets/common.js';

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

export async function fetchStudentAssignments() {
  return optionalJson('/student/assignments', ['assignments', 'items']);
}

export async function fetchStudentResults() {
  return optionalJson('/student/results', ['results', 'items']);
}

export async function fetchClassStats() {
  return optionalJson('/student/class-stats', ['stats', 'items']);
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
  const maxMb = Number(assignment.maxFileSizeMB || assignment.max_file_size_mb || 10);
  if (file.size > maxMb * 1024 * 1024) {
    return `This file is larger than ${maxMb} MB.`;
  }
  const allowed = assignment.allowedFileTypes || assignment.allowed_file_types || ['pdf', 'png', 'jpg', 'jpeg'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (Array.isArray(allowed) && allowed.length && !allowed.map((item) => String(item).replace('.', '').toLowerCase()).includes(ext)) {
    return `Upload ${allowed.map((item) => String(item).replace('.', '').toUpperCase()).join(', ')} files only.`;
  }
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
  if (file.type && !allowedMime.includes(file.type)) {
    return 'Upload PDF, JPG, or PNG files only.';
  }
  return '';
}

export async function uploadAssignmentSubmission(assignmentId, file, onProgress) {
  const form = new FormData();
  form.set('file', file);
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
