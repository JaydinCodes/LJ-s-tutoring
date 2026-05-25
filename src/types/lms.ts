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
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url?: string | null;
  text_answer?: string | null;
  submitted_at?: string | null;
  status: SubmissionStatus | string;
  marks_awarded?: number | null;
  feedback?: string | null;
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
  tutor_id: string;
  subject_id?: string | null;
  subject?: string | null;
  grade?: string | null;
  location?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  ngo_partner_id?: string | null;
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
  submissions: AssignmentSubmission[];
}

export interface AdminDashboardView {
  metrics: DashboardMetric[];
  students: Array<Student & { full_name?: string; email?: string; phone?: string | null; ngo_partner?: string }>;
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
  assignments: Assignment[];
  submissions: Array<AssignmentSubmission & { assignment_title?: string; student_label?: string }>;
}
