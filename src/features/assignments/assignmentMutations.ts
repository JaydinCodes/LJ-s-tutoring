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
}

export interface MarkSubmissionInput {
  submissionId: string;
  marksAwarded?: string;
  feedback?: string;
  status: 'submitted' | 'marked' | 'returned';
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

  const existing = await client
    .from('assignment_submissions')
    .select('*')
    .eq('assignment_id', input.assignmentId)
    .eq('student_id', student.id)
    .order('version_number', { ascending: false })
    .order('submitted_at', { ascending: false });

  if (existing.error) {
    throw existing.error;
  }

  const existingSubmissions = (existing.data || []) as AssignmentSubmission[];
  const latestSubmission = existingSubmissions.find((submission) => submission.is_latest) || existingSubmissions[0] || null;
  const nextVersion = Math.max(0, ...existingSubmissions.map((submission) => Number(submission.version_number || 0))) + 1;
  const submissionId = stableUploadId();
  let fileUrl: string | null = latestSubmission?.file_url || null;
  let storageKey: string | null = latestSubmission?.storage_key || null;
  let originalFilename: string | null = latestSubmission?.original_filename || null;
  let mimeType: string | null = latestSubmission?.mime_type || null;
  let sizeBytes: number | null = latestSubmission?.size_bytes || null;

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

  if (!input.file && !fileUrl) {
    throw new Error('Add a file before submitting a file-only correction, or include a written answer.');
  }

  if (existingSubmissions.length) {
    const latestReset = await (client.from('assignment_submissions') as unknown as {
      update: (payload: { is_latest: boolean }) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }>;
        };
      };
    })
      .update({ is_latest: false })
      .eq('assignment_id', input.assignmentId)
      .eq('student_id', student.id);

    if (latestReset.error) {
      throw latestReset.error;
    }
  }

  const saved = await (client.from('assignment_submissions') as unknown as {
    insert: (
      payload: {
        id: string;
        assignment_id: string;
        student_id: string;
        storage_key: string | null;
        file_url: string | null;
        original_filename: string | null;
        mime_type: string | null;
        size_bytes: number | null;
        text_answer: string | null;
        submitted_at: string;
        status: string;
        version_number: number;
        is_latest: boolean;
      }
    ) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
  })
    .insert({
      id: submissionId,
      assignment_id: input.assignmentId,
      student_id: student.id,
      storage_key: storageKey,
      file_url: fileUrl,
      original_filename: originalFilename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      text_answer: textAnswer,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
      version_number: nextVersion,
      is_latest: true,
    })
    .select('*')
    .single();

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

  const saved = await (client.from('assignment_submissions') as unknown as {
    update: (payload: { marks_awarded: number | null; feedback: string | null; status: string }) => {
      eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: Error | null }> } };
    };
  })
    .update({
      marks_awarded: marks,
      feedback: input.feedback?.trim() || null,
      status: input.status,
    })
    .eq('id', input.submissionId)
    .select('*')
    .single();

  if (saved.error) {
    throw saved.error;
  }

  const submission = saved.data as AssignmentSubmission;
  if (marks !== null && input.status === 'marked') {
    await createProgressFromMarkedSubmission(submission, marks);
  }

  return submission;
}

async function createProgressFromMarkedSubmission(submission: AssignmentSubmission, score: number) {
  const client = requireSupabase();
  const assignmentResult = await client
    .from('assignments')
    .select('*')
    .eq('id', submission.assignment_id)
    .maybeSingle();

  if (assignmentResult.error || !assignmentResult.data) {
    return;
  }

  const assignment = assignmentResult.data as Assignment;
  const payload = {
    student_id: submission.student_id,
    subject_id: assignment.subject_id || null,
    topic: assignment.title,
    score,
    cognitive_level: null,
    recorded_at: new Date().toISOString(),
  };

  const inserted = await (client.from('student_progress') as unknown as {
    insert: (row: typeof payload) => Promise<{ data: unknown; error: Error | null }>;
  }).insert(payload);

  if (inserted.error) {
    throw inserted.error;
  }
}
