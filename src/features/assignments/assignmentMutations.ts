import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { markE2ESubmission, submitE2EAssignment } from '../../lib/e2e/mockRoleData';
import { recordAuditEvent } from '../../lib/audit/auditLog';
import { captureAppError } from '../../lib/monitoring/errorReporting';
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
  // Model answer for AI-assisted marking -- private assignment-memos bucket,
  // never student-readable (unlike attachment, assignment-files).
  memo?: File | null;
  rubricJson?: string;
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  submissionId: string;
  textAnswer?: string;
  file?: File | null;
}

export interface SubmitAssignmentResult {
  submissionId: string;
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
  memo?: File | null;
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

type SubmissionAttemptRpcArgs = {
  p_assignment_id: string;
  p_submission_id: string;
  p_storage_key: string | null;
  p_file_url: string | null;
  p_original_filename: string | null;
  p_mime_type: string | null;
  p_size_bytes: number | null;
  p_text_answer: string | null;
};

function mutationError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error(fallback);
}

function captureAssignmentError(action: string, error: unknown, metadata: Record<string, unknown> = {}) {
  captureAppError(error, {
    featureArea: 'assignments',
    action,
    metadata,
  });
}

// Fire-and-forget: AI grading is a background bonus, never a requirement for
// a successful submit. grade-submission claims the row idempotently, so it's
// safe to call this from every path that confirms the submission exists.
async function triggerAiGrading(client: ReturnType<typeof requireSupabase>, submissionId: string) {
  try {
    await client.functions.invoke('grade-submission', { body: { submissionId } });
  } catch (err) {
    captureAssignmentError('assignment_submission.ai_grading_trigger_failed', err, { submission_id: submissionId });
  }
}

async function confirmSubmissionAttempt(
  client: ReturnType<typeof requireSupabase>,
  args: SubmissionAttemptRpcArgs,
): Promise<boolean> {
  const confirmed = await (client as unknown as {
    rpc: (
      name: 'confirm_assignment_submission_attempt',
      rpcArgs: SubmissionAttemptRpcArgs,
    ) => Promise<{ data: SubmitAssignmentRpcResult[] | SubmitAssignmentRpcResult | null; error: Error | null }>;
  }).rpc('confirm_assignment_submission_attempt', args);

  if (confirmed.error) {
    throw mutationError(confirmed.error, 'Could not confirm the previous submission attempt.');
  }

  const row = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
  if (!row) {
    return false;
  }
  if (!row.submission_id || row.submission_id.toLowerCase() !== args.p_submission_id) {
    throw new Error('Submission confirmation did not match this attempt.');
  }
  return true;
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
    captureAssignmentError('assignment.subject_create_failed', created.error);
    throw created.error;
  }

  return created.data as Subject;
}

function safeFileName(file: File) {
  return file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
}

export function createSubmissionAttemptId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
    const error = new Error('Only admins or tutors can create assignments.');
    captureAssignmentError('assignment.create_permission_denied', error, { role: profile.role });
    throw error;
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
      memo_url: string | null;
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
      memo_url: null,
      rubric_json: parseJsonField(input.rubricJson, [], 'Rubric'),
    })
    .select('*')
    .single();

  if (inserted.error) {
    captureAssignmentError('assignment.create_failed', inserted.error, {
      role: profile.role,
      has_attachment: Boolean(input.attachment),
    });
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
      captureAssignmentError('assignment.attachment_upload_failed', uploaded.error, {
        assignment_id: assignment.id,
        upload_size_bytes: input.attachment.size,
        mime_type: input.attachment.type || null,
      });
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
      captureAssignmentError('assignment.attachment_update_failed', updated.error, {
        assignment_id: assignment.id,
      });
      throw updated.error;
    }
    assignment = updated.data as Assignment;
  }

  if (input.memo) {
    const path = `${assignment.id}/${Date.now()}-${safeFileName(input.memo)}`;
    const uploaded = await client.storage.from('assignment-memos').upload(path, input.memo, {
      upsert: true,
      contentType: input.memo.type || undefined,
    });
    if (uploaded.error) {
      captureAssignmentError('assignment.memo_upload_failed', uploaded.error, {
        assignment_id: assignment.id,
        upload_size_bytes: input.memo.size,
        mime_type: input.memo.type || null,
      });
      throw uploaded.error;
    }

    const updated = await (client.from('assignments') as unknown as {
      update: (payload: { memo_url: string }) => {
        eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
      };
    })
      .update({ memo_url: uploaded.data.path })
      .eq('id', assignment.id)
      .select('*')
      .single();

    if (updated.error) {
      captureAssignmentError('assignment.memo_update_failed', updated.error, {
        assignment_id: assignment.id,
      });
      throw updated.error;
    }
    assignment = updated.data as Assignment;
  }

  await recordAuditEvent({
    action: 'assignment.created',
    entityType: 'assignment',
    entityId: assignment.id,
    metadata: {
      grade: assignment.grade,
      status: assignment.status,
      subject_id: assignment.subject_id,
      attachment_uploaded: Boolean(input.attachment),
      memo_uploaded: Boolean(input.memo),
    },
  });

  return assignment;
}

