import type { AdminMarkbookView } from '../../features/admin/adminMarkbookRepository';
import type { AdminStudentDetailView } from '../../features/admin/adminStudentDetailRepository';
import type { NgoAggregateReport } from '../../features/ngo/ngoReportsRepository';
import type { ParentReportStudent } from '../../features/parents/parentReportsRepository';
import type {
  AdminDashboardView,
  Assignment,
  AssignmentSubmission,
  ClassRecord,
  Student,
  StudentDashboardView,
  StudentProgress,
  TutorAllocatedStudentSummary,
  TutorDashboardView,
  TutorStudentAllocation,
} from '../../types/lms';
import type { MarkSubmissionInput, SubmitAssignmentInput, SubmitAssignmentResult } from '../../features/assignments/assignmentMutations';

const now = '2026-06-08T08:00:00.000Z';
const dueDate = '2030-06-15T16:00:00.000Z';
const e2eSubmissionAttempts = new Map<string, string>();

const e2eClass: ClassRecord = {
  id: 'e2e-class-1',
  name: 'Grade 11 Maths Launch Cohort',
  tutor_id: 'e2e-tutor-1',
  subject: 'Mathematics',
  grade: 'Grade 11',
  location: 'Online',
  day_of_week: 'Tuesday',
  start_time: '16:00',
  end_time: '17:00',
  ngo_partner_id: 'e2e-ngo-1',
  status: 'active',
  created_at: now,
  updated_at: now,
};

const e2eStudent: Student & { full_name?: string; email?: string; allocation_status?: 'active'; focus_notes?: string } = {
  id: 'e2e-student-1',
  profile_id: 'e2e-profile-student',
  grade: 'Grade 11',
  school: 'Launch High',
  parent_name: 'Guardian E2E',
  parent_contact: 'parent.e2e@projectodysseus.test',
  ngo_partner_id: 'e2e-ngo-1',
  status: 'active',
  created_at: now,
  full_name: 'Student E2E',
  email: 'student.e2e@projectodysseus.test',
  allocation_status: 'active',
  focus_notes: 'Functions and exam technique.',
};

const e2eAllocatedStudent: TutorAllocatedStudentSummary & { allocation_status?: 'active'; focus_notes?: string } = {
  student_id: e2eStudent.id,
  full_name: e2eStudent.full_name!,
  email: e2eStudent.email!,
  grade: e2eStudent.grade ?? null,
  school: e2eStudent.school ?? null,
  status: e2eStudent.status,
  allocation_status: 'active',
  focus_notes: 'Functions and exam technique.',
};

const e2eAssignment: Assignment = {
  id: 'e2e-assignment-1',
  title: 'Quadratic Functions Launch Smoke',
  description: 'Complete the short quadratic functions worksheet and upload your working.',
  subject_id: 'e2e-subject-maths',
  subject: 'Mathematics',
  grade: 'Grade 11',
  due_date: dueDate,
  created_by: 'e2e-profile-tutor',
  status: 'published',
  attachment_url: null,
  rubric_json: [
    { id: 'method', label: 'Method', maxMarks: 60 },
    { id: 'accuracy', label: 'Accuracy', maxMarks: 40 },
  ],
  revision: 1,
  created_at: now,
};

const e2eSubmission: AssignmentSubmission & { assignment_title?: string; student_label?: string; student_name?: string } = {
  id: 'e2e-submission-1',
  assignment_id: e2eAssignment.id,
  student_id: e2eStudent.id,
  file_url: 'assignment-submissions/e2e-working.pdf',
  storage_key: 'assignment-submissions/e2e-working.pdf',
  original_filename: 'e2e-working.pdf',
  mime_type: 'application/pdf',
  size_bytes: 24_000,
  text_answer: 'I used factorisation and checked the turning point.',
  submitted_at: now,
  status: 'submitted',
  version_number: 1,
  is_latest: true,
  marks_awarded: null,
  feedback: null,
  rubric_scores_json: {},
  marks_released: false,
  feedback_released: false,
  released_at: null,
  revision: 1,
  // Pre-graded so the AI-draft prefill/badge (aiGradingPrefill.ts) is
  // exercisable in every review surface without a real Gemini call.
  ai_marks_awarded: 78,
  ai_feedback: 'Good use of factorisation; turning point check was correct. Show the discriminant step explicitly next time.',
  ai_rubric_scores_json: { method: 45, accuracy: 33 },
  ai_confidence: 82,
  ai_graded_at: now,
  ai_grading_status: 'completed',
  assignment_title: e2eAssignment.title,
  student_label: e2eStudent.full_name,
  student_name: e2eStudent.full_name,
};

