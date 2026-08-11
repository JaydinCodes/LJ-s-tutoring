import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { markE2ESubmission, submitE2EAssignment } from '../../lib/e2e/mockRoleData';
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
  rubricJson?: string;
  organizationId?: string;
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  submissionId: string;
  textAnswer?: string;
  file?: File | null;
}

export interface SubmitAssignmentResult {
  submissionId: string;
  recovered?: boolean;
}

export type SubmissionRecoveryResult =
  | { status: 'none' }
  | { status: 'pending'; submissionId: string; originalFilename: string | null }
  | { status: 'confirmed'; submissionId: string };

export interface UpdateAssignmentInput {
  assignmentId: string;
  expectedRevision: number;
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
  expectedRevision: number;
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

type SubmissionAttemptLedgerEntry = {
  version: 1;
  assignmentId: string;
  studentId: string;
  submissionId: string;
  storageKey: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentSha256: string | null;
  textAnswerSha256: string | null;
  createdAt: string;
};

type AssignmentCreateAttemptLedgerEntry = {
  version: 1;
  profileId: string;
  requestId: string;
  payloadFingerprint: string;
  createdAt: string;
};

type ConfirmSubmissionAttemptDigestRpcArgs = {
  p_assignment_id: string;
  p_submission_id: string;
  p_content_sha256: string | null;
  p_text_answer_sha256: string | null;
};

type BeginSubmissionAttemptRpcArgs = {
  p_assignment_id: string;
  p_submission_id: string;
  p_storage_key: string | null;
  p_original_filename: string | null;
  p_mime_type: string | null;
  p_size_bytes: number | null;
  p_content_sha256: string | null;
  p_text_answer: string | null;
  p_text_answer_sha256: string | null;
};

const SUBMISSION_ATTEMPT_LEDGER_PREFIX = 'odysseus:submission-attempt:v1';
const ASSIGNMENT_CREATE_ATTEMPT_LEDGER_PREFIX = 'odysseus:assignment-create-attempt:v1';

function submissionAttemptLedgerKey(studentId: string, assignmentId: string) {
  return `${SUBMISSION_ATTEMPT_LEDGER_PREFIX}:${studentId}:${assignmentId}`;
}

function assignmentCreateAttemptLedgerKey(profileId: string) {
  return `${ASSIGNMENT_CREATE_ATTEMPT_LEDGER_PREFIX}:${profileId}`;
}

function browserStorage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function readSubmissionAttemptLedger(studentId: string, assignmentId: string): SubmissionAttemptLedgerEntry | null {
  const storage = browserStorage();
  if (!storage) return null;
  const key = submissionAttemptLedgerKey(studentId, assignmentId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<SubmissionAttemptLedgerEntry>;
    if (
      entry.version !== 1
      || entry.assignmentId !== assignmentId
      || entry.studentId !== studentId
      || typeof entry.submissionId !== 'string'
      || typeof entry.createdAt !== 'string'
    ) {
      storage.removeItem(key);
      return null;
    }
    return entry as SubmissionAttemptLedgerEntry;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writeSubmissionAttemptLedger(entry: SubmissionAttemptLedgerEntry) {
  const storage = browserStorage();
  if (!storage) {
    throw new Error('This browser cannot safely remember a submission retry. Enable site storage and try again.');
  }
  storage.setItem(submissionAttemptLedgerKey(entry.studentId, entry.assignmentId), JSON.stringify(entry));
}

function clearSubmissionAttemptLedger(entry: SubmissionAttemptLedgerEntry) {
  const storage = browserStorage();
  if (!storage) return;
  const key = submissionAttemptLedgerKey(entry.studentId, entry.assignmentId);
  const current = readSubmissionAttemptLedger(entry.studentId, entry.assignmentId);
  if (current?.submissionId === entry.submissionId) {
    storage.removeItem(key);
  }
}

function readAssignmentCreateAttemptLedger(profileId: string): AssignmentCreateAttemptLedgerEntry | null {
  const storage = browserStorage();
  if (!storage) return null;
  const key = assignmentCreateAttemptLedgerKey(profileId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<AssignmentCreateAttemptLedgerEntry>;
    if (
      entry.version !== 1
      || entry.profileId !== profileId
      || typeof entry.requestId !== 'string'
      || typeof entry.payloadFingerprint !== 'string'
      || typeof entry.createdAt !== 'string'
    ) {
      storage.removeItem(key);
      return null;
    }
    return entry as AssignmentCreateAttemptLedgerEntry;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writeAssignmentCreateAttemptLedger(entry: AssignmentCreateAttemptLedgerEntry) {
  const storage = browserStorage();
  if (!storage) {
    throw new Error('This browser cannot safely remember an assignment creation retry. Enable site storage and try again.');
  }
  storage.setItem(assignmentCreateAttemptLedgerKey(entry.profileId), JSON.stringify(entry));
}

function clearAssignmentCreateAttemptLedger(entry: AssignmentCreateAttemptLedgerEntry) {
  const storage = browserStorage();
  if (!storage) return;
  const key = assignmentCreateAttemptLedgerKey(entry.profileId);
  const current = readAssignmentCreateAttemptLedger(entry.profileId);
  if (current?.requestId === entry.requestId) {
    storage.removeItem(key);
  }
}

async function sha256Hex(value: Blob | string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot verify submission integrity. Update your browser and try again.');
  }
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(await value.arrayBuffer());
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getAssignmentCreateAttempt(
  profileId: string,
  payload: Record<string, unknown>,
): Promise<AssignmentCreateAttemptLedgerEntry> {
  const payloadFingerprint = await sha256Hex(canonicalJson(payload));
  const existing = readAssignmentCreateAttemptLedger(profileId);
  if (existing?.payloadFingerprint === payloadFingerprint) {
    return existing;
  }

  const entry: AssignmentCreateAttemptLedgerEntry = {
    version: 1,
    profileId,
    requestId: createSubmissionAttemptId(),
    payloadFingerprint,
    createdAt: new Date().toISOString(),
  };
  writeAssignmentCreateAttemptLedger(entry);
  return entry;
}

function sameSubmissionPayload(left: SubmissionAttemptLedgerEntry, right: SubmissionAttemptLedgerEntry) {
  return left.contentSha256 === right.contentSha256
    && left.textAnswerSha256 === right.textAnswerSha256
    && left.originalFilename === right.originalFilename
    && left.mimeType === right.mimeType
    && left.sizeBytes === right.sizeBytes;
}

function submissionAttemptRpcArgs(entry: SubmissionAttemptLedgerEntry, textAnswer: string | null): SubmissionAttemptRpcArgs {
  return {
    p_assignment_id: entry.assignmentId,
    p_submission_id: entry.submissionId,
    p_storage_key: entry.storageKey,
    p_file_url: entry.storageKey,
    p_original_filename: entry.originalFilename,
    p_mime_type: entry.mimeType,
    p_size_bytes: entry.sizeBytes,
    p_text_answer: textAnswer,
  };
}

function mutationError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : '';
  if (message.includes('submission_revision_conflict') || message.includes('submission_revision_required')) {
    return new Error('This submission changed while you were editing. Reload it before saving your review.');
  }
  if (message.includes('assignment_revision_conflict') || message.includes('assignment_revision_required')) {
    return new Error('This assignment changed while you were editing. Reload it before saving again.');
  }
  if (message.includes('assignment_create_retry_payload_mismatch')) {
    return new Error('This retry does not match the original assignment creation. Start a new assignment instead.');
  }
  if (message.includes('assignment_create_request_id_required')) {
    return new Error('Assignment creation needs the latest app version. Reload and try again.');
  }
  if (message) {
    return error instanceof Error ? error : new Error(message);
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

// Queue durable background work only, then kick the worker without waiting
// for the AI result. The submission transaction has already been confirmed,
// so grading can finish in the background without blocking the learner.
async function triggerAiGrading(client: ReturnType<typeof requireSupabase>, submissionId: string) {
  const queued = await (client as unknown as {
    rpc: (name: 'enqueue_ai_grading', args: { p_submission_id: string }) => Promise<{ error: Error | null }>;
  }).rpc('enqueue_ai_grading', { p_submission_id: submissionId });
  if (queued.error) {
    captureAssignmentError('assignment_submission.ai_grading_queue_failed', queued.error, { submission_id: submissionId });
    return;
  }

  void (client as unknown as {
    functions: {
      invoke: (
        name: 'grade-submission',
        options: { body: { submissionId: string } },
      ) => Promise<{ error: Error | null }>;
    };
  }).functions.invoke('grade-submission', { body: { submissionId } }).then(
    ({ error }) => {
      if (error) {
        captureAssignmentError('assignment_submission.ai_grading_invoke_failed', error, {
          submission_id: submissionId,
        });
      }
    },
    (error) => {
      captureAssignmentError('assignment_submission.ai_grading_invoke_failed', error, {
        submission_id: submissionId,
      });
    },
  );
}

async function confirmSubmissionAttempt(
  client: ReturnType<typeof requireSupabase>,
  entry: SubmissionAttemptLedgerEntry,
): Promise<boolean> {
  const args: ConfirmSubmissionAttemptDigestRpcArgs = {
    p_assignment_id: entry.assignmentId,
    p_submission_id: entry.submissionId,
    p_content_sha256: entry.contentSha256,
    p_text_answer_sha256: entry.textAnswerSha256,
  };
  const confirmed = await (client as unknown as {
    rpc: (
      name: 'confirm_assignment_submission_attempt_digest',
      rpcArgs: ConfirmSubmissionAttemptDigestRpcArgs,
    ) => Promise<{ data: SubmitAssignmentRpcResult[] | SubmitAssignmentRpcResult | null; error: Error | null }>;
  }).rpc('confirm_assignment_submission_attempt_digest', args);

  if (confirmed.error) {
    throw mutationError(confirmed.error, 'Could not confirm the previous submission attempt.');
  }

  const row = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
  if (!row) {
    return false;
  }
  if (!row.submission_id || row.submission_id.toLowerCase() !== entry.submissionId) {
    throw new Error('Submission confirmation did not match this attempt.');
  }
  return true;
}

async function beginSubmissionAttempt(
  client: ReturnType<typeof requireSupabase>,
  entry: SubmissionAttemptLedgerEntry,
  textAnswer: string | null,
) {
  const args: BeginSubmissionAttemptRpcArgs = {
    p_assignment_id: entry.assignmentId,
    p_submission_id: entry.submissionId,
    p_storage_key: entry.storageKey,
    p_original_filename: entry.originalFilename,
    p_mime_type: entry.mimeType,
    p_size_bytes: entry.sizeBytes,
    p_content_sha256: entry.contentSha256,
    p_text_answer: textAnswer,
    p_text_answer_sha256: entry.textAnswerSha256,
  };
  const begun = await (client as unknown as {
    rpc: (
      name: 'begin_assignment_submission_attempt',
      rpcArgs: BeginSubmissionAttemptRpcArgs,
    ) => Promise<{ data: SubmitAssignmentRpcResult[] | SubmitAssignmentRpcResult | null; error: Error | null }>;
  }).rpc('begin_assignment_submission_attempt', args);
  if (begun.error) {
    throw mutationError(begun.error, 'Could not reserve this submission attempt.');
  }
  const row = Array.isArray(begun.data) ? begun.data[0] : begun.data;
  if (!row?.submission_id || row.submission_id.toLowerCase() !== entry.submissionId) {
    throw new Error('Submission reservation did not match this attempt.');
  }
}

export async function recoverPendingAssignmentSubmission(assignmentId: string): Promise<SubmissionRecoveryResult> {
  if (isE2EAuthMockEnabled()) return { status: 'none' };

  const client = requireSupabase();
  const profile = await getCurrentProfile();
  if (profile.role !== 'student') return { status: 'none' };
  const student = await getCurrentStudent(profile.id);
  const entry = readSubmissionAttemptLedger(student.id, assignmentId);
  if (!entry) return { status: 'none' };

  if (await confirmSubmissionAttempt(client, entry)) {
    clearSubmissionAttemptLedger(entry);
    await triggerAiGrading(client, entry.submissionId);
    return { status: 'confirmed', submissionId: entry.submissionId };
  }
  return {
    status: 'pending',
    submissionId: entry.submissionId,
    originalFilename: entry.originalFilename,
  };
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

const MAX_SUBMISSION_FILE_BYTES = 5 * 1024 * 1024;
const SUBMISSION_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'text/plain': ['txt'],
  'text/markdown': ['md', 'markdown'],
  'text/csv': ['csv'],
  'application/json': ['json'],
  'application/xml': ['xml'],
  'text/xml': ['xml'],
};

function validateSubmissionFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.split(';')[0].toLowerCase();
  if (!mimeType || !SUBMISSION_FILE_TYPES[mimeType]?.includes(extension)) {
    throw new Error('Use a PDF, JPG, PNG, WebP, TXT, Markdown, CSV, JSON, or XML file with a matching file extension.');
  }
  if (file.size < 1 || file.size > MAX_SUBMISSION_FILE_BYTES) {
    throw new Error('Submission files must be between 1 byte and 5 MiB.');
  }
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

type AssignmentFinalizePayload = {
  p_assignment_id: string;
  p_title: string;
  p_description: string | null;
  p_subject_id: string | null;
  p_grade: string | null;
  p_due_date: string | null;
  p_status: AssignmentStatus;
  p_attachment_url: string | null;
  p_memo_url: string | null;
  p_expected_revision: number;
  p_rubric_json: unknown;
};

type AssignmentPublishClient = {
  rpc: (
    name: 'create_assignment_draft' | 'finalize_assignment_publication' | 'discard_assignment_staged_assets',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
};

function assignmentFromRpc(data: unknown, fallback: string) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error(fallback);
  }
  return row as Assignment;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameTimestamp(left: string | null | undefined, right: string | null): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return Date.parse(left) === Date.parse(right);
}

function assignmentAssetPath(assignmentId: string, uploadId: string, label: 'attachment', file: File) {
  return `${assignmentId}/staging/${uploadId}/${label}-${safeFileName(file)}`;
}

async function uploadAssignmentAsset(
  client: ReturnType<typeof requireSupabase>,
  bucket: 'assignment-files',
  path: string,
  file: File,
) {
  const uploaded = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploaded.error) {
    throw uploaded.error;
  }
  if (uploaded.data.path !== path) {
    throw new Error('Assignment asset upload returned an unexpected storage path.');
  }
  return uploaded.data.path;
}

async function discardStagedAssignmentAssets(
  client: ReturnType<typeof requireSupabase>,
  assignmentId: string,
  attachmentPath: string | null,
) {
  const discarded = await (client as unknown as AssignmentPublishClient).rpc('discard_assignment_staged_assets', {
    p_assignment_id: assignmentId,
    p_attachment_url: attachmentPath,
    p_memo_url: null,
  });
  if (discarded.error) {
    captureAssignmentError('assignment.staged_asset_cleanup_failed', discarded.error, { assignment_id: assignmentId });
  }
}

async function confirmAssignmentFinalization(
  client: ReturnType<typeof requireSupabase>,
  payload: AssignmentFinalizePayload,
) {
  const confirmed = await client.from('assignments').select('*').eq('id', payload.p_assignment_id).maybeSingle();
  if (confirmed.error || !confirmed.data) {
    return null;
  }
  const assignment = confirmed.data as Assignment;
  return assignment.status === payload.p_status
    && assignment.attachment_url === payload.p_attachment_url
    && assignment.memo_url === payload.p_memo_url
    && assignment.title === payload.p_title
    && (assignment.description || null) === payload.p_description
    && (assignment.subject_id || null) === payload.p_subject_id
    && (assignment.grade || null) === payload.p_grade
    && sameTimestamp(assignment.due_date, payload.p_due_date)
    && canonicalJson(assignment.rubric_json || []) === canonicalJson(payload.p_rubric_json)
    && assignment.revision === payload.p_expected_revision + 1
    ? assignment
    : null;
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

  const rubricJson = parseJsonField(input.rubricJson, [], 'Rubric');
  const subject = await findOrCreateSubject(input);
  const createAttempt = await getAssignmentCreateAttempt(profile.id, {
    organizationId: input.organizationId ?? null,
    title,
    description: input.description?.trim() || null,
    subjectId: subject.id,
    grade,
    dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    rubricJson,
  });
  const drafted = await (client as unknown as AssignmentPublishClient).rpc('create_assignment_draft', {
    p_organization_id: input.organizationId ?? null,
    p_title: title,
    p_description: input.description?.trim() || null,
    p_subject_id: subject.id,
    p_grade: grade,
    p_due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    p_rubric_json: rubricJson,
    p_client_request_id: createAttempt.requestId,
  });

  if (drafted.error) {
    captureAssignmentError('assignment.draft_create_failed', drafted.error, {
      role: profile.role,
      has_attachment: Boolean(input.attachment),
    });
    throw drafted.error;
  }

  const draft = assignmentFromRpc(drafted.data, 'Assignment draft creation did not return an assignment.');
  // A refreshed page can replay a request whose publish committed just before
  // its response was lost. Do not upload or finalize that assignment again.
  if (draft.status === 'published') {
    clearAssignmentCreateAttemptLedger(createAttempt);
    return draft;
  }
  if (draft.status !== 'draft') {
    throw new Error('This assignment creation is no longer a draft. Reload the assignments list before retrying.');
  }
  if (!Number.isInteger(draft.revision) || draft.revision < 1) {
    throw new Error('Assignment revision is unavailable. Reload after maintenance before publishing.');
  }
  const uploadId = createSubmissionAttemptId();
  let attachmentPath: string | null = null;

  try {
    if (input.attachment) {
      attachmentPath = await uploadAssignmentAsset(
        client,
        'assignment-files',
        assignmentAssetPath(draft.id, uploadId, 'attachment', input.attachment),
        input.attachment,
      );
    }
    const finalized = await (client as unknown as AssignmentPublishClient).rpc('finalize_assignment_publication', {
      p_assignment_id: draft.id,
      p_title: title,
      p_description: input.description?.trim() || null,
      p_subject_id: subject.id,
      p_grade: grade,
      p_due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      p_status: 'published',
      p_attachment_url: attachmentPath,
      p_memo_url: null,
      p_expected_revision: draft.revision,
      p_rubric_json: rubricJson,
    } satisfies AssignmentFinalizePayload);
    if (!finalized.error) {
      const assignment = assignmentFromRpc(finalized.data, 'Assignment publication did not return an assignment.');
      clearAssignmentCreateAttemptLedger(createAttempt);
      return assignment;
    }

    const confirmed = await confirmAssignmentFinalization(client, {
      p_assignment_id: draft.id,
      p_title: title,
      p_description: input.description?.trim() || null,
      p_subject_id: subject.id,
      p_grade: grade,
      p_due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      p_status: 'published',
      p_attachment_url: attachmentPath,
      p_memo_url: null,
      p_expected_revision: draft.revision,
      p_rubric_json: rubricJson,
    });
    if (confirmed) {
      clearAssignmentCreateAttemptLedger(createAttempt);
      return confirmed;
    }
    throw finalized.error;
  } catch (error) {
    await discardStagedAssignmentAssets(client, draft.id, attachmentPath);
    captureAssignmentError('assignment.publish_failed', error, {
      assignment_id: draft.id,
      has_attachment: Boolean(input.attachment),
    });
    throw mutationError(error, 'Could not publish assignment.');
  }
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
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new Error('Assignment revision is unavailable. Reload before saving.');
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
  if (current.revision !== input.expectedRevision) {
    throw new Error('This assignment changed while you were editing. Reload it before saving again.');
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

  const rubricJson = parseJsonField(input.rubricJson, current.rubric_json || [], 'Rubric');

  const uploadId = createSubmissionAttemptId();
  let attachmentPath = current.attachment_url || null;
  // Legacy memo paths are retained but cannot be changed through this workflow.
  const memoPath = current.memo_url || null;
  let stagedAttachmentPath: string | null = null;

  try {
    if (input.attachment) {
      stagedAttachmentPath = await uploadAssignmentAsset(
        client,
        'assignment-files',
        assignmentAssetPath(input.assignmentId, uploadId, 'attachment', input.attachment),
        input.attachment,
      );
      attachmentPath = stagedAttachmentPath;
    }
    const payload: AssignmentFinalizePayload = {
      p_assignment_id: input.assignmentId,
      p_title: title,
      p_description: input.description?.trim() || null,
      p_subject_id: subjectId,
      p_grade: grade || null,
      p_due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      p_status: input.status,
      p_attachment_url: attachmentPath,
      p_memo_url: memoPath,
      p_expected_revision: input.expectedRevision,
      p_rubric_json: rubricJson,
    };
    const finalized = await (client as unknown as AssignmentPublishClient).rpc('finalize_assignment_publication', payload);
    if (!finalized.error) {
      return assignmentFromRpc(finalized.data, 'Assignment update did not return an assignment.');
    }

    const confirmed = await confirmAssignmentFinalization(client, payload);
    if (confirmed) {
      return confirmed;
    }
    throw finalized.error;
  } catch (error) {
    await discardStagedAssignmentAssets(client, input.assignmentId, stagedAttachmentPath);
    captureAssignmentError('assignment.update_failed', error, {
      assignment_id: input.assignmentId,
      status: input.status,
      has_attachment: Boolean(input.attachment),
    });
    throw mutationError(error, 'Could not update assignment.');
  }
}

export async function submitAssignment(input: SubmitAssignmentInput): Promise<SubmitAssignmentResult> {
  const proposedSubmissionId = input.submissionId.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(proposedSubmissionId)) {
    throw new Error('A valid submission attempt ID is required.');
  }

  if (isE2EAuthMockEnabled()) {
    return submitE2EAssignment({ ...input, submissionId: proposedSubmissionId });
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

  let contentSha256: string | null = null;
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;

  if (input.file) {
    validateSubmissionFile(input.file);
    contentSha256 = await sha256Hex(input.file);
    originalFilename = safeFileName(input.file);
    mimeType = input.file.type || null;
    sizeBytes = input.file.size;
  }
  const textAnswerSha256 = textAnswer ? await sha256Hex(textAnswer) : null;

  const buildEntry = (submissionId: string): SubmissionAttemptLedgerEntry => {
    const ext = input.file?.name.split('.').pop()?.toLowerCase() || null;
    const storageKey = input.file && contentSha256 && ext
      ? `${student.id}/${input.assignmentId}/${submissionId}/${contentSha256}/submission.${ext}`
      : null;
    return {
      version: 1,
      assignmentId: input.assignmentId,
      studentId: student.id,
      submissionId,
      storageKey,
      originalFilename,
      mimeType,
      sizeBytes,
      contentSha256,
      textAnswerSha256,
      createdAt: new Date().toISOString(),
    };
  };

  let entry = buildEntry(proposedSubmissionId);
  const pendingEntry = readSubmissionAttemptLedger(student.id, input.assignmentId);
  if (pendingEntry) {
    try {
      if (await confirmSubmissionAttempt(client, pendingEntry)) {
        clearSubmissionAttemptLedger(pendingEntry);
        await triggerAiGrading(client, pendingEntry.submissionId);
        return { submissionId: pendingEntry.submissionId, recovered: true };
      }
    } catch (confirmationError) {
      captureAssignmentError('assignment_submission.previous_attempt_confirm_failed', confirmationError, {
        assignment_id: input.assignmentId,
        submission_id: pendingEntry.submissionId,
      });
      throw confirmationError;
    }
    if (sameSubmissionPayload(pendingEntry, entry)) {
      entry = pendingEntry;
    } else {
      clearSubmissionAttemptLedger(pendingEntry);
    }
  }

  writeSubmissionAttemptLedger(entry);
  await beginSubmissionAttempt(client, entry, textAnswer);
  const rpcArgs = submissionAttemptRpcArgs(entry, textAnswer);

  // A previous submit may have committed even though its response was lost.
  // Confirm the durable attempt before any immutable upload. An absent commit
  // is the only state that proceeds.
  try {
    if (await confirmSubmissionAttempt(client, entry)) {
      clearSubmissionAttemptLedger(entry);
      await triggerAiGrading(client, entry.submissionId);
      return { submissionId: entry.submissionId, recovered: true };
    }
  } catch (confirmationError) {
    captureAssignmentError('assignment_submission.confirm_failed', confirmationError, {
      assignment_id: input.assignmentId,
      has_file: Boolean(input.file),
      has_text_answer: Boolean(textAnswer),
    });
    throw confirmationError;
  }

  if (input.file) {
    const uploaded = await client.storage.from('assignment-submissions').upload(rpcArgs.p_storage_key!, input.file, {
      upsert: false,
      contentType: input.file.type || undefined,
      metadata: { original_filename: originalFilename!, sha256: entry.contentSha256! },
    });
    if (uploaded.error) {
      captureAssignmentError('assignment_submission.upload_failed', uploaded.error, {
        assignment_id: input.assignmentId,
        upload_size_bytes: input.file.size,
        mime_type: input.file.type || null,
      });
      // The immutable object may already exist because a prior upload response
      // was lost. Continue to the RPC, which verifies its metadata and digest.
    } else if (uploaded.data.path !== rpcArgs.p_storage_key) {
      throw new Error('Submission upload returned an unexpected storage path.');
    }
  }

  if (!textAnswer && !rpcArgs.p_file_url) {
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
      if (await confirmSubmissionAttempt(client, entry)) {
        clearSubmissionAttemptLedger(entry);
        await triggerAiGrading(client, entry.submissionId);
        return { submissionId: entry.submissionId, recovered: true };
      }
    } catch (confirmationError) {
      captureAssignmentError('assignment_submission.confirm_after_rpc_failed', confirmationError, {
        assignment_id: input.assignmentId,
      });
    }
    throw mutationError(submitted.error, 'Could not submit assignment.');
  }

  const row = Array.isArray(submitted.data) ? submitted.data[0] : submitted.data;
  if (!row?.submission_id || row.submission_id.toLowerCase() !== entry.submissionId) {
    throw new Error('Submission confirmation was incomplete. Retry safely with the same work.');
  }

  clearSubmissionAttemptLedger(entry);
  await triggerAiGrading(client, entry.submissionId);
  return { submissionId: entry.submissionId };
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
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new Error('Submission revision is unavailable. Reload before saving your review.');
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
        p_expected_revision: number;
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
    p_expected_revision: input.expectedRevision,
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