export async function updateAssignment(input: UpdateAssignmentInput) {
  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'admin' && profile.role !== 'tutor') {
    const error = new Error('Only admins or tutors can update assignments.');
    captureAssignmentError('assignment.update_permission_denied', error, { role: profile.role });
    throw error;
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error('Assignment title is required.');
  }

  const existing = await client.from('assignments').select('*').eq('id', input.assignmentId).single();
  if (existing.error) {
    captureAssignmentError('assignment.load_for_update_failed', existing.error, {
      assignment_id: input.assignmentId,
    });
    throw existing.error;
  }
  const current = existing.data as Assignment | null;
  if (!current) {
    throw new Error('Assignment could not be found.');
  }

  if (profile.role === 'tutor' && current.created_by !== profile.id) {
    const error = new Error('Tutors can only update assignments they created.');
    captureAssignmentError('assignment.update_permission_denied', error, {
      role: profile.role,
      assignment_id: input.assignmentId,
    });
    throw error;
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
    memo_url: current.memo_url || null,
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
      captureAssignmentError('assignment.attachment_replace_failed', uploaded.error, {
        assignment_id: input.assignmentId,
        upload_size_bytes: input.attachment.size,
        mime_type: input.attachment.type || null,
      });
      throw uploaded.error;
    }
    payload.attachment_url = uploaded.data.path;
  }

  if (input.memo) {
    const path = `${input.assignmentId}/${Date.now()}-${safeFileName(input.memo)}`;
    const uploaded = await client.storage.from('assignment-memos').upload(path, input.memo, {
      upsert: true,
      contentType: input.memo.type || undefined,
    });
    if (uploaded.error) {
      captureAssignmentError('assignment.memo_replace_failed', uploaded.error, {
        assignment_id: input.assignmentId,
        upload_size_bytes: input.memo.size,
        mime_type: input.memo.type || null,
      });
      throw uploaded.error;
    }
    payload.memo_url = uploaded.data.path;
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
    captureAssignmentError('assignment.update_failed', updated.error, {
      assignment_id: input.assignmentId,
      status: input.status,
      has_attachment: Boolean(input.attachment),
    });
    throw updated.error;
  }
  assignment = updated.data as Assignment;

  await recordAuditEvent({
    action: 'assignment.updated',
    entityType: 'assignment',
    entityId: assignment.id,
    metadata: {
      previous_status: current.status,
      new_status: assignment.status,
      grade: assignment.grade,
      subject_id: assignment.subject_id,
      attachment_replaced: Boolean(input.attachment),
      memo_replaced: Boolean(input.memo),
    },
  });

  if (input.attachment) {
    await recordAuditEvent({
      action: 'assignment.attachment_replaced',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: {
        previous_attachment_url: current.attachment_url,
        new_attachment_url: assignment.attachment_url,
      },
    });
  }

  if (input.memo) {
    await recordAuditEvent({
      action: 'assignment.memo_replaced',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: {
        previous_memo_url: current.memo_url,
        new_memo_url: assignment.memo_url,
      },
    });
  }

  return assignment;
}

