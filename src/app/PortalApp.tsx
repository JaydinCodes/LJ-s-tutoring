import { QueryClientProvider } from '@tanstack/react-query';
import { SmoothScroll } from '../components/animations/SmoothScroll';
import { AuthProvider } from '../features/auth/AuthProvider';
import { PortalThemeRestorer } from '../features/settings/portalPreferences';
import { queryClient } from '../lib/query/client';
import { App } from './App';

export function PortalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SmoothScroll>
        <AuthProvider><PortalThemeRestorer /><App /></AuthProvider>
      </SmoothScroll>
    </QueryClientProvider>
  );
}
