import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { SmoothScroll } from '../components/animations/SmoothScroll';
import { queryClient } from '../lib/query/client';
import { initErrorReporting } from '../lib/monitoring/errorReporting';
import '../styles/tailwind.css';

const PortalApp = lazy(() => import('./PortalApp').then((module) => ({ default: module.PortalApp })));
const PublicApp = lazy(() => import('./PublicApp').then((module) => ({ default: module.PublicApp })));

function isPortalRoute(pathname: string) {
  return /^(?:\/dashboard|\/student|\/login|\/onboarding)(?:\/|$)/.test(pathname);
}

function AppBootFallback() {
  return <main className="min-h-screen bg-brand-parchment dark:bg-slate-950" aria-busy="true"><p className="sr-only" role="status">Loading Project Odysseus</p></main>;
}

initErrorReporting();

const rootNode = document.getElementById('root');

if (!rootNode) {
  throw new Error('root element not found');
}

// Static production documents include search-engine fallback content. Do not
// expose that unhydrated copy as a visible flash while the app bundle starts.
rootNode.classList.remove('app-booting');

ReactDOM.createRoot(rootNode).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SmoothScroll>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<AppBootFallback />}>
              {isPortalRoute(window.location.pathname) ? <PortalApp /> : <PublicApp />}
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </SmoothScroll>
    </QueryClientProvider>
  </React.StrictMode>,
);
