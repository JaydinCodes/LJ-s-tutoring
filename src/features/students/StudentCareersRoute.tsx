import type { FormEvent } from 'react';
import { useState } from 'react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField, TextArea } from '../../components/ui/FormField';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { apiPost, optionalApiGet } from '../../lib/api/client';
import careersDataset from '../../../lms-api/data/odie-careers/careers.v1.json';
import coursesDataset from '../../../lms-api/data/odie-careers/courses.v1.json';

interface CareerOverview {
  careers?: Array<{ id: string; title: string; description?: string; category?: string }>;
  supportedSubjects?: string[];
}

async function loadCareersOverview() {
  const fallback = {
    careers: careersDataset.careers,
    supportedSubjects: coursesDataset.supportedSubjects,
  };
  return optionalApiGet<CareerOverview>('/odie-careers/overview', fallback);
}

async function askCareersAssistant(message: string, history: Array<{ role: 'user' | 'assistant'; text: string }>) {
  return apiPost<{ message?: string; text?: string }>('/assistant/careers-chat', {
    message: [
      'The learner is using the Project Odysseus Careers dashboard.',
      'Give career pathway advice, subject planning, APS readiness guidance, and study planning.',
      `Learner question: ${message}`,
    ].join('\n'),
    history: history
      .filter((item) => item.text.trim())
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.text })),
  });
}

export function StudentCareersRoute() {
  const { data, loading, error, reload } = useAsyncResource(loadCareersOverview, []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'Ask about career pathways, subject choices, APS gaps, or a study plan for your goal.' },
  ]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt) {
      return;
    }
    setBusy(true);
    setMessage('');
    setChat((current) => [...current, { role: 'user', text: prompt }]);
    try {
      const response = await askCareersAssistant(prompt, chat);
      setChat((current) => [...current, { role: 'assistant', text: response.message || response.text || 'I need a little more context before I can help.' }]);
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setChat((current) => [...current, { role: 'assistant', text: `I cannot connect to Odie right now. ${details.includes('assistant_not_configured') ? 'No assistant provider is configured on the API server yet.' : 'Please check that the LMS API is running and try again shortly.'}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      title="Careers"
      subtitle="Career pathways, subject planning, and focused AI support where it adds practical value."
      section="student"
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Odie Careers</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Explore real pathways</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Career guidance stays separate from daily dashboard work so learners can focus on goals, subject choices, and readiness planning.</p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-slate-950">Career catalogue</h2>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{data?.careers?.length || 0}</p>
              <p className="mt-1 text-sm text-slate-600">Careers available through the careers API.</p>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold text-slate-950">Supported subjects</h2>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{data?.supportedSubjects?.length || 0}</p>
              <p className="mt-1 text-sm text-slate-600">Subject inputs recognised by the pathway tools.</p>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Popular pathways</h2>
                <p className="mt-1 text-sm text-slate-600">Loaded from the existing careers service during the React consolidation.</p>
              </div>
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Refresh</button>
            </div>
            {loading ? <p className="mt-4 text-sm text-slate-600">Loading careers...</p> : null}
            {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="mt-5 grid gap-3">
              {(data?.careers || []).slice(0, 8).map((career) => (
                <div key={career.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-950">{career.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{career.description || career.category || 'Career insight available in the careers service.'}</p>
                </div>
              ))}
              {data && !data.careers?.length ? <EmptyState title="No careers loaded" description="Refresh once the careers overview endpoint is available." /> : null}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-xl font-semibold text-slate-950">Ask Odie about careers</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use the assistant for pathway advice, subject choices, readiness planning, and career-aligned study planning.</p>
          <div className="mt-5 space-y-3 rounded-lg bg-slate-50 p-4">
            {chat.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`rounded-lg px-4 py-3 text-sm leading-6 ${item.role === 'assistant' ? 'bg-white text-slate-700' : 'bg-slate-950 text-white'}`}>
                {item.text}
              </div>
            ))}
          </div>
          <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
            <FormField label="Message">
              <TextArea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about a career pathway, APS target, or subject choice..." />
            </FormField>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending...' : 'Send'}
            </button>
          </form>
        </Card>
      </section>
    </DashboardShell>
  );
}
