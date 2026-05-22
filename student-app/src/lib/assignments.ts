import { apiFetch } from './api';
import type { AssignmentItem } from '../types';

export function validateSubmissionFile(file: File | undefined, assignment: Partial<AssignmentItem> = {}) {
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

export async function uploadAssignmentSubmission(assignmentId: string, file: File) {
  const form = new FormData();
  form.set('file', file);
  const response = await apiFetch(`/student/assignments/${encodeURIComponent(assignmentId)}/submissions`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(`upload_failed:${response.status}`);
  }
  return response.json().catch(() => ({}));
}
