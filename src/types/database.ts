import type {
  Assignment,
  AssignmentSubmission,
  ClassEnrollment,
  ClassRecord,
  Guardian,
  NgoPartner,
  ParentProgressReportRow,
  Payment,
  Profile,
  SessionHistoryRecord,
  SessionRecord,
  Student,
  StudentGuardian,
  StudentProgress,
  StudentCareerProfileRow,
  StudentSessionRow,
  Subject,
  Tutor,
  TutorPayment,
  TutorStudentAllocation,
  AuditLogEntry,
} from './lms';

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile, Omit<Profile, 'id' | 'created_at' | 'updated_at'>, Partial<Profile>>;
      students: Table<Student, Omit<Student, 'id' | 'created_at'>, Partial<Student>>;
      guardians: Table<Guardian, Omit<Guardian, 'id' | 'created_at' | 'updated_at'>, Partial<Guardian>>;
      student_guardians: Table<StudentGuardian, Omit<StudentGuardian, 'id' | 'created_at' | 'updated_at'>, Partial<StudentGuardian>>;
      tutors: Table<Tutor, Omit<Tutor, 'id' | 'created_at'>, Partial<Tutor>>;
      ngo_partners: Table<NgoPartner, Omit<NgoPartner, 'id' | 'created_at'>, Partial<NgoPartner>>;
      subjects: Table<Subject, Omit<Subject, 'id'>, Partial<Subject>>;
      assignments: Table<Assignment, Omit<Assignment, 'id' | 'created_at'>, Partial<Assignment>>;
      assignment_submissions: Table<AssignmentSubmission, Omit<AssignmentSubmission, 'id'>, Partial<AssignmentSubmission>>;
      audit_log: Table<AuditLogEntry, Omit<AuditLogEntry, 'id' | 'created_at'>, never>;
      student_progress: Table<StudentProgress, Omit<StudentProgress, 'id'>, Partial<StudentProgress>>;
      student_career_profiles: Table<StudentCareerProfileRow, Omit<StudentCareerProfileRow, 'id' | 'created_at'>, Partial<StudentCareerProfileRow>>;
      payments: Table<Payment, Omit<Payment, 'id'>, Partial<Payment>>;
      tutor_payments: Table<TutorPayment, Omit<TutorPayment, 'id'>, Partial<TutorPayment>>;
      classes: Table<ClassRecord, Omit<ClassRecord, 'id' | 'created_at' | 'updated_at'>, Partial<ClassRecord>>;
      class_enrollments: Table<ClassEnrollment, Omit<ClassEnrollment, 'id' | 'created_at'>, Partial<ClassEnrollment>>;
      tutor_student_allocations: Table<TutorStudentAllocation, Omit<TutorStudentAllocation, 'id' | 'created_at' | 'updated_at'>, Partial<TutorStudentAllocation>>;
      sessions: Table<SessionRecord, never, never>;
      session_history: Table<SessionHistoryRecord, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      get_student_assignment_submissions: {
        Args: Record<string, never>;
        Returns: AssignmentSubmission[];
      };
      get_parent_progress_reports: {
        Args: Record<string, never>;
        Returns: ParentProgressReportRow[];
      };
      record_audit_event: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: string;
      };
      create_session: {
        Args: {
          p_tutor_student_allocation_id: string;
          p_student_id: string;
          p_date: string;
          p_start_time: string;
          p_end_time: string;
          p_mode: string;
          p_location: string | null;
          p_notes: string | null;
          p_idempotency_key: string | null;
        };
        Returns: SessionRecord;
      };
      update_session: {
        Args: {
          p_session_id: string;
          p_date: string | null;
          p_start_time: string | null;
          p_end_time: string | null;
          p_mode: string | null;
          p_location: string | null;
          p_notes: string | null;
        };
        Returns: SessionRecord;
      };
      submit_session_report: {
        Args: {
          p_session_id: string;
          p_attendance_status: string | null;
          p_topics_covered: string | null;
          p_learner_struggles: string | null;
          p_homework_assigned: string | null;
          p_tutor_private_notes: string | null;
          p_student_summary: string | null;
        };
        Returns: SessionRecord;
      };
      submit_session: {
        Args: { p_session_id: string };
        Returns: SessionRecord;
      };
      approve_session: {
        Args: { p_session_id: string };
        Returns: SessionRecord;
      };
      reject_session: {
        Args: { p_session_id: string; p_reason: string | null };
        Returns: SessionRecord;
      };
      get_student_sessions: {
        Args: Record<string, never>;
        Returns: StudentSessionRow[];
      };
    };
    Enums: Record<string, never>;
  };
}
