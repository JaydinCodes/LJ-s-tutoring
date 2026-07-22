export type UserRole = 'student' | 'tutor' | 'admin' | 'parent' | 'ngo_partner';
export type RecordStatus = 'active' | 'inactive' | 'pending' | 'approved' | 'suspended';
export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';
export type SubmissionStatus = 'not_submitted' | 'submitted' | 'marked' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'voided';

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  profile_id: string;
  grade?: string | null;
  school?: string | null;
  parent_name?: string | null;
  parent_contact?: string | null;
  ngo_partner_id?: string | null;
  status: RecordStatus;
  created_at: string;
}

export interface Tutor {
  id: string;
  profile_id: string;
  subjects: string[];
  grades: string[];
  hourly_rate?: number | null;
  status: RecordStatus;
  created_at: string;
  // Tutor-onboarding/vetting fields (admin + self-tutor views only -- deliberately
  // excluded from the student-facing tutors query in studentDashboardRepository.ts,
  // see the EXPOSURE NOTE in docs/supabase/schema.sql).
  qualification_band?: string | null;
  qualified_subjects_json?: unknown | null;
  approval_status?: string | null;
  approval_reviewed_by?: string | null;
  approval_reviewed_at?: string | null;
  approval_note?: string | null;
  teaching_preferences_json?: unknown | null;
}

export interface NgoPartner {
  id: string;
  name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  location?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  grade?: string | null;
  curriculum?: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  subject_id?: string | null;
  subject?: string | null;
  grade?: string | null;
  due_date?: string | null;
  created_by?: string | null;
  status: AssignmentStatus | string;
  attachment_url?: string | null;
  rubric_json?: RubricCriterion[] | null;
  created_at: string;
}

