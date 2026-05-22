import { Navigate, Route, Routes } from 'react-router-dom';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { CareersPage } from './pages/CareersPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResultsPage } from './pages/ResultsPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student/dashboard/" replace />} />
      <Route path="/student/dashboard/" element={<StudentDashboardPage />} />
      <Route path="/student/assignments/" element={<AssignmentsPage />} />
      <Route path="/student/results/" element={<ResultsPage />} />
      <Route path="/student/progress/" element={<ProgressPage />} />
      <Route path="/student/careers/" element={<CareersPage />} />
      <Route path="*" element={<Navigate to="/student/dashboard/" replace />} />
    </Routes>
  );
}
