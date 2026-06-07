import { requireSupabase } from '../../lib/supabase/client';
import type { Assignment, AssignmentStatus, AssignmentSubmission, Profile, Student, Subject } from '../../types/lms';

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  subjectName: string;
  grade: string;
  curriculum?: string;
  dueDate?: string;
  attachment?: File | null;
  rubricJson?: string;
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  textAnswer?: string;
  file?: File | null;
}

export interface UpdateAssignmentInput {
  assignmentId: string;
  title: string;
  description?: string;
  subjectName?: string;
  grade?: string;
  curriculum?: string;
  dueDate?: string;
  status: AssignmentStatus;
  attachment?: File | null;
  rubricJson?: string;
}

export interface MarkSubmissionInput {
  submissionId: string;
  marksAwarded?: string;
  feedback?: string;
  status: 'submitted' | 'marked' | 'returned';
  rubricScoresJson?: string;
  marksReleased?: boolean;
  feedbackReleased?: boolean;
}

type SubmitAssignmentRpcResult = {
  submission_id: string;
};

function mutationError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error(fallback);
}

async function getCurrentProfile() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw authError;
  }
  const authUserId = auth.user?.id;
  if (!authUserId) {
    throw new Error('Sign in before using this workflow.');
  }

  const result = await client.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  if (result.error) {
    throw result.error;
  }
  const profile = result.data as Profile | null;
  if (!profile) {
    throw new Error('No profile is linked to the current account.');
  }

  return profile;
}

async function getCurrentStudent(profileId: string) {
  const client = requireSupabase();
  const result = await client.from('students').select('*').eq('profile_id', profileId).single();
  if (result.error) {
    throw result.error;
  }
  const student = result.data as Student | null;
  if (!student) {
    throw new Error('No student record is linked to the current profile.');
  }

  return student;
}

async function findOrCreateSubject(input: { subjectName: string; grade: string; curriculum?: string }) {
  const client = requireSupabase();
  const subjectName = input.subjectName.trim();
  const grade = input.grade.trim();
  const curriculum = input.curriculum?.trim() || 'CAPS';

  const existing = await client
    .from('subjects')
    .select('*')
    .eq('name', subjectName)
    .eq('grade', grade)
    .eq('curriculum', curriculum)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }
  if (existing.data) {
    return existing.data as Subject;
  }

  const created = await (client.from('subjects') as unknown as {
    insert: (payload: { name: string; grade: string; curriculum: string }) => {
      select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> };
    };
  })
    .insert({ name: subjectName, grade, curriculum })
    .select('*')
    .single();

  if (created.error) {
    throw created.error;
  }

  return created.data as Subject;
}

function safeFileName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
}

function stableUploadId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseJsonField(value: string | undefined, fallback: unknown, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

export async function createAssignment(input: CreateAssignmentInput) {
  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'admin' && profile.role !== 'tutor') {
    throw new Error('Only admins or tutors can create assignments.');
  }

  const title = input.title.trim();
  const grade = input.grade.trim();
  if (!title) {
    throw new Error('Assignment title is required.');
  }
  if (!input.subjectName.trim()) {
    throw new Error('Subject is required.');
  }
  if (!grade) {
    throw new Error('Grade is required.');
  }

  const subject = await findOrCreateSubject(input);
  const inserted = await (client.from('assignments') as unknown as {
    insert: (payload: {
      title: string;
      description: string | null;
      subject_id: string;
      grade: string;
      due_date: string | null;
      created_by: string;
      status: string;
      attachment_url: string | null;
      rubric_json: unknown;
    }) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  })
    .insert({
      title,
      description: input.description?.trim() || null,
      subject_id: subject.id,
      grade,
      due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      created_by: profile.id,
      status: 'published',
      attachment_url: null,
      rubric_json: parseJsonField(input.rubricJson, [], 'Rubric'),
    })
    .select('*')
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  let assignment = inserted.data as Assignment;
  if (input.attachment) {
    const path = `${assignment.id}/${Date.now()}-${safeFileName(input.attachment)}`;
    const uploaded = await client.storage.from('assignment-files').upload(path, input.attachment, {
      upsert: true,
      contentType: input.attachment.type || undefined,
    });
    if (uploaded.error) {
      throw uploaded.error;
    }

    const updated = await (client.from('assignments') as unknown as {
      update: (payload: { attachment_url: string }) => {
        eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
      };
    })
      .update({ attachment_url: uploaded.data.path })
      .eq('id', assignment.id)
      .select('*')
      .single();

    if (updated.error) {
      throw updated.error;
    }
    assignment = updated.data as Assignment;
  }

  return assignment;
}