export async function submitAssignment(input: SubmitAssignmentInput): Promise<SubmitAssignmentResult> {
  const submissionId = input.submissionId.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submissionId)) {
    throw new Error('A valid submission attempt ID is required.');
  }

  if (isE2EAuthMockEnabled()) {
    return submitE2EAssignment({ ...input, submissionId });
  }

  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'student') {
    const error = new Error('Only students can submit assignments.');
    captureAssignmentError('assignment_submission.permission_denied', error, { role: profile.role });
    throw error;
  }

  const textAnswer = input.textAnswer?.trim() || null;
  if (!input.file && !textAnswer) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  const student = await getCurrentStudent(profile.id);

  let fileUrl: string | null = null;
  let storageKey: string | null = null;
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;

  if (input.file) {
    const ext = input.file.name.split('.').pop()?.toLowerCase() || 'bin';
    storageKey = `${student.id}/${input.assignmentId}/${submissionId}/submission.${ext}`;
    fileUrl = storageKey;
    originalFilename = safeFileName(input.file);
    mimeType = input.file.type || null;
    sizeBytes = input.file.size;
  }

  const rpcArgs: SubmissionAttemptRpcArgs = {
    p_assignment_id: input.assignmentId,
    p_submission_id: submissionId,
    p_storage_key: storageKey,
    p_file_url: fileUrl,
    p_original_filename: originalFilename,
    p_mime_type: mimeType,
    p_size_bytes: sizeBytes,
    p_text_answer: textAnswer,
  };

  // A previous submit may have committed even though its response was lost.
  // Confirm the stable attempt before any upsert so committed evidence is
  // never uploaded over. An absent attempt is the only state that proceeds.
  try {
    if (await confirmSubmissionAttempt(client, rpcArgs)) {
      await triggerAiGrading(client, submissionId);
      return { submissionId };
    }
  } catch (confirmationError) {
    captureAssignmentError('assignment_submission.confirm_failed', confirmationError, {
      assignment_id: input.assignmentId,
      has_file: Boolean(input.file),
      has_text_answer: Boolean(textAnswer),
    });
    throw confirmationError;
  }

  const assignmentResult = await client.from('assignments').select('*').eq('id', input.assignmentId).single();
  if (assignmentResult.error) {
    captureAssignmentError('assignment_submission.assignment_load_failed', assignmentResult.error, {
      assignment_id: input.assignmentId,
    });
    throw assignmentResult.error;
  }
  const assignment = assignmentResult.data as Assignment | null;
  if (!assignment) {
    throw new Error('Assignment could not be found.');
  }
  if (assignment.status === 'closed' || assignment.status === 'archived') {
    throw new Error('This assignment is closed and no longer accepts submissions.');
  }

  if (input.file) {
    const uploaded = await client.storage.from('assignment-submissions').upload(storageKey!, input.file, {
      upsert: true,
      contentType: input.file.type || undefined,
    });
    if (uploaded.error) {
      captureAssignmentError('assignment_submission.upload_failed', uploaded.error, {
        assignment_id: input.assignmentId,
        upload_size_bytes: input.file.size,
        mime_type: input.file.type || null,
      });
      throw uploaded.error;
    }
    if (uploaded.data.path !== storageKey) {
      throw new Error('Submission upload returned an unexpected storage path.');
    }
  }

  if (!textAnswer && !fileUrl) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  const submitted = await (client as unknown as {
    rpc: (
      name: 'submit_assignment_submission',
      args: SubmissionAttemptRpcArgs,
    ) => Promise<{ data: SubmitAssignmentRpcResult[] | SubmitAssignmentRpcResult | null; error: Error | null }>;
  }).rpc('submit_assignment_submission', rpcArgs);

  if (submitted.error) {
    captureAssignmentError('assignment_submission.rpc_failed', submitted.error, {
      assignment_id: input.assignmentId,
      has_file: Boolean(input.file),
      has_text_answer: Boolean(textAnswer),
    });

    // Recover immediately when only the submit response was lost. If this
    // confirmation also fails, the UI retains the same UUID for the next
    // click; no Storage object is removed or overwritten here.
    try {
      if (await confirmSubmissionAttempt(client, rpcArgs)) {
        await triggerAiGrading(client, submissionId);
        return { submissionId };
      }
    } catch (confirmationError) {
      captureAssignmentError('assignment_submission.confirm_after_rpc_failed', confirmationError, {
        assignment_id: input.assignmentId,
      });
    }
    throw mutationError(submitted.error, 'Could not submit assignment.');
  }

  const row = Array.isArray(submitted.data) ? submitted.data[0] : submitted.data;
  if (!row?.submission_id || row.submission_id.toLowerCase() !== submissionId) {
    throw new Error('Submission confirmation was incomplete. Retry safely with the same work.');
  }

  await triggerAiGrading(client, submissionId);
  return { submissionId };
}

export async function markSubmission(input: MarkSubmissionInput) {
  if (isE2EAuthMockEnabled()) {
    return markE2ESubmission(input);
  }

  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'admin' && profile.role !== 'tutor') {
    const error = new Error('Only admins or tutors can mark submissions.');
    captureAssignmentError('submission_marking.permission_denied', error, { role: profile.role });
    throw error;
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
    captureAssignmentError('submission_marking.rpc_failed', saved.error, {
      submission_id: input.submissionId,
      status: input.status,
      marks_released: Boolean(input.marksReleased),
      feedback_released: Boolean(input.feedbackReleased),
    });
    throw mutationError(saved.error, 'Could not mark submission.');
  }

  const submission = Array.isArray(saved.data) ? saved.data[0] : saved.data;
  if (!submission) {
    throw new Error('Submission was updated, but the marked record could not be loaded.');
  }

  return submission;
}