// Student-only Smart Task Queue fixtures exercise every learner-facing lane.
// They never leave E2E mock mode and do not alter production metrics or data.
const e2eSmartQueueAssignments: Assignment[] = [
  {
    ...e2eAssignment,
    id: 'e2e-assignment-returned',
    title: 'Algebra diagnostic corrections',
    description: 'Review the released feedback, correct questions 3 and 5, and upload your revised working.',
    due_date: '2030-06-12T15:00:00.000Z',
  },
  {
    ...e2eAssignment,
    id: 'e2e-assignment-overdue',
    title: 'English evidence paragraph',
    description: 'Write one evidence-based paragraph using the supplied extract.',
    subject_id: 'e2e-subject-english',
    subject: 'English',
    due_date: '2025-06-10T16:00:00.000Z',
  },
  {
    ...e2eAssignment,
    id: 'e2e-assignment-submitted',
    title: 'Geometry proof set',
    description: 'Complete the proof set and show each reason clearly.',
    due_date: '2030-06-18T14:00:00.000Z',
  },
  {
    ...e2eAssignment,
    id: 'e2e-assignment-marked',
    title: 'Photosynthesis lab review',
    description: 'Review the released result and tutor feedback.',
    subject_id: 'e2e-subject-biology',
    subject: 'Biology',
    due_date: '2026-06-02T12:00:00.000Z',
  },
  {
    ...e2eAssignment,
    id: 'e2e-assignment-no-date',
    title: 'Ancient Greece source reflection',
    description: 'Compare the two sources and identify one limitation in each.',
    subject_id: 'e2e-subject-history',
    subject: 'History',
    due_date: null,
  },
  {
    ...e2eAssignment,
    id: 'e2e-assignment-archived',
    title: 'Study skills journal',
    description: 'An older reflection retained for reference.',
    subject_id: null,
    subject: 'Study skills',
    due_date: null,
    status: 'archived',
  },
];

const e2eSmartQueueSubmissions: AssignmentSubmission[] = [
  {
    ...e2eSubmission,
    id: 'e2e-submission-returned',
    assignment_id: 'e2e-assignment-returned',
    original_filename: 'algebra-diagnostic-v1.pdf',
    status: 'returned',
    feedback: 'Questions 3 and 5 need corrected substitution steps.',
    feedback_released: true,
    released_at: '2026-06-09T10:00:00.000Z',
  },
  {
    ...e2eSubmission,
    id: 'e2e-submission-waiting',
    assignment_id: 'e2e-assignment-submitted',
    original_filename: 'geometry-proofs.pdf',
    status: 'submitted',
  },
  {
    ...e2eSubmission,
    id: 'e2e-submission-marked',
    assignment_id: 'e2e-assignment-marked',
    original_filename: 'photosynthesis-lab.pdf',
    status: 'marked',
    marks_awarded: 88,
    feedback: 'Strong explanation of how light intensity affected the observed rate.',
    marks_released: true,
    feedback_released: true,
    released_at: '2026-06-08T13:00:00.000Z',
  },
];

export type E2EStudentTaskQueueState = 'populated' | 'empty' | 'submitted-only' | 'marked-only' | 'null-due' | 'loading' | 'error';

export function getE2EStudentTaskQueueState(): E2EStudentTaskQueueState {
  if (typeof window === 'undefined') return 'populated';
  const value = window.localStorage.getItem('project-odysseus:e2e-task-queue-state');
  return value === 'empty' || value === 'submitted-only' || value === 'marked-only' || value === 'null-due' || value === 'loading' || value === 'error'
    ? value
    : 'populated';
}

const e2eAllocation: TutorStudentAllocation = {
  id: 'e2e-allocation-1',
  tutor_id: 'e2e-tutor-1',
  student_id: e2eStudent.id,
  status: 'active',
  start_date: now,
  end_date: null,
  focus_notes: 'Functions and exam technique.',
  created_at: now,
  updated_at: now,
};

