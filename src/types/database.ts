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
  Student,
  StudentGuardian,
  StudentProgress,
  Subject,
  Tutor,
  TutorPayment,
  TutorStudentAllocation,
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
      student_progress: Table<StudentProgress, Omit<StudentProgress, 'id'>, Partial<StudentProgress>>;
      payments: Table<Payment, Omit<Payment, 'id'>, Partial<Payment>>;
      tutor_payments: Table<TutorPayment, Omit<TutorPayment, 'id'>, Partial<TutorPayment>>;
      classes: Table<ClassRecord, Omit<ClassRecord, 'id' | 'created_at' | 'updated_at'>, Partial<ClassRecord>>;
      class_enrollments: Table<ClassEnrollment, Omit<ClassEnrollment, 'id' | 'created_at'>, Partial<ClassEnrollment>>;
      tutor_student_allocations: Table<TutorStudentAllocation, Omit<TutorStudentAllocation, 'id' | 'created_at' | 'updated_at'>, Partial<TutorStudentAllocation>>;
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
    };
    Enums: Record<string, never>;
  };
}
