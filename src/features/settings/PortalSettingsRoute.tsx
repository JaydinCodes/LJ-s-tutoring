import { Bell, Moon, Monitor, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../auth/AuthProvider';

type ThemePreference = 'system' | 'light' | 'dark';
type PortalPreferences = { assignmentReminders: boolean; theme: ThemePreference };

function preferenceKey(profileId: string) {
  return `odysseus-portal-preferences:${profileId}`;
}

function readPreferences(profileId?: string): PortalPreferences {
  if (!profileId || typeof window === 'undefined') return { assignmentReminders: true, theme: 'system' };
  try {
    const saved = window.localStorage.getItem(preferenceKey(profileId));
    return saved ? { assignmentReminders: true, theme: 'system', ...JSON.parse(saved) } : { assignmentReminders: true, theme: 'system' };
  } catch { return { assignmentReminders: true, theme: 'system' }; }
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
}

export function PortalSettingsRoute({ role }: { role: 'student' | 'tutor' }) {
  const auth = useAuth();
  const [preferences, setPreferences] = useState(() => readPreferences(auth.profile?.id));

  useEffect(() => { setPreferences(readPreferences(auth.profile?.id)); }, [auth.profile?.id]);

  function save(next: PortalPreferences) {
    setPreferences(next);
    if (auth.profile?.id) window.localStorage.setItem(preferenceKey(auth.profile.id), JSON.stringify(next));
    applyTheme(next.theme);
  }

  const label = role === 'tutor' ? 'Tutor' : 'Student';
  return (
    <DashboardShell title="Settings" subtitle={`Control your ${label.toLowerCase()} portal preferences on this device.`} section={role}>
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Notifications</h2>
        <p className="mt-1 text-sm text-slate-600">Choose whether assignment reminders appear in this browser.</p>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
          <span className="flex items-center gap-3"><Bell className="h-5 w-5 text-brand-aegean" aria-hidden="true" /><span><span className="block font-semibold text-slate-950">Assignment reminders</span><span className="text-sm text-slate-600">Due dates and newly assigned work</span></span></span>
          <input aria-label="Enable assignment reminders" checked={preferences.assignmentReminders} className="h-5 w-5 accent-slate-950" type="checkbox" onChange={(event) => save({ ...preferences, assignmentReminders: event.target.checked })} />
        </label>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold text-slate-950">Appearance</h2>
        <p className="mt-1 text-sm text-slate-600">Your choice is saved for this account on this device.</p>
        <div className="mt-5 flex flex-wrap gap-3" role="radiogroup" aria-label="Colour theme">
          {([{ value: 'system', label: 'Use device setting', icon: Monitor }, { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }] as const).map(({ value, label: optionLabel, icon: Icon }) => (
            <button aria-checked={preferences.theme === value} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${preferences.theme === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-800'}`} key={value} role="radio" type="button" onClick={() => save({ ...preferences, theme: value })}>
              <Icon className="mr-2 inline h-4 w-4" aria-hidden="true" />{optionLabel}
            </button>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}
