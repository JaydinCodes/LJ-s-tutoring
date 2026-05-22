import { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useAsyncData } from '../hooks/useAsyncData';
import { studentApi } from '../lib/api';

export function CareersPage() {
  const dashboard = useAsyncData(() => studentApi.dashboard(), []);
  const overview = useAsyncData(() => studentApi.careersOverview(), []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'Hi, I am Odie. Ask me about career pathways, subject choices, APS gaps, or a study plan for your goal.' },
  ]);

  return (
    <DashboardLayout title="Careers" subtitle="Career pathways, next actions, and the AI assistant live here only." name={dashboard.data?.profile?.name || 'Student'}>
      {overview.loading ? <LoadingState lines={6} /> : overview.error ? <ErrorState title="Careers unavailable" description={overview.error} onRetry={() => void overview.reload()} /> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-4">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">Odie Careers</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Explore real pathways, not demo cards.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">This page is the only place where the student-facing AI assistant remains available. It works alongside the existing careers APIs and keeps dashboard guidance separate from general study tracking.</p>
            </article>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Career catalogue</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{overview.data?.careers.length || 0} careers are available to explore.</p>
              </article>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Supported subjects</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{overview.data?.supportedSubjects.length || 0} subject inputs are recognised by the career tools.</p>
              </article>
            </div>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Popular career pathways</h3>
              <div className="mt-4 grid gap-3">
                {overview.data?.careers?.slice(0, 6).map((career) => (
                  <div key={career.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-900 dark:text-white">{career.title}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{career.description || career.category || 'Career insight available in the careers service.'}</p>
                  </div>
                ))}
              </div>
              {!overview.data?.careers?.length ? <div className="mt-4"><EmptyState title="No careers loaded" description="Refresh once the careers overview endpoint is available." /></div> : null}
            </article>
          </section>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Ask Odie about careers</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use the assistant for pathway advice, subject choices, readiness planning, and career-aligned study planning.</p>
            <div className="mt-5 space-y-3 rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-900/70">
              {chat.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'assistant' ? 'bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100' : 'bg-violet-600 text-white'}`}>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Ask about a career pathway, APS target, or subject choice..."
              />
              <button
                type="button"
                disabled={busy || !message.trim()}
                onClick={async () => {
                  const prompt = message.trim();
                  if (!prompt) {return;}
                  setBusy(true);
                  setChat((current) => [...current, { role: 'user', text: prompt }]);
                  setMessage('');
                  try {
                    const response = await studentApi.careersChat({ message: prompt });
                    setChat((current) => [...current, { role: 'assistant', text: response.message || response.text || 'I need a little more context before I can help.' }]);
                  } catch {
                    setChat((current) => [...current, { role: 'assistant', text: 'I cannot connect right now. Please try again shortly.' }]);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {busy ? 'Odie is thinking...' : 'Send'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </DashboardLayout>
  );
}