export interface Guardian {
  id: string;
  profile_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  communication_preference: string;
  notes?: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentGuardian {
  id: string;
  student_id: string;
  guardian_id: string;
  relationship_type: string;
  is_primary: boolean;
  can_receive_reports: boolean;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  maxMarks: number;
  description?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url?: string | null;
  storage_key?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  text_answer?: string | null;
  submitted_at?: string | null;
  status: SubmissionStatus | string;
  version_number?: number | null;
  is_latest?: boolean | null;
  marks_awarded?: number | null;
  feedback?: string | null;
  rubric_scores_json?: Record<string, number | string | null> | null;
  marks_released?: boolean | null;
  feedback_released?: boolean | null;
  released_at?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id?: string | null;
  actor_role?: UserRole | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StudentProgress {
  id: string;
  student_id: string;
  subject_id?: string | null;
  subject?: string | null;
  topic: string;
  score: number;
  cognitive_level?: string | null;
  recorded_at: string;
}

// Supabase student_career_profiles row (snake_case DB shape). The camelCase
// StudentCareerProfile used by the careers UI lives in the careers repository.
export interface StudentCareerProfileRow {
  id: string;
  student_id: string;
  interests_json: string[];
  preferred_subjects_json: string[];
  target_careers_json: string[];
  aps_target: number | null;
  saved_careers_json: string[];
  created_at: string;
  updated_at: string;
}

export interface ParentProgressReportRow {
  student_id: string;
  student_name: string;
  grade?: string | null;
  school?: string | null;
  assignment_title?: string | null;
  marks_awarded?: number | null;
  feedback?: string | null;
  released_at?: string | null;
  topic?: string | null;
  topic_score?: number | null;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_type: string;
  status: PaymentStatus | string;
  due_date?: string | null;
  paid_at?: string | null;
  notes?: string | null;
}

export interface TutorPayment {
  id: string;
  tutor_id: string;
  amount: number;
  payment_period: string;
  status: PaymentStatus | string;
  paid_at?: string | null;
  notes?: string | null;
}

export interface ClassRecord {
  id: string;
  name: string;
  tutor_id: string;
  subject_id?: string | null;
  subject?: string | null;
  grade?: string | null;
  location?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  ngo_partner_id?: string | null;
  status: RecordStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  status: RecordStatus;
  created_at: string;
}

export interface TutorStudentAllocation {
  id: string;
  tutor_id: string;
  student_id: string;
  status: RecordStatus;
  start_date?: string | null;
  end_date?: string | null;
  focus_notes?: string | null;
  // Engagement/contract fields folded in from the retired Prisma `Assignment`
  // model (migration plan §3A). `rate_override` is tutor/admin-only and is
  // deliberately excluded from the student dashboard's column selection.
  subject_id?: string | null;
  rate_override?: string | number | null;
  allowed_days_json?: unknown | null;
  allowed_time_ranges_json?: unknown | null;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

// Supabase public.sessions row (snake_case DB shape, lowercase status). Named
// `SessionRecord` (not `Session`) to avoid colliding with @supabase/supabase-js's
// own `Session` auth type, already imported elsewhere in this codebase.
export interface SessionRecord {
  id: string;
  organization_id: string;
  tutor_id: string;
  student_id: string;
  tutor_student_allocation_id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  mode: string;
  location?: string | null;
  notes?: string | null;
  attendance_status?: string | null;
  topics_covered?: string | null;
  learner_struggles?: string | null;
  homework_assigned?: string | null;
  tutor_private_notes?: string | null;
  student_summary?: string | null;
  report_review_note?: string | null;
  payout_override: boolean;
  sync_key?: string | null;
  status: SessionStatus;
  created_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface SessionHistoryRecord {
  id: string;
  session_id: string;
  changed_by_profile_id?: string | null;
  change_type: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  created_at: string;
}

// Supabase get_student_sessions() RPC row: the redacted student-safe subset of
// SessionRecord (excludes tutor_private_notes/report_review_note/payout_override/
// notes/approved_by/sync_key -- see the RPC comment in docs/supabase/schema.sql).
export interface StudentSessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  mode: string;
  location?: string | null;
  attendance_status?: string | null;
  topics_covered?: string | null;
  homework_assigned?: string | null;
  student_summary?: string | null;
  status: SessionStatus;
}

// Supabase generate_weekly_report() payload_json shape (see docs/supabase/schema.sql).
// Deliberately has no `summary`/`topics`/`assignmentHighlights`/`nextBestStep` fields --
// those were read by the pre-migration UI but never actually existed in either the
// old Fastify payload or this one; see WeeklyReportDetail/ReportDetail for the fix.
export interface WeeklyReportPayload {
  student: { id: string; name: string; grade?: string | null };
  week: { start: string; end: string };
  metrics: { sessionsAttended: number; timeStudiedMinutes: number };
  topicProgress: Array<{ subject: string; topic: string; completion: number }>;
  tutorNotesSummary: string[];
  goalsNextWeek: string[];
}

export interface WeeklyReportRecord {
  id: string;
  student_id: string;
  week_start: string;
  week_end: string;
  payload_json: WeeklyReportPayload;
  created_by?: string | null;
  created_at: string;
}

// Supabase public.student_score_snapshots row (see docs/supabase/schema.sql).
// reasons_json entries carry {label, detail, ...} -- matching shape RiskCard
// already expects (reason.label || reason.detail).
export interface StudentScoreSnapshotReason {
  key?: string;
  label?: string;
  impact?: string;
  value?: number;
  detail?: string;
  source_type?: string | null;
  source_id?: string | null;
}

export interface StudentScoreSnapshotRecord {
  id: string;
  organization_id: string;
  student_id: string;
  score_date: string;
  risk_score: number;
  momentum_score: number;
  reasons_json: StudentScoreSnapshotReason[];
  metrics_json: Record<string, unknown>;
  recommended_actions_json: Array<{ label: string; href: string }>;
  created_at: string;
}

// Supabase public.pay_periods / adjustments / invoices / invoice_lines rows
// (see docs/supabase/schema.sql, "Finance/payroll" section). Statuses and
// adjustment/invoice-line types are lowercase in this schema, unlike the
// retired Fastify API's uppercase Prisma-era strings -- the repository layer
// maps case at the boundary so components can keep using uppercase.
export type PayPeriodStatus = 'open' | 'locked';
export type AdjustmentType = 'bonus' | 'correction' | 'penalty';
export type AdjustmentStatus = 'draft' | 'approved';
export type InvoiceStatus = 'draft' | 'issued' | 'paid';
export type InvoiceLineType = 'session' | 'adjustment';

export interface PayPeriodRecord {
  id: string;
  period_start_date: string;
  period_end_date: string;
  status: PayPeriodStatus;
  locked_at?: string | null;
  locked_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AdjustmentRecord {
  id: string;
  tutor_id: string;
  pay_period_id: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  status: AdjustmentStatus;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  approved_at?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  related_session_id?: string | null;
}

export interface InvoiceRecord {
  id: string;
  tutor_id: string;
  period_start: string;
  period_end: string;
  invoice_number: string;
  total_amount: number;
  status: InvoiceStatus;
  created_at: string;
}

export interface InvoiceLineRecord {
  id: string;
  invoice_id: string;
  session_id?: string | null;
  adjustment_id?: string | null;
  line_type: InvoiceLineType;
  description: string;
  minutes?: number | null;
  rate?: number | null;
  amount: number;
}

// Shape returned by the get_pay_period_integrity() RPC -- deliberately mirrors
// the retired Fastify GET /admin/integrity/pay-period/:weekStart response 1:1
// so the frontend needs no reshaping.
export interface PayPeriodIntegritySnapshot {
  payPeriod: { id?: string; status?: string };
  overlaps: Array<{ session_id: string; tutor_id: string; student_id: string; date: string; start_time: string; end_time: string; overlap_id: string }>;
  outsideAssignmentWindow: Array<{ id: string; tutor_id: string; student_id: string; date: string; start_time: string; end_time: string }>;
  missingInvoiceLines: Array<{ id: string; tutor_id: string; date: string }>;
  invoiceTotalMismatches: Array<{ id: string; invoice_number: string; total_amount: number; line_total: number }>;
  pendingSubmissions: Array<{ tutor_id: string; tutor_name?: string; pending: number }>;
  duplicateSessions: Array<{ tutor_id: string; student_id: string; date: string; start_time: string; end_time: string; count: number }>;
}

// Supabase public.privacy_requests row (see docs/supabase/schema.sql). Student
// subjects only -- there is no tutor-subject path in this schema (a known,
// deliberate gap, not an oversight of the repoint). status uses the shared
// RecordStatus enum: 'pending' (open) -> 'approved' (processed/closed) once
// process_privacy_request() has run.
export type PrivacyRequestType = 'access' | 'correction' | 'deletion';

export interface PrivacyRequestRecord {
  id: string;
  subject_student_id: string;
  subject_profile_id?: string | null;
  request_type: PrivacyRequestType;
  status: RecordStatus;
  requested_by?: string | null;
  notes?: string | null;
  result: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  helper: string;
  tone: 'teal' | 'violet' | 'amber' | 'blue' | 'slate';
}

export interface StudentDashboardView {
  profile: {
    name: string;
    grade?: string;
    school?: string;
    parent?: string;
    ngoPartner?: string;
  };
  metrics: DashboardMetric[];
  assignments: Assignment[];
  progress: StudentProgress[];
  classes: ClassRecord[];
  assignedTutors?: Array<Tutor & { full_name?: string; email?: string }>;
  submissions: AssignmentSubmission[];
  recommendedNext?: {
    title: string;
    description: string;
    action: string;
  } | null;
  recommendedQuiz?: {
    id: string;
    title: string;
    topic: string;
    estimatedMinutes?: number;
  } | null;
  careerGoals?: Array<{
    goalId: string;
    alignmentScore?: number | null;
  }>;
  examCalendar?: {
    items: Array<{
      id: string;
      subject: string;
      title: string;
      examDate: string;
    }>;
    nextExam?: {
      id: string;
      subject: string;
      title: string;
      examDate: string;
    } | null;
  };
  supportStatus?: {
    band: string;
    label: string;
    explanation: string;
    recommendedAction: string;
  };
  dailyInsightContext?: {
    studentId: string;
    nextExamTitle?: string;
    nextExamSubject?: string;
    nextExamDate?: string;
    currentAcademicStatus?: string;
    attendanceRate?: number;
    averageScore?: number;
    streakDays?: number;
  };
}

export interface AdminDashboardView {
  metrics: DashboardMetric[];
  students: Array<Student & { full_name?: string; email?: string; phone?: string | null; ngo_partner?: string }>;
  guardians: Array<Guardian & { linked_students?: Array<StudentGuardian & { student_name?: string }> }>;
  tutors: Array<Tutor & { full_name?: string; email?: string; phone?: string | null }>;
  assignments: Assignment[];
  submissions: Array<AssignmentSubmission & { assignment_title?: string; student_name?: string }>;
  payments: Array<Payment & { student_label?: string }>;
  tutorPayments: Array<TutorPayment & { tutor_label?: string }>;
  ngoPartners: NgoPartner[];
  team: Array<{ name: string; role: string; focus: string }>;
}

export interface TutorDashboardView {
  profile: {
    name: string;
    email?: string;
    subjects: string[];
    grades: string[];
    status: RecordStatus | string;
  };
  metrics: DashboardMetric[];
  classes: ClassRecord[];
  allocatedStudents: Array<Student & { full_name?: string; email?: string; allocation_status?: RecordStatus; focus_notes?: string | null }>;
  assignments: Assignment[];
  submissions: Array<AssignmentSubmission & { assignment_title?: string; student_label?: string }>;
  markingQueue: Array<AssignmentSubmission & { assignment_title?: string; student_label?: string }>;
  sessions: Array<{
    id: string;
    student_name: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    status: string;
  }>;
  learnerProgress: Array<{
    student_id: string;
    student_name: string;
    grade?: string | null;
    school?: string | null;
    focus_notes?: string | null;
    pending_submissions: number;
    marked_submissions: number;
    average_mark?: number | null;
    latest_submission_at?: string | null;
  }>;
}
