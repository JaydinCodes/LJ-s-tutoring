import { optionalApiGet } from '../../lib/api/client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import type { Assignment, AssignmentSubmission, ClassRecord, Profile, Student, StudentDashboardView, StudentProgress } from '../../types/lms';

interface LegacyDashboard {
  profile?: { name?: string; grade?: string; school?: string; guardian?: { name?: string }; partnerAffiliation?: string };
  academicProfile?: { grade?: string; school?: string };
  attendance?: { attended?: number; total?: number };
  streak?: { current?: number };
  progressSnapshot?: Array<{ topic: string; completion: number }>;
}

interface LegacyAssignments {
  assignments?: Assignment[];
  items?: Assignment[];
}

interface LegacyResults {
  results?: Array<{ percentage?: number }>;
  items?: Array<{ percentage?: number }>;
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

async function loadFromApi(): Promise<StudentDashboardView> {
  const [dashboard, assignmentsPayload, resultsPayload] = await Promise.all([
    optionalApiGet<LegacyDashboard>('/dashboard', {}),
    optionalApiGet<LegacyAssignments>('/student/assignments', { assignments: [] }),
    optionalApiGet<LegacyResults>('/student/results', { results: [] }),
  ]);

  const assignments = assignmentsPayload.assignments || assignmentsPayload.items || [];
  const results = resultsPayload.results || resultsPayload.items || [];
  const submissions = assignments
    .filter((item) => (item as Assignment & { submission_id?: string }).submission_id)
    .map((item) => {
      const legacy = item as Assignment & {
        submission_id?: string;
        submission_status?: string;
        submitted_at?: string;
        original_filename?: string;
      };
      return {
        id: legacy.submission_id || `${legacy.id}-submission`,
        assignment_id: legacy.id,
        student_id: 'current',
        file_url: legacy.original_filename || null,
        submitted_at: legacy.submitted_at || null,
        status: legacy.submission_status || 'submitted',
      } as AssignmentSubmission;
    });
  const completed = submissions.filter((item) => ['submitted', 'late', 'reviewed', 'marked'].includes(String(item.status || '').toLowerCase())).length;
  const attendanceRate = dashboard.attendance?.total ? Math.round(((dashboard.attendance.attended || 0) / dashboard.attendance.total) * 100) : 0;
  const score = average(results.map((item) => Number(item.percentage)).filter(Number.isFinite));

  return {
    profile: {
      name: dashboard.profile?.name || 'Student',
      grade: dashboard.academicProfile?.grade || dashboard.profile?.grade,
      school: dashboard.academicProfile?.school || dashboard.profile?.school,
      parent: dashboard.profile?.guardian?.name,
      ngoPartner: dashboard.profile?.partnerAffiliation,
    },
    metrics: [
      { label: 'Overall score', value: score == null ? '--' : `${score}%`, helper: 'Recent marked work average.', tone: 'violet' },
      { label: 'Assignments completed', value: String(completed), helper: 'Submitted or marked assignments.', tone: 'teal' },
      { label: 'Open assignments', value: String(Math.max(0, assignments.length - completed)), helper: 'Work still requiring action.', tone: 'amber' },
      { label: 'Attendance', value: `${attendanceRate}%`, helper: `${dashboard.streak?.current || 0} day study streak.`, tone: 'blue' },
    ],
    assignments,
    progress: (dashboard.progressSnapshot || []).map((item, index) => ({
      id: `legacy-progress-${index}`,
      student_id: 'current',
      topic: item.topic,
      score: item.completion,
      recorded_at: new Date().toISOString(),
    })),
    classes: [],
    submissions,
  };
}

async function loadFromSupabase(): Promise<StudentDashboardView | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) {
    return null;
  }

  const profileResult = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).single();
  const profile = profileResult.data as Profile | null;
  if (!profile) {
    return null;
  }

  const studentResult = await supabase.from('students').select('*').eq('profile_id', profile.id).single();
  const student = studentResult.data as Student | null;
  if (!student) {
    return null;
  }

  const [assignmentsResult, progressResult, classesResult, submissionsResult] = await Promise.all([
    supabase.from('assignments').select('*').eq('grade', student.grade || '').neq('status', 'draft').order('due_date', { ascending: true }),
    supabase.from('student_progress').select('*').eq('student_id', student.id).order('recorded_at', { ascending: false }),
    supabase.from('classes').select('*').eq('grade', student.grade || ''),
    supabase.from('assignment_submissions').select('*').eq('student_id', student.id).order('submitted_at', { ascending: false }),
  ]);

  const assignments = (assignmentsResult.data || []) as Assignment[];
  const progress = (progressResult.data || []) as StudentProgress[];
  const classes = (classesResult.data || []) as ClassRecord[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const submittedIds = new Set(submissions.map((item) => item.assignment_id));
  const score = average(progress.map((item) => Number(item.score)).filter(Number.isFinite));
  const subjectIds = Array.from(new Set(assignments.map((assignment) => assignment.subject_id).filter(Boolean)));
  const subjectsResult = subjectIds.length
    ? await supabase.from('subjects').select('*').in('id', subjectIds)
    : { data: [], error: null };
  const subjectNameById = new Map(((subjectsResult.data || []) as Array<{ id: string; name?: string }>).map((subject) => [subject.id, subject.name]));
  const assignmentsWithSubjects = assignments.map((assignment) => ({
    ...assignment,
    subject: assignment.subject || (assignment.subject_id ? subjectNameById.get(assignment.subject_id) : undefined),
  }));

  return {
    profile: {
      name: profile.full_name,
      grade: student.grade || undefined,
      school: student.school || undefined,
      parent: student.parent_name || undefined,
    },
    metrics: [
      { label: 'Overall score', value: score == null ? '--' : `${score}%`, helper: 'Average from Supabase progress records.', tone: 'violet' },
      { label: 'Assignments completed', value: String(submittedIds.size), helper: 'Submitted assignment records.', tone: 'teal' },
      { label: 'Open assignments', value: String(assignmentsWithSubjects.filter((item) => !submittedIds.has(item.id)).length), helper: 'Published work not yet submitted.', tone: 'amber' },
      { label: 'Classes', value: String(classes.length), helper: 'Current classes for this learner.', tone: 'blue' },
    ],
    assignments: assignmentsWithSubjects,
    progress,
    classes,
    submissions,
  };
}

export async function loadStudentDashboard(): Promise<StudentDashboardView> {
  const supabaseView = await loadFromSupabase();
  return supabaseView || loadFromApi();
}
