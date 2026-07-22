import { formatCurrency } from '../../lib/utils/format';
import { isE2EAuthMockEnabled } from '../../lib/e2e/mockAuth';
import { getE2EAdminDashboard } from '../../lib/e2e/mockRoleData';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { resolveSignedUrls } from '../../lib/supabase/storage';
import type { AdminDashboardView, Assignment, AssignmentSubmission, Guardian, NgoPartner, Payment, Profile, Student, StudentGuardian, Tutor, TutorPayment } from '../../types/lms';

// Single-stack migration: the legacy /admin/dashboard API is retired. When
// Supabase is unavailable we render an empty dashboard rather than calling the
// dead API (which only ever returned empty fallbacks in production anyway).
function emptyAdminDashboard(): AdminDashboardView {
  return {
    metrics: [
      { label: 'Students', value: '0', helper: 'No learner records available.', tone: 'teal' },
      { label: 'Tutors', value: '0', helper: 'No tutor records available.', tone: 'violet' },
      { label: 'Pending approvals', value: '0', helper: 'Nothing awaiting approval.', tone: 'amber' },
      { label: 'Privacy requests', value: '0', helper: 'No open POPIA requests.', tone: 'blue' },
    ],
    students: [],
    guardians: [],
    tutors: [],
    assignments: [],
    submissions: [],
    payments: [],
    tutorPayments: [],
    ngoPartners: [],
    team: [
      { name: 'Founder / Academic Lead', role: 'Admin', focus: 'Curriculum, tutor quality, learner outcomes' },
      { name: 'Operations Coordinator', role: 'Admin', focus: 'Approvals, schedules, payments, reporting' },
      { name: 'ProVision Liaison', role: 'NGO partner', focus: 'Learner onboarding, impact reporting, rollout support' },
    ],
  };
}

async function loadFromSupabase(): Promise<AdminDashboardView | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const [studentsResult, guardiansResult, studentGuardiansResult, tutorsResult, assignmentsResult, submissionsResult, paymentsResult, tutorPaymentsResult, ngoResult] = await Promise.all([
    supabase.from('students').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('guardians').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('student_guardians').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('tutors').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('assignments').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }).limit(50),
    supabase.from('payments').select('*').order('due_date', { ascending: true }).limit(25),
    supabase.from('tutor_payments').select('*').order('payment_period', { ascending: false }).limit(25),
    supabase.from('ngo_partners').select('*').order('name', { ascending: true }),
  ]);

  const students = (studentsResult.data || []) as Student[];
  const guardians = (guardiansResult.data || []) as Guardian[];
  const studentGuardians = (studentGuardiansResult.data || []) as StudentGuardian[];
  const tutors = (tutorsResult.data || []) as Tutor[];
  const assignments = (assignmentsResult.data || []) as Assignment[];
  const submissions = (submissionsResult.data || []) as AssignmentSubmission[];
  const payments = (paymentsResult.data || []) as Payment[];
  const tutorPayments = (tutorPaymentsResult.data || []) as TutorPayment[];
  const ngoPartners = (ngoResult.data || []) as NgoPartner[];
  const profileIds = Array.from(new Set([
    ...students.map((student) => student.profile_id),
    ...tutors.map((tutor) => tutor.profile_id),
  ].filter(Boolean)));
  const profilesResult = profileIds.length
    ? await supabase.from('profiles').select('*').in('id', profileIds)
    : { data: [], error: null };
  const profiles = (profilesResult.data || []) as Profile[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  // assignment-submissions is a private bucket -- resolve the stored path to a
  // short-lived signed URL so admins can actually open the file (see
  // src/lib/supabase/storage.ts).
  const submissionUrlByPath = await resolveSignedUrls(supabase, 'assignment-submissions', submissions.map((submission) => submission.file_url));
  const outstanding = payments.filter((item) => item.status !== 'paid').reduce((total, item) => total + Number(item.amount || 0), 0);
  const assignmentTitleById = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
  const studentNameById = new Map(students.map((student) => [student.id, [student.grade, student.school].filter(Boolean).join(' | ') || student.id]));
  const studentDisplayNameById = new Map(students.map((student) => [student.id, profileById.get(student.profile_id)?.full_name || [student.grade, student.school].filter(Boolean).join(' | ') || student.id]));
  const tutorNameById = new Map(tutors.map((tutor) => [tutor.id, [tutor.subjects?.join(', '), tutor.grades?.join(', ')].filter(Boolean).join(' | ') || tutor.id]));
  const ngoById = new Map(ngoPartners.map((ngo) => [ngo.id, ngo.name]));

  return {
    metrics: [
      { label: 'Students', value: String(students.length), helper: 'Recent learner records.', tone: 'teal' },
      { label: 'Tutors', value: String(tutors.length), helper: 'Recent tutor records.', tone: 'violet' },
      { label: 'Assignments', value: String(assignments.length), helper: 'Recently created assignment records.', tone: 'amber' },
      { label: 'Outstanding payments', value: formatCurrency(outstanding), helper: 'Student payments not marked as paid.', tone: 'blue' },
    ],
    students: students.map((student) => ({
      ...student,
      full_name: profileById.get(student.profile_id)?.full_name,
      email: profileById.get(student.profile_id)?.email,
      phone: profileById.get(student.profile_id)?.phone,
      ngo_partner: student.ngo_partner_id ? ngoById.get(student.ngo_partner_id) : undefined,
    })),
    guardians: guardians.map((guardian) => ({
      ...guardian,
      linked_students: studentGuardians
        .filter((link) => link.guardian_id === guardian.id)
        .map((link) => ({
          ...link,
          student_name: studentDisplayNameById.get(link.student_id),
        })),
    })),
    tutors: tutors.map((tutor) => ({
      ...tutor,
      full_name: profileById.get(tutor.profile_id)?.full_name,
      email: profileById.get(tutor.profile_id)?.email,
      phone: profileById.get(tutor.profile_id)?.phone,
    })),
    assignments,
    submissions: submissions.map((submission) => ({
      ...submission,
      assignment_title: assignmentTitleById.get(submission.assignment_id),
      student_name: studentNameById.get(submission.student_id),
      file_url: (submission.file_url && submissionUrlByPath.get(submission.file_url)) || submission.file_url,
    })),
    payments: payments.map((payment) => ({
      ...payment,
      student_label: studentNameById.get(payment.student_id),
    })),
    tutorPayments: tutorPayments.map((payment) => ({
      ...payment,
      tutor_label: tutorNameById.get(payment.tutor_id),
    })),
    ngoPartners,
    team: [
      { name: 'Academic operations', role: 'Admin', focus: 'Students, tutors, classes, assignments' },
      { name: 'Finance operations', role: 'Admin', focus: 'Student payments and tutor payouts' },
      { name: 'NGO reporting', role: 'Partner', focus: 'ProVision rollout and learner impact' },
    ],
  };
}

export async function loadAdminDashboard(): Promise<AdminDashboardView> {
  if (isE2EAuthMockEnabled()) {
    return getE2EAdminDashboard();
  }

  const supabaseView = await loadFromSupabase();
  return supabaseView ?? emptyAdminDashboard();
}
