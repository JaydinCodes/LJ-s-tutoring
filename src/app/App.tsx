import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAssignmentsRoute } from '../features/admin/AdminAssignmentsRoute';
import { AdminDashboardRoute } from '../features/admin/AdminDashboardRoute';
import { AdminPaymentsRoute } from '../features/admin/AdminPaymentsRoute';
import { AdminReportsRoute } from '../features/admin/AdminReportsRoute';
import { AdminStudentsRoute } from '../features/admin/AdminStudentsRoute';
import { AdminTutorsRoute } from '../features/admin/AdminTutorsRoute';
import { LoginRoute } from '../features/auth/LoginRoute';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { OnboardingRoute } from '../features/onboarding/OnboardingRoute';
import { StudentAssignmentsRoute } from '../features/students/StudentAssignmentsRoute';
import { StudentDashboardRoute } from '../features/students/StudentDashboardRoute';
import { StudentProgressRoute } from '../features/students/StudentProgressRoute';
import { TutorClassesRoute } from '../features/tutors/TutorClassesRoute';
import { TutorDashboardRoute } from '../features/tutors/TutorDashboardRoute';
import { TutorSubmissionsRoute } from '../features/tutors/TutorSubmissionsRoute';
import { PlaceholderRoute } from './routes/PlaceholderRoute';
import { PublicHomeRoute } from './routes/PublicHomeRoute';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomeRoute />} />
      <Route path="/about" element={<PlaceholderRoute title="About Project Odysseus" area="Public website" />} />
      <Route path="/programs" element={<PlaceholderRoute title="Programs" area="Public website" />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/dashboard/login" element={<LoginRoute />} />
      <Route path="/onboarding/student" element={<OnboardingRoute role="student" />} />
      <Route path="/onboarding/tutor" element={<OnboardingRoute role="tutor" />} />
      <Route path="/dashboard/student" element={<ProtectedRoute roles={['student']}><StudentDashboardRoute /></ProtectedRoute>} />
      <Route path="/dashboard/student/assignments" element={<ProtectedRoute roles={['student']}><StudentAssignmentsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/student/progress" element={<ProtectedRoute roles={['student']}><StudentProgressRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin/students" element={<ProtectedRoute roles={['admin']}><AdminStudentsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin/tutors" element={<ProtectedRoute roles={['admin']}><AdminTutorsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin/assignments" element={<ProtectedRoute roles={['admin']}><AdminAssignmentsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments" element={<ProtectedRoute roles={['admin']}><AdminPaymentsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/admin/reports" element={<ProtectedRoute roles={['admin']}><AdminReportsRoute /></ProtectedRoute>} />
      <Route path="/dashboard/tutor" element={<ProtectedRoute roles={['tutor']}><TutorDashboardRoute /></ProtectedRoute>} />
      <Route path="/dashboard/tutor/classes" element={<ProtectedRoute roles={['tutor']}><TutorClassesRoute /></ProtectedRoute>} />
      <Route path="/dashboard/tutor/submissions" element={<ProtectedRoute roles={['tutor']}><TutorSubmissionsRoute /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
