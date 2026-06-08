import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { AuthProvider } from '../features/auth/AuthProvider';
import { SmoothScroll } from '../components/animations/SmoothScroll';
import { queryClient } from '../lib/query/client';
import { initErrorReporting } from '../lib/monitoring/errorReporting';
import '../styles/tailwind.css';

initErrorReporting();

const rootNode = document.getElementById('root');

if (!rootNode) {
  throw new Error('root element not found');
}

ReactDOM.createRoot(rootNode).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SmoothScroll>
        <BrowserRouter>
          <ErrorBoundary>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </SmoothScroll>
    </QueryClientProvider>
  </React.StrictMode>,
);
