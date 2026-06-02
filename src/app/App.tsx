import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AdminAssignmentsRoute } from '../features/admin/AdminAssignmentsRoute';
import { AdminDashboardRoute } from '../features/admin/AdminDashboardRoute';
import {
  AdminApprovalsRoute,
  AdminAuditRoute,
  AdminOpsRunbookRoute,
  AdminPrivacyRequestsRoute,
  AdminReconciliationRoute,
  AdminResultsRoute,
  AdminRetentionRoute,
} from '../features/admin/AdminOperationsRoutes';
import { AdminPaymentsRoute } from '../features/admin/AdminPaymentsRoute';
import { AdminPayrollRoute } from '../features/admin/AdminPayrollRoute';
import { AdminReportsRoute } from '../features/admin/AdminReportsRoute';
import { AdminStudentsRoute } from '../features/admin/AdminStudentsRoute';
import { AdminTutorsRoute } from '../features/admin/AdminTutorsRoute';
import { LoginRoute } from '../features/auth/LoginRoute';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { OnboardingRoute } from '../features/onboarding/OnboardingRoute';
import { StudentAssignmentDetailRoute } from '../features/students/StudentAssignmentDetailRoute';
import { StudentAssignmentsRoute } from '../features/students/StudentAssignmentsRoute';
import { StudentCareersRoute } from '../features/students/StudentCareersRoute';
import { StudentDashboardRoute } from '../features/students/StudentDashboardRoute';
import { StudentProgressRoute } from '../features/students/StudentProgressRoute';
import { StudentResultsRoute } from '../features/students/StudentResultsRoute';
import { StudentCommunityRoute, StudentReportsRoute } from '../features/students/StudentSupportRoutes';
import { TutorClassesRoute } from '../features/tutors/TutorClassesRoute';
import { TutorDashboardRoute } from '../features/tutors/TutorDashboardRoute';
import { TutorReportsRoute, TutorRiskRoute, TutorSessionsRoute } from '../features/tutors/TutorOperationsRoutes';
import { TutorSubmissionsRoute } from '../features/tutors/TutorSubmissionsRoute';
import {
  AboutRoute,
  GuidesIndexRoute,
  MatricMathsMistakesGuideRoute,
  PrivacyRoute,
  ProgramsRoute,
  PublicHomeRoute,
  TermsRoute,
} from './routes/PublicRoutes';

export function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<PublicHomeRoute />} />
        <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
        <Route path="/student/assignments" element={<Navigate to="/dashboard/student/assignments" replace />} />
        <Route path="/student/assignments/:assignmentId" element={<ProtectedRoute roles={['student']}><StudentAssignmentDetailRoute /></ProtectedRoute>} />
        <Route path="/student/*" element={<Navigate to="/dashboard/student" replace />} />
        <Route path="/tutor/*" element={<Navigate to="/dashboard/tutor" replace />} />
        <Route path="/reports/*" element={<Navigate to="/dashboard/student/reports" replace />} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="/programs" element={<ProgramsRoute />} />
        <Route path="/guides" element={<GuidesIndexRoute />} />
        <Route path="/guides/matric-maths-mistakes-guide" element={<MatricMathsMistakesGuideRoute />} />
        <Route path="/privacy" element={<PrivacyRoute />} />
        <Route path="/terms" element={<TermsRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/student" replace />} />
        <Route path="/dashboard/" element={<Navigate to="/dashboard/student" replace />} />
        <Route path="/dashboard/login" element={<LoginRoute />} />
        <Route path="/dashboard/login.html" element={<Navigate to="/dashboard/login" replace />} />
        <Route path="/onboarding/student" element={<OnboardingRoute role="student" />} />
        <Route path="/onboarding/tutor" element={<OnboardingRoute role="tutor" />} />
        <Route path="/dashboard/student" element={<ProtectedRoute roles={['student']}><StudentDashboardRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/assignments" element={<ProtectedRoute roles={['student']}><StudentAssignmentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/assignments/:assignmentId" element={<ProtectedRoute roles={['student']}><StudentAssignmentDetailRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/progress" element={<ProtectedRoute roles={['student']}><StudentProgressRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/results" element={<ProtectedRoute roles={['student']}><StudentResultsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/careers" element={<ProtectedRoute roles={['student']}><StudentCareersRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/community" element={<ProtectedRoute roles={['student']}><StudentCommunityRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/reports" element={<ProtectedRoute roles={['student']}><StudentReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/students" element={<ProtectedRoute roles={['admin']}><AdminStudentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/tutors" element={<ProtectedRoute roles={['admin']}><AdminTutorsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/assignments" element={<ProtectedRoute roles={['admin']}><AdminAssignmentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/approvals" element={<ProtectedRoute roles={['admin']}><AdminApprovalsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/payments" element={<ProtectedRoute roles={['admin']}><AdminPaymentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/payroll" element={<ProtectedRoute roles={['admin']}><AdminPayrollRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/reconciliation" element={<ProtectedRoute roles={['admin']}><AdminReconciliationRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/audit" element={<ProtectedRoute roles={['admin']}><AdminAuditRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/privacy-requests" element={<ProtectedRoute roles={['admin']}><AdminPrivacyRequestsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/retention" element={<ProtectedRoute roles={['admin']}><AdminRetentionRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/results" element={<ProtectedRoute roles={['admin']}><AdminResultsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/ops-runbook" element={<ProtectedRoute roles={['admin']}><AdminOpsRunbookRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/reports" element={<ProtectedRoute roles={['admin']}><AdminReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor" element={<ProtectedRoute roles={['tutor']}><TutorDashboardRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor/classes" element={<ProtectedRoute roles={['tutor']}><TutorClassesRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor/sessions" element={<ProtectedRoute roles={['tutor']}><TutorSessionsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor/submissions" element={<ProtectedRoute roles={['tutor']}><TutorSubmissionsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor/reports" element={<ProtectedRoute roles={['tutor']}><TutorReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/tutor/risk" element={<ProtectedRoute roles={['tutor']}><TutorRiskRoute /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
