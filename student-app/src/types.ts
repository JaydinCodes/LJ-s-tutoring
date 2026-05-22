export interface StudentProfile {
  name?: string;
  grade?: string;
  school?: string;
  partnerAffiliation?: string;
  completion?: {
    completed?: number;
    required?: string[];
  };
  guardian?: {
    name?: string;
    relationship?: string;
    contactStatus?: string;
  };
}

export interface DashboardSession {
  id: string;
  date: string;
  startTime: string;
  mode?: string;
  subject?: string;
  tutorName?: string;
  joinLink?: string | null;
}

export interface DashboardData {
  profile: StudentProfile;
  today?: {
    hasUpcoming?: boolean;
    session?: DashboardSession;
    emptyState?: {
      title?: string;
      ctaLabel?: string;
      ctaHref?: string;
    };
  };
  thisWeek?: {
    minutesStudied?: number;
    sessionsAttended?: number;
    streakDays?: number;
  };
  streak?: {
    current?: number;
    longest?: number;
    xp?: number;
  };
  progressSnapshot?: Array<{
    topic: string;
    sessions: number;
    minutes: number;
    completion: number;
  }>;
  assignedTutors?: Array<{
    id: string;
    full_name: string;
    subject?: string;
    qualification_band?: string;
  }>;
  academicProfile?: {
    grade?: string;
    school?: string;
    enrolledSubjects?: string[];
    activeTutoringSubjects?: string[];
  };
  baseline?: {
    subject: string;
    percentage: number;
    level_band?: string;
    grade?: string;
    completed_at?: string;
    recommended_next_steps_json?: string[];
  } | null;
  supportStatus?: {
    label?: string;
    explanation?: string;
    recommendedAction?: string;
  } | null;
  attendance?: {
    items: Array<{
      id: string;
      date: string;
      start_time?: string;
      subject?: string;
      tutor_name?: string;
      attendance_status?: string;
      status?: string;
    }>;
    attended: number;
    total: number;
  };
  goals?: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
    subject?: string;
    target_value?: number | null;
    current_value?: number | null;
    due_date?: string;
    status?: string;
  }>;
  latestReport?: {
    id: string;
    weekStart: string;
    weekEnd: string;
    createdAt: string;
    summary?: string[];
  } | null;
  recommendedNext?: {
    title?: string;
    description?: string;
  };
  predictiveScore?: {
    momentumScore?: number;
  } | null;
  sessionSummaries?: Array<{
    id: string;
    date: string;
    subject?: string;
    student_summary?: string;
    homework_assigned?: string;
  }>;
}

export interface AssignmentItem {
  id: string;
  subject?: string;
  title?: string;
  topic?: string;
  instructions?: string;
  dueDate?: string;
  due_date?: string;
  status?: string;
  submission_status?: string;
  submission_id?: string;
  submitted_at?: string;
  original_filename?: string;
  maxFileSizeMB?: number;
  max_file_size_mb?: number;
  allowedFileTypes?: string[];
  allowed_file_types?: string[];
}

export interface ResultsItem {
  id: string;
  title?: string;
  subject?: string;
  topic?: string;
  percentage?: number;
  score?: number;
  totalMarks?: number;
  markedAt?: string;
  feedbackSummary?: string;
  strengths?: string[] | string;
  improvementAreas?: string[] | string;
  reportId?: string;
}

export interface OptionalItemsResult<T> {
  available: boolean;
  items: T[];
  payload?: Record<string, unknown>;
}

export interface CareerOverview {
  careers: Array<{ id: string; title: string; category?: string; growthLabel?: string; description?: string }>;
  institutions: Array<{ id: string }>;
  supportedSubjects: string[];
  stats?: {
    careerCount?: number;
  };
}