const e2eProgress: StudentProgress[] = [
  {
    id: 'e2e-progress-1',
    student_id: e2eStudent.id,
    subject: 'Mathematics',
    topic: 'Quadratic functions',
    score: 72,
    cognitive_level: 'application',
    recorded_at: now,
  },
  {
    id: 'e2e-progress-2',
    student_id: e2eStudent.id,
    subject: 'Mathematics',
    topic: 'Algebraic manipulation',
    score: 64,
    cognitive_level: 'procedural',
    recorded_at: now,
  },
];

export function getE2EStudentDashboard(): StudentDashboardView {
  const taskQueueState = getE2EStudentTaskQueueState();
  if (taskQueueState === 'error') throw new Error('The task queue could not be loaded.');
  const smartQueueAssignments = taskQueueState === 'empty'
    ? []
    : taskQueueState === 'submitted-only'
      ? [e2eSmartQueueAssignments[2]]
      : taskQueueState === 'marked-only'
        ? [e2eSmartQueueAssignments[3]]
        : taskQueueState === 'null-due'
          ? [e2eSmartQueueAssignments[4]]
          : [e2eAssignment, ...e2eSmartQueueAssignments];
  const smartQueueSubmissions = taskQueueState === 'submitted-only'
    ? [e2eSmartQueueSubmissions[1]]
    : taskQueueState === 'marked-only'
      ? [e2eSmartQueueSubmissions[2]]
      : taskQueueState === 'empty' || taskQueueState === 'null-due'
        ? []
        : e2eSmartQueueSubmissions;

  return {
    profile: {
      name: 'Student E2E',
      grade: 'Grade 11',
      school: 'Launch High',
      parent: 'Guardian E2E',
      ngoPartner: 'ProVision Launch Partner',
    },
    metrics: [
      { label: 'Overall score', value: '68%', helper: 'Recent marked work average.', tone: 'violet' },
      { label: 'Assignments completed', value: '0', helper: 'Submitted or marked assignments.', tone: 'teal' },
      { label: 'Open assignments', value: '1', helper: 'Work still requiring action.', tone: 'amber' },
      { label: 'Classes', value: '1', helper: 'Current classes for this learner.', tone: 'blue' },
    ],
    assignments: smartQueueAssignments,
    progress: e2eProgress,
    classes: [e2eClass],
    sessions: [{
      id: 'e2e-session-1',
      date: '2030-06-10',
      start_time: '16:00',
      end_time: '17:00',
      mode: 'online',
      location: 'Online',
      attendance_status: null,
      topics_covered: null,
      homework_assigned: 'Complete the quadratic functions launch worksheet before the session.',
      student_summary: 'Bring one question about factorisation or graph interpretation.',
      status: 'submitted',
    }],
    assignedTutors: [
      {
        id: 'e2e-tutor-1',
        full_name: 'Tutor E2E',
        email: 'tutor.e2e@projectodysseus.test',
      },
    ],
    submissions: smartQueueSubmissions,
    recommendedNext: {
      title: 'Open the quadratic worksheet',
      description: 'Read the brief and upload working for review.',
      action: 'Open assignment',
    },
    recommendedQuiz: {
      id: 'e2e-quiz-1',
      title: 'Quadratic functions quick check',
      topic: 'Quadratic functions',
      estimatedMinutes: 12,
    },
    careerGoals: [],
    examCalendar: {
      items: [{ id: 'e2e-exam-1', subject: 'Mathematics', title: 'June Functions Check', examDate: '2030-06-20' }],
      nextExam: { id: 'e2e-exam-1', subject: 'Mathematics', title: 'June Functions Check', examDate: '2030-06-20' },
    },
    supportStatus: {
      band: 'on_track',
      label: 'On track',
      explanation: 'E2E learner has enough launch data to render the dashboard.',
      recommendedAction: 'Complete the next assignment.',
    },
    dailyInsightContext: {
      studentId: e2eStudent.id,
      currentAcademicStatus: 'On track',
      averageScore: 68,
      streakDays: 3,
      nextExamTitle: 'June Functions Check',
      nextExamSubject: 'Mathematics',
      nextExamDate: '2030-06-20',
    },
  };
}

