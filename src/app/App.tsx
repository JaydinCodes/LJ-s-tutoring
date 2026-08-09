import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { routeRedirects } from './routeManifest';

const AdminAllocationsRoute = lazy(() => import('../features/admin/AdminAllocationsRoute').then((module) => ({ default: module.AdminAllocationsRoute })));
const AdminAssignmentsRoute = lazy(() => import('../features/admin/AdminAssignmentsRoute').then((module) => ({ default: module.AdminAssignmentsRoute })));
const AdminClassesRoute = lazy(() => import('../features/admin/AdminClassesRoute').then((module) => ({ default: module.AdminClassesRoute })));
const AdminDashboardRoute = lazy(() => import('../features/admin/AdminDashboardRoute').then((module) => ({ default: module.AdminDashboardRoute })));
const AdminApprovalsRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminApprovalsRoute })));
const AdminAuditRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminAuditRoute })));
const AdminOpsRunbookRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminOpsRunbookRoute })));
const AdminPrivacyRequestsRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminPrivacyRequestsRoute })));
const AdminReconciliationRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminReconciliationRoute })));
const AdminRetentionRoute = lazy(() => import('../features/admin/AdminOperationsRoutes').then((module) => ({ default: module.AdminRetentionRoute })));
const AdminPaymentsRoute = lazy(() => import('../features/admin/AdminPaymentsRoute').then((module) => ({ default: module.AdminPaymentsRoute })));
const AdminPayrollRoute = lazy(() => import('../features/admin/AdminPayrollRoute').then((module) => ({ default: module.AdminPayrollRoute })));
const AdminReportsRoute = lazy(() => import('../features/admin/AdminReportsRoute').then((module) => ({ default: module.AdminReportsRoute })));
const AdminResultsRoute = lazy(() => import('../features/admin/AdminResultsRoute').then((module) => ({ default: module.AdminResultsRoute })));
const AdminStudentsRoute = lazy(() => import('../features/admin/AdminStudentsRoute').then((module) => ({ default: module.AdminStudentsRoute })));
const AdminTutorsRoute = lazy(() => import('../features/admin/AdminTutorsRoute').then((module) => ({ default: module.AdminTutorsRoute })));
const AdminUsersRoute = lazy(() => import('../features/admin/AdminUsersRoute').then((module) => ({ default: module.AdminUsersRoute })));
const LoginRoute = lazy(() => import('../features/auth/LoginRoute').then((module) => ({ default: module.LoginRoute })));
const NgoReportsRoute = lazy(() => import('../features/ngo/NgoReportsRoute').then((module) => ({ default: module.NgoReportsRoute })));
const OnboardingRoute = lazy(() => import('../features/onboarding/OnboardingRoute').then((module) => ({ default: module.OnboardingRoute })));
const ParentReportsRoute = lazy(() => import('../features/parents/ParentReportsRoute').then((module) => ({ default: module.ParentReportsRoute })));
const StudentAssignmentDetailRoute = lazy(() => import('../features/students/StudentAssignmentDetailRoute').then((module) => ({ default: module.StudentAssignmentDetailRoute })));
const StudentAssignmentsRoute = lazy(() => import('../features/students/StudentAssignmentsRoute').then((module) => ({ default: module.StudentAssignmentsRoute })));
const StudentCareersRoute = lazy(() => import('../features/students/StudentCareersRoute').then((module) => ({ default: module.StudentCareersRoute })));
const StudentDashboardRoute = lazy(() => import('../features/students/StudentDashboardRoute').then((module) => ({ default: module.StudentDashboardRoute })));
const StudentProgressRoute = lazy(() => import('../features/students/StudentProgressRoute').then((module) => ({ default: module.StudentProgressRoute })));
const StudentResultDetailRoute = lazy(() => import('../features/students/StudentResultsRoute').then((module) => ({ default: module.StudentResultDetailRoute })));
const StudentResultsRoute = lazy(() => import('../features/students/StudentResultsRoute').then((module) => ({ default: module.StudentResultsRoute })));
const StudentResultsSubjectRoute = lazy(() => import('../features/students/StudentResultsRoute').then((module) => ({ default: module.StudentResultsSubjectRoute })));
const StudentCommunityRoute = lazy(() => import('../features/students/StudentSupportRoutes').then((module) => ({ default: module.StudentCommunityRoute })));
const StudentReportsRoute = lazy(() => import('../features/students/StudentSupportRoutes').then((module) => ({ default: module.StudentReportsRoute })));
const StudentSettingsRoute = lazy(() => import('../features/students/StudentSupportRoutes').then((module) => ({ default: module.StudentSettingsRoute })));
const TutorClassesRoute = lazy(() => import('../features/tutors/TutorClassesRoute').then((module) => ({ default: module.TutorClassesRoute })));
const TutorDashboardRoute = lazy(() => import('../features/tutors/TutorDashboardRoute').then((module) => ({ default: module.TutorDashboardRoute })));
const TutorReportsRoute = lazy(() => import('../features/tutors/TutorOperationsRoutes').then((module) => ({ default: module.TutorReportsRoute })));
const TutorRiskRoute = lazy(() => import('../features/tutors/TutorOperationsRoutes').then((module) => ({ default: module.TutorRiskRoute })));
const TutorSessionsRoute = lazy(() => import('../features/tutors/TutorOperationsRoutes').then((module) => ({ default: module.TutorSessionsRoute })));
const TutorSubmissionsRoute = lazy(() => import('../features/tutors/TutorSubmissionsRoute').then((module) => ({ default: module.TutorSubmissionsRoute })));
const AboutRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.AboutRoute })));
const GuidesIndexRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.GuidesIndexRoute })));
const MatricMathsMistakesGuideRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.MatricMathsMistakesGuideRoute })));
const PrivacyRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.PrivacyRoute })));
const ProgramsRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.ProgramsRoute })));
const PublicHomeRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.PublicHomeRoute })));
const TermsRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.TermsRoute })));
const NotFoundRoute = lazy(() => import('./routes/NotFoundRoute').then((module) => ({ default: module.NotFoundRoute })));

function RouteLoadingFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
      <p className="text-sm font-semibold" role="status">Loading page...</p>
    </main>
  );
}

export function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<PublicHomeRoute />} />
          {routeRedirects.map((redirect) => <Route key={redirect.from} path={redirect.from} element={<Navigate to={redirect.to} replace />} />)}
        <Route path="/student/assignments/:assignmentId" element={<ProtectedRoute roles={['student']}><StudentAssignmentDetailRoute /></ProtectedRoute>} />
        <Route path="/student/results" element={<ProtectedRoute roles={['student']}><StudentResultsRoute /></ProtectedRoute>} />
        <Route path="/student/results/subjects/:subject" element={<ProtectedRoute roles={['student']}><StudentResultsSubjectRoute /></ProtectedRoute>} />
        <Route path="/student/results/:resultId" element={<ProtectedRoute roles={['student']}><StudentResultDetailRoute /></ProtectedRoute>} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="/programs" element={<ProgramsRoute />} />
        <Route path="/guides" element={<GuidesIndexRoute />} />
        <Route path="/guides/matric-maths-mistakes-guide" element={<MatricMathsMistakesGuideRoute />} />
        <Route path="/privacy" element={<PrivacyRoute />} />
        <Route path="/terms" element={<TermsRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/dashboard/login" element={<LoginRoute />} />
        <Route path="/onboarding/student" element={<OnboardingRoute role="student" />} />
        <Route path="/onboarding/tutor" element={<OnboardingRoute role="tutor" />} />
        <Route path="/dashboard/student" element={<ProtectedRoute roles={['student']}><StudentDashboardRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/assignments" element={<ProtectedRoute roles={['student']}><StudentAssignmentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/assignments/:assignmentId" element={<ProtectedRoute roles={['student']}><StudentAssignmentDetailRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/progress" element={<ProtectedRoute roles={['student']}><StudentProgressRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/results" element={<ProtectedRoute roles={['student']}><StudentResultsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/results/subjects/:subject" element={<ProtectedRoute roles={['student']}><StudentResultsSubjectRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/results/:resultId" element={<ProtectedRoute roles={['student']}><StudentResultDetailRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/careers" element={<ProtectedRoute roles={['student']}><StudentCareersRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/community" element={<ProtectedRoute roles={['student']}><StudentCommunityRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/reports" element={<ProtectedRoute roles={['student']}><StudentReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/student/settings" element={<ProtectedRoute roles={['student']}><StudentSettingsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/parent/reports" element={<ProtectedRoute roles={['parent']}><ParentReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/ngo/reports" element={<ProtectedRoute roles={['ngo_partner']}><NgoReportsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/students" element={<ProtectedRoute roles={['admin']}><AdminStudentsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/tutors" element={<ProtectedRoute roles={['admin']}><AdminTutorsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/allocations" element={<ProtectedRoute roles={['admin']}><AdminAllocationsRoute /></ProtectedRoute>} />
        <Route path="/dashboard/admin/classes" element={<ProtectedRoute roles={['admin']}><AdminClassesRoute /></ProtectedRoute>} />
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
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </>
  );
}
