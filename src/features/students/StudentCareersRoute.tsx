import type { FormEvent } from 'react';
import { useState } from 'react';
import { EmptyState, ErrorState, GreekHeroCard, InsightCard, MetricCard, PageShell, PremiumButton, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { FormField, TextArea } from '../../components/ui/FormField';
import { apiPost } from '../../lib/api/client';
import { useStudentCareersQuery } from './studentQueries';

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
  const { data, loading, error, refetching, reload } = useStudentCareersQuery();
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
    <PageShell
      title="Careers"
      subtitle="Career pathways, subject planning, and focused AI support where it adds practical value."
      section="student"
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <GreekHeroCard
            eyebrow="Odie Careers"
            title="Explore real pathways"
            description="Career guidance stays separate from daily dashboard work so learners can focus on goals, subject choices, and readiness planning."
          />

          <StaggerGrid className="grid gap-4 md:grid-cols-2">
            <StaggerItem><MetricCard label="Career catalogue" value={String(data?.careers?.length || 0)} helper="Careers available through the careers API." tone="aegean" /></StaggerItem>
            <StaggerItem><MetricCard label="Supported subjects" value={String(data?.supportedSubjects?.length || 0)} helper="Subject inputs recognised by the pathway tools." tone="gold" /></StaggerItem>
          </StaggerGrid>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Popular pathways</h2>
                <p className="mt-1 text-sm text-slate-600">Loaded from the existing careers service during the React consolidation.</p>
              </div>
              <PremiumButton disabled={refetching} onClick={() => void reload()}>{refetching ? 'Refreshing...' : 'Refresh'}</PremiumButton>
            </div>
            {loading ? <div className="mt-4"><SkeletonCard /></div> : null}
            {error ? <div className="mt-4"><ErrorState title="Careers unavailable" description={error} onRetry={() => void reload()} /></div> : null}
            <StaggerGrid className="mt-5 grid gap-3">
              {(data?.careers || []).slice(0, 8).map((career) => (
                <StaggerItem key={career.id}>
                  <InsightCard title={career.title} description={career.description || career.category || 'Career insight available in the careers service.'} />
                </StaggerItem>
              ))}
              {data && !data.careers?.length ? <EmptyState title="No careers loaded" description="Refresh once the careers overview endpoint is available." /> : null}
            </StaggerGrid>
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
            <PremiumButton
              type="submit"
              disabled={busy || !message.trim()}
            >
              {busy ? 'Sending...' : 'Send'}
            </PremiumButton>
          </form>
        </Card>
      </section>
    </PageShell>
  );
}
