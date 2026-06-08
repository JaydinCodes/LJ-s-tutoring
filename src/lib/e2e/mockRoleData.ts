import type { AdminMarkbookView } from '../../features/admin/adminMarkbookRepository';
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
  TutorDashboardView,
} from '../../types/lms';
import type { MarkSubmissionInput, SubmitAssignmentInput } from '../../features/assignments/assignmentMutations';

const now = '2026-06-08T08:00:00.000Z';
const dueDate = '2030-06-15T16:00:00.000Z';

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
  assignment_title: e2eAssignment.title,
  student_label: e2eStudent.full_name,
  student_name: e2eStudent.full_name,
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
    assignments: [e2eAssignment],
    progress: e2eProgress,
    classes: [e2eClass],
    assignedTutors: [
      {
        id: 'e2e-tutor-1',
        profile_id: 'e2e-profile-tutor',
        subjects: ['Mathematics'],
        grades: ['Grade 11'],
        hourly_rate: 450,
        status: 'active',
        created_at: now,
        full_name: 'Tutor E2E',
        email: 'tutor.e2e@projectodysseus.test',
      },
    ],
    submissions: [],
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
    allocatedStudents: [e2eStudent],
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

export async function submitE2EAssignment(input: SubmitAssignmentInput): Promise<AssignmentSubmission> {
  const textAnswer = input.textAnswer?.trim() || null;
  if (!input.file && !textAnswer) {
    throw new Error('Add a file or a written answer before submitting.');
  }

  return {
    ...e2eSubmission,
    id: 'e2e-submission-uploaded',
    assignment_id: input.assignmentId,
    file_url: input.file ? `assignment-submissions/${input.file.name}` : null,
    original_filename: input.file?.name || null,
    mime_type: input.file?.type || null,
    size_bytes: input.file?.size || null,
    text_answer: textAnswer,
    submitted_at: new Date('2026-06-08T09:00:00.000Z').toISOString(),
    status: 'submitted',
  };
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
