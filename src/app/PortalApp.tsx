import { AuthProvider } from '../features/auth/AuthProvider';
import { PortalThemeRestorer } from '../features/settings/portalPreferences';
import { App } from './App';

export function PortalApp() {
  return <AuthProvider><PortalThemeRestorer /><App /></AuthProvider>;
}
