import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { routeRedirects } from './routeManifest';

const AboutRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.AboutRoute })));
const PrivacyRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.PrivacyRoute })));
const ProgramsRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.ProgramsRoute })));
const PublicHomeRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.PublicHomeRoute })));
const TermsRoute = lazy(() => import('./routes/PublicRoutes').then((module) => ({ default: module.TermsRoute })));
const NotFoundRoute = lazy(() => import('./routes/NotFoundRoute').then((module) => ({ default: module.NotFoundRoute })));

export function PublicApp() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-brand-parchment dark:bg-slate-950" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<PublicHomeRoute />} />
        {routeRedirects.map((redirect) => <Route key={redirect.from} path={redirect.from} element={<Navigate to={redirect.to} replace />} />)}
        <Route path="/about" element={<AboutRoute />} />
        <Route path="/programs" element={<ProgramsRoute />} />
        <Route path="/privacy" element={<PrivacyRoute />} />
        <Route path="/terms" element={<TermsRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </Suspense>
  );
}
