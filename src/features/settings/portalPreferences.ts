import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';

export type ThemePreference = 'system' | 'light' | 'dark';
export type PortalPreferences = { assignmentReminders: boolean; theme: ThemePreference };

const defaultPreferences: PortalPreferences = { assignmentReminders: true, theme: 'system' };

export function preferenceKey(profileId: string) {
  return `odysseus-portal-preferences:${profileId}`;
}

export function readPreferences(profileId?: string): PortalPreferences {
  if (!profileId || typeof window === 'undefined') return defaultPreferences;
  try {
    const saved = window.localStorage.getItem(preferenceKey(profileId));
    if (!saved) return defaultPreferences;
    const parsed = JSON.parse(saved) as Partial<PortalPreferences>;
    const theme = parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'system';
    return { assignmentReminders: parsed.assignmentReminders ?? true, theme };
  } catch {
    return defaultPreferences;
  }
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
}

export function PortalThemeRestorer() {
  const auth = useAuth();

  useEffect(() => {
    const preference = readPreferences(auth.profile?.id).theme;
    applyTheme(preference);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (preference === 'system') applyTheme('system'); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [auth.profile?.id]);

  return null;
}