export function getE2ETutorDashboard(): TutorDashboardView {
  return {
    profile: {
      name: 'Tutor E2E',
      email: 'tutor.e2e@projectodysseus.test',
      subjects: ['Mathematics'],
      grades: ['Grade 11'],
      status: 'active',
    },
    metrics: [
      { label: 'Learners', value: '1', helper: 'Active students allocated to you.', tone: 'teal' },
      { label: 'Marking queue', value: '1', helper: 'Submitted work still needing tutor action.', tone: 'amber' },
      { label: 'Sessions', value: '1', helper: 'Upcoming session records available.', tone: 'blue' },
      { label: 'Marked', value: '0', helper: 'Submissions with completed feedback.', tone: 'blue' },
    ],
    classes: [e2eClass],
    allocatedStudents: [e2eAllocatedStudent],
    assignments: [e2eAssignment],
    submissions: [e2eSubmission],
    markingQueue: [e2eSubmission],
    sessions: [{ id: 'e2e-session-1', student_name: 'Student E2E', date: '2030-06-10', start_time: '16:00', end_time: '17:00', status: 'scheduled' }],
    learnerProgress: [{
      student_id: e2eStudent.id,
      student_name: 'Student E2E',
      grade: 'Grade 11',
      school: 'Launch High',
      focus_notes: 'Functions and exam technique.',
      pending_submissions: 1,
      marked_submissions: 0,
      average_mark: null,
      latest_submission_at: now,
    }],
  };
}

export function getE2EAdminDashboard(): AdminDashboardView {
  return {
    metrics: [
      { label: 'Students', value: '1', helper: 'Recent learner records.', tone: 'teal' },
      { label: 'Tutors', value: '1', helper: 'Recent tutor records.', tone: 'violet' },
      { label: 'Assignments', value: '1', helper: 'Recently created assignment records.', tone: 'amber' },
      { label: 'Outstanding payments', value: 'R0.00', helper: 'Student payments not marked as paid.', tone: 'blue' },
    ],
    students: [e2eStudent],
    guardians: [{
      id: 'e2e-guardian-1',
      profile_id: 'e2e-profile-parent',
      full_name: 'Guardian E2E',
      email: 'parent.e2e@projectodysseus.test',
      phone: null,
      communication_preference: 'email',
      status: 'active',
      created_at: now,
      updated_at: now,
      linked_students: [{
        id: 'e2e-student-guardian-1',
        student_id: e2eStudent.id,
        guardian_id: 'e2e-guardian-1',
        relationship_type: 'guardian',
        is_primary: true,
        can_receive_reports: true,
        status: 'active',
        created_at: now,
        updated_at: now,
        student_name: 'Student E2E',
      }],
    }],
    tutors: [{
      id: 'e2e-tutor-1',
      profile_id: 'e2e-profile-tutor',
      subjects: ['Mathematics'],
      grades: ['Grade 11'],
      hourly_rate: 450,
      status: 'active',
      created_at: now,
      full_name: 'Tutor E2E',
      email: 'tutor.e2e@projectodysseus.test',
      phone: null,
    }],
    assignments: [e2eAssignment],
    submissions: [e2eSubmission],
    payments: [],
    tutorPayments: [],
    ngoPartners: [{
      id: 'e2e-ngo-1',
      name: 'ProVision Launch Partner',
      contact_person: 'NGO Partner E2E',
      contact_email: 'ngo.e2e@projectodysseus.test',
      contact_phone: null,
      location: 'Cape Town',
      notes: 'E2E smoke partner.',
      created_at: now,
    }],
    sessions: [{
      id: 'e2e-admin-session-1',
      date: '2030-06-10',
      start_time: '16:00',
      end_time: '17:00',
      status: 'submitted',
      tutor_name: 'Tutor E2E',
      student_name: 'Student E2E',
      topics_covered: 'Quadratic functions',
    }],
    team: [
      { name: 'Academic operations', role: 'Admin', focus: 'Students, tutors, classes, assignments' },
      { name: 'NGO reporting', role: 'Partner', focus: 'Launch impact reporting' },
    ],
  };
}