export async function updateAssignment(input: UpdateAssignmentInput) {
  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'admin' && profile.role !== 'tutor') {
    throw new Error('Only admins or tutors can update assignments.');
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error('Assignment title is required.');
  }

  const existing = await client.from('assignments').select('*').eq('id', input.assignmentId).single();
  if (existing.error) {
    throw existing.error;
  }
  const current = existing.data as Assignment | null;
  if (!current) {
    throw new Error('Assignment could not be found.');
  }

  if (profile.role === 'tutor' && current.created_by !== profile.id) {
    throw new Error('Tutors can only update assignments they created.');
  }

  let subjectId = current.subject_id || null;
  const subjectName = input.subjectName?.trim();
  const grade = input.grade?.trim() || current.grade || '';
  if (subjectName) {
    const subject = await findOrCreateSubject({ subjectName, grade, curriculum: input.curriculum });
    subjectId = subject.id;
  }

  const payload = {
    title,
    description: input.description?.trim() || null,
    subject_id: subjectId,
    grade: grade || null,
    due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    status: input.status,
    attachment_url: current.attachment_url || null,
    rubric_json: parseJsonField(input.rubricJson, current.rubric_json || [], 'Rubric'),
  };

  let assignment = current;
  if (input.attachment) {
    const path = `${input.assignmentId}/${Date.now()}-${safeFileName(input.attachment)}`;
    const uploaded = await client.storage.from('assignment-files').upload(path, input.attachment, {
      upsert: true,
      contentType: input.attachment.type || undefined,
    });
    if (uploaded.error) {
      throw uploaded.error;
    }
    payload.attachment_url = uploaded.data.path;
  }

  const updated = await (client.from('assignments') as unknown as {
    update: (row: typeof payload) => {
      eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
    };
  })
    .update(payload)
    .eq('id', input.assignmentId)
    .select('*')
    .single();

  if (updated.error) {
    throw updated.error;
  }
  assignment = updated.data as Assignment;

  return assignment;
}

export async function submitAssignment(input: SubmitAssignmentInput) {
  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'student') {
    throw new Error('Only students can submit assignments.');
  }

  const textAnswer = input.textAnswer?.trim() || null;
  if (!input.file && !textAnswer) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  const student = await getCurrentStudent(profile.id);
  const assignmentResult = await client.from('assignments').select('*').eq('id', input.assignmentId).single();
  if (assignmentResult.error) {
    throw assignmentResult.error;
  }
  const assignment = assignmentResult.data as Assignment | null;
  if (!assignment) {
    throw new Error('Assignment could not be found.');
  }
  if (assignment.status === 'closed' || assignment.status === 'archived') {
    throw new Error('This assignment is closed and no longer accepts submissions.');
  }

  const submissionId = stableUploadId();
  let fileUrl: string | null = null;
  let storageKey: string | null = null;
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;

  if (input.file) {
    const ext = input.file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${student.id}/${input.assignmentId}/${submissionId}/submission.${ext}`;
    const uploaded = await client.storage.from('assignment-submissions').upload(path, input.file, {
      upsert: true,
      contentType: input.file.type || undefined,
    });
    if (uploaded.error) {
      throw uploaded.error;
    }
    fileUrl = uploaded.data.path;
    storageKey = uploaded.data.path;
    originalFilename = safeFileName(input.file);
    mimeType = input.file.type || null;
    sizeBytes = input.file.size;
  }

  if (!textAnswer && !fileUrl) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  const submitted = await (client as unknown as {
    rpc: (
      name: 'submit_assignment_submission',
      args: {
        p_assignment_id: string;
        p_submission_id: string;
        p_storage_key: string | null;
        p_file_url: string | null;
        p_original_filename: string | null;
        p_mime_type: string | null;
        p_size_bytes: number | null;
        p_text_answer: string | null;
      }
    ) => Promise<{ data: SubmitAssignmentRpcResult[] | SubmitAssignmentRpcResult | null; error: Error | null }>;
  }).rpc('submit_assignment_submission', {
    p_assignment_id: input.assignmentId,
    p_submission_id: submissionId,
    p_storage_key: storageKey,
    p_file_url: fileUrl,
    p_original_filename: originalFilename,
    p_mime_type: mimeType,
    p_size_bytes: sizeBytes,
    p_text_answer: textAnswer,
  });

  if (submitted.error) {
    throw mutationError(submitted.error, 'Could not submit assignment.');
  }

  const row = Array.isArray(submitted.data) ? submitted.data[0] : submitted.data;
  if (!row?.submission_id) {
    throw new Error('Submission was saved, but the new record could not be loaded.');
  }

  const saved = await client.from('assignment_submissions').select('*').eq('id', row.submission_id).single();
  if (saved.error) {
    throw saved.error;
  }

  return saved.data as AssignmentSubmission;
}

export async function markSubmission(input: MarkSubmissionInput) {
  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'admin' && profile.role !== 'tutor') {
    throw new Error('Only admins or tutors can mark submissions.');
  }

  const marks = input.marksAwarded?.trim() ? Number(input.marksAwarded) : null;
  if (marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > 100)) {
    throw new Error('Marks must be a number between 0 and 100.');
  }

  const saved = await (client as unknown as {
    rpc: (
      name: 'mark_assignment_submission',
      args: {
        p_submission_id: string;
        p_marks_awarded: number | null;
        p_feedback: string | null;
        p_status: 'submitted' | 'marked' | 'returned';
        p_rubric_scores: unknown;
        p_marks_released: boolean;
        p_feedback_released: boolean;
      }
    ) => Promise<{ data: AssignmentSubmission[] | AssignmentSubmission | null; error: Error | null }>;
  }).rpc('mark_assignment_submission', {
    p_submission_id: input.submissionId,
    p_marks_awarded: marks,
    p_feedback: input.feedback?.trim() || null,
    p_status: input.status,
    p_rubric_scores: parseJsonField(input.rubricScoresJson, {}, 'Rubric scores'),
    p_marks_released: Boolean(input.marksReleased),
    p_feedback_released: Boolean(input.feedbackReleased),
  });

  if (saved.error) {
    throw mutationError(saved.error, 'Could not mark submission.');
  }

  const submission = Array.isArray(saved.data) ? saved.data[0] : saved.data;
  if (!submission) {
    throw new Error('Submission was updated, but the marked record could not be loaded.');
  }

  return submission;
}
