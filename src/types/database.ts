import type {
  Assignment,
  AssignmentSubmission,
  ClassEnrollment,
  ClassRecord,
  NgoPartner,
  Payment,
  Profile,
  Student,
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