export function getE2EAdminMarkbook(): AdminMarkbookView {
  const row = {
    ...e2eSubmission,
    assignment_title: e2eAssignment.title,
    assignment_grade: e2eAssignment.grade,
    subject_name: 'Mathematics',
    student_name: 'Student E2E',
    student_grade: e2eStudent.grade,
    student_school: e2eStudent.school,
    class_ids: [e2eClass.id],
    class_names: [e2eClass.name],
  };

  return {
    rows: [row],
    assignments: [e2eAssignment],
    classes: [e2eClass],
    students: [e2eStudent],
    summary: {
      totalSubmissions: 1,
      markedSubmissions: 0,
      pendingSubmissions: 1,
      averageMark: null,
    },
  };
}

export function getE2EAdminStudentDetail(studentId: string): AdminStudentDetailView {
  const matches = studentId === e2eStudent.id;
  return {
    allocations: matches ? [{ ...e2eAllocation, tutor_name: 'Tutor E2E', tutor_email: 'tutor.e2e@projectodysseus.test' }] : [],
    submissions: matches ? [{ ...e2eSubmission, assignment_title: e2eAssignment.title, subject_name: 'Mathematics' }] : [],
    tutors: [{
      id: 'e2e-tutor-1',
      profile_id: 'e2e-profile-tutor',
      subjects: ['Mathematics'],
      grades: ['Grade 11'],
      hourly_rate: 450,
      status: 'active',
      created_at: now,
      full_name: 'Tutor E2E',
      email: 'tutor.e2e@projectodysseus.test',
    }],
  };
}

export function getE2EParentReports(): { students: ParentReportStudent[] } {
  return {
    students: [{
      student_id: e2eStudent.id,
      student_name: 'Student E2E',
      grade: 'Grade 11',
      school: 'Launch High',
      released_results: [{
        assignment_title: e2eAssignment.title,
        marks_awarded: 78,
        feedback: 'Clear method and good correction notes.',
        released_at: now,
      }],
      latest_topic: { topic: 'Quadratic functions', score: 72 },
      average_mark: 78,
      session_count: 3,
      attendance_rate: 100,
      completed_work_count: 2,
      latest_student_summary: 'We practised quadratic functions and set a short revision task for this week.',
      next_session_date: '2030-01-18',
    }],
  };
}

export function getE2ENgoReports(): { reports: NgoAggregateReport[] } {
  return {
    reports: [{
      ngo_partner_id: 'e2e-ngo-1',
      ngo_partner_name: 'ProVision Launch Partner',
      student_count: 1,
      released_results: 1,
      average_mark: 78,
      active_classes: 1,
      progress_topic_count: 2,
    }],
  };
}

export async function submitE2EAssignment(input: SubmitAssignmentInput): Promise<SubmitAssignmentResult> {
  const textAnswer = input.textAnswer?.trim() || null;
  if (!input.file && !textAnswer) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  const payloadFingerprint = JSON.stringify({
    assignmentId: input.assignmentId,
    textAnswer,
    file: input.file
      ? {
          name: input.file.name,
          type: input.file.type,
          size: input.file.size,
        }
      : null,
  });
  const committedFingerprint = e2eSubmissionAttempts.get(input.submissionId);
  if (committedFingerprint) {
    if (committedFingerprint !== payloadFingerprint) {
      throw new Error('submission_retry_payload_mismatch');
    }
    return { submissionId: input.submissionId };
  }

  e2eSubmissionAttempts.set(input.submissionId, payloadFingerprint);
  if (input.file?.name === 'retry-once.pdf') {
    // Simulate the hardest browser case: the backend committed successfully,
    // but the response disappeared. A correct UI retries the same UUID and the
    // mock's idempotent branch above returns that one committed attempt.
    throw new Error('Connection interrupted after the submission was saved. Retry the same work safely.');
  }

  return { submissionId: input.submissionId };
}

export async function markE2ESubmission(input: MarkSubmissionInput): Promise<AssignmentSubmission> {
  const marks = input.marksAwarded?.trim() ? Number(input.marksAwarded) : null;
  if (marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > 100)) {
    throw new Error('Marks must be a number between 0 and 100.');
  }

  return {
    ...e2eSubmission,
    id: input.submissionId,
    marks_awarded: marks,
    feedback: input.feedback?.trim() || null,
    status: input.status,
    rubric_scores_json: {},
    marks_released: Boolean(input.marksReleased),
    feedback_released: Boolean(input.feedbackReleased),
    released_at: input.marksReleased || input.feedbackReleased ? now : null,
  };
}
