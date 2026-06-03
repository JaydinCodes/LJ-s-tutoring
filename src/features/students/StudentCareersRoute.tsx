import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, GraduationCap, Sparkles, Target } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { EmptyState, ErrorState, GreekHeroCard, InsightCard, MetricCard, PageShell, PremiumButton, SkeletonCard, StaggerGrid, StaggerItem } from '../../components/dashboard/DashboardDesignSystem';
import { Card } from '../../components/ui/Card';
import { FormField, TextArea, TextInput, inputClassName } from '../../components/ui/FormField';
import { apiStreamText } from '../../lib/api/client';
import { saveCareerProfile, type CareerSummary, type StudentCareerProfile } from './studentCareersRepository';
import { useStudentCareersQuery } from './studentQueries';

const MAX_CHAT_MESSAGES = 12;
const INTEREST_OPTIONS = ['Technology', 'Business', 'Engineering', 'Creative', 'Healthcare', 'Education', 'Data', 'Finance'];

type ChatMessage = { role: 'user' | 'assistant'; text: string };

function emptyProfile(): StudentCareerProfile {
  return {
    interests: [],
    preferredSubjects: [],
    targetCareers: [],
    apsTarget: null,
    savedCareers: [],
  };
}

function formatCurrency(value?: number) {
  if (!value || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function latestCareerMetric(career: CareerSummary) {
  // Salary and growth copy should only appear when the backend dataset supplied it.
  if (!career.salaryRange && !career.growthLabel && !career.demandLabel && !career.forecast) return null;
  return {
    salary: formatCurrency(career.salaryRange?.median),
    growth: career.growthLabel,
    demand: career.demandLabel,
    forecast: career.forecast?.summary,
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function careerMatchesSubject(career: CareerSummary, subject: string) {
  if (!subject) return true;
  const search = `${career.title} ${career.description ?? ''} ${career.category ?? ''}`.toLowerCase();
  const normalized = subject.toLowerCase();
  if (search.includes(normalized)) return true;
  if (normalized.includes('math')) return ['technology', 'engineering', 'finance', 'data'].some((tag) => search.includes(tag));
  if (normalized.includes('account')) return search.includes('business') || search.includes('finance') || search.includes('account');
  if (normalized.includes('life science')) return search.includes('health') || search.includes('science');
  return false;
}

async function streamCareersAssistant(
  message: string,
  history: ChatMessage[],
  profile: StudentCareerProfile,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
) {
  return apiStreamText('/assistant/careers-chat/stream', {
    message: [
      'The learner is using the Project Odysseus Careers cockpit.',
      `Saved interests: ${profile.interests.join(', ') || 'none yet'}.`,
      `Preferred subjects: ${profile.preferredSubjects.join(', ') || 'none yet'}.`,
      `Saved careers: ${profile.savedCareers.join(', ') || 'none yet'}.`,
      profile.apsTarget != null ? `APS target: ${profile.apsTarget}.` : 'APS target: not set.',
      `Learner question: ${message}`,
    ].join('\n'),
    history: history
      .filter((item) => item.text.trim())
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.text })),
  }, onChunk, signal);
}

function FilterChip({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-brand-gold bg-brand-gold text-brand-obsidian'
          : 'border-white/70 bg-white/62 text-brand-navy shadow-sm backdrop-blur-xl hover:bg-white/85 dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-parchment dark:hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  );
}

function CareerCard({
  career,
  saved,
  onToggleSave,
}: {
  career: CareerSummary;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const metrics = latestCareerMetric(career);

  return (
    <motion.article
      className="group rounded-[1.6rem] border border-white/70 bg-white/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-2xl transition hover:border-brand-gold/55 dark:border-white/10 dark:bg-white/[0.05]"
      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-aegean">{career.category || 'Pathway'}</p>
          <h3 className="mt-2 text-lg font-semibold text-brand-obsidian dark:text-brand-parchment">{career.title}</h3>
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${saved ? 'border-brand-gold bg-brand-gold text-brand-obsidian' : 'border-white/70 bg-white/65 text-brand-navy dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment'}`}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-brand-marble">{career.description || 'Explore this pathway and compare subject fit before choosing a next step.'}</p>
      {metrics ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-white/70 bg-white/55 p-3 text-xs text-brand-obsidian backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-parchment sm:grid-cols-3">
          {metrics.salary ? <span>Median salary: {metrics.salary}</span> : null}
          {metrics.growth ? <span>Growth: {metrics.growth}</span> : null}
          {metrics.demand ? <span>Demand: {metrics.demand}</span> : null}
        </div>
      ) : null}
      {metrics?.forecast ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-brand-marble">{metrics.forecast}</p> : null}
    </motion.article>
  );
}

export function StudentCareersRoute() {
  const { data, loading, error, refetching, reload } = useStudentCareersQuery();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ interest: '', subject: '', category: '' });
  const [profile, setProfile] = useState<StudentCareerProfile>(emptyProfile);
  const [profileBusy, setProfileBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Ask about career pathways, subject choices, APS gaps, or a study plan for your goal.' },
  ]);

  useEffect(() => {
    if (data?.profile) setProfile(data.profile);
  }, [data?.profile]);

  const categories = useMemo(() => [...new Set((data?.careers || []).map((career) => career.category).filter(Boolean) as string[])].sort(), [data?.careers]);
  const savedCareers = useMemo(
    () => (data?.careers || []).filter((career) => profile.savedCareers.includes(career.id)),
    [data?.careers, profile.savedCareers],
  );
  const filteredCareers = useMemo(() => {
    return (data?.careers || []).filter((career) => {
      const haystack = `${career.title} ${career.description ?? ''} ${career.category ?? ''}`.toLowerCase();
      if (filters.interest && !haystack.includes(filters.interest.toLowerCase())) return false;
      if (filters.category && career.category !== filters.category) return false;
      if (!careerMatchesSubject(career, filters.subject)) return false;
      return true;
    });
  }, [data?.careers, filters]);

  async function persistProfile(nextProfile: StudentCareerProfile) {
    setProfile(nextProfile);
    setProfileBusy(true);
    try {
      const response = await saveCareerProfile(nextProfile);
      setProfile(response.profile);
      await reload();
    } catch {
      setChat((current) => [...current.slice(-(MAX_CHAT_MESSAGES - 1)), { role: 'assistant', text: 'I could not save that career profile change yet. Your dashboard is still usable, but refresh persistence needs the API online.' }]);
    } finally {
      setProfileBusy(false);
    }
  }

  function updateProfile(patch: Partial<StudentCareerProfile>) {
    void persistProfile({ ...profile, ...patch });
  }

  function toggleSavedCareer(careerId: string) {
    updateProfile({ savedCareers: toggleValue(profile.savedCareers, careerId) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessage('');
    // Keep chat bounded so long advice sessions do not grow memory without limit.
    const nextChat = [...chat, { role: 'user' as const, text: prompt }, { role: 'assistant' as const, text: '' }].slice(-MAX_CHAT_MESSAGES);
    setChat(nextChat);

    try {
      await streamCareersAssistant(prompt, chat, profile, (chunk) => {
        setChat((current) => current.map((item, index) => (
          index === current.length - 1 ? { ...item, text: `${item.text}${chunk}` } : item
        )).slice(-MAX_CHAT_MESSAGES));
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        setChat((current) => current.map((item, index) => (
          index === current.length - 1 ? { ...item, text: item.text || 'Stopped. Ask me to continue when you are ready.' } : item
        )));
      } else {
        const details = err instanceof Error ? err.message : '';
        setChat((current) => current.map((item, index) => (
          index === current.length - 1
            ? { ...item, text: `I cannot connect to Odie right now. ${details.includes('assistant_not_configured') || details.includes('groq_not_configured') ? 'Groq is not configured on the API server yet.' : 'Please check that the LMS API is running and try again shortly.'}` }
            : item
        )));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  return (
    <PageShell
      title="Career Discovery Cockpit"
      subtitle="Explore pathways, test subject fit, plan APS targets, and ask Odie only when career guidance needs a coach."
      section="student"
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <GreekHeroCard
            eyebrow="Odie Careers"
            title="Build a pathway that fits your subjects, marks, and ambition"
            description="Use the cockpit to compare careers, save serious options, map APS targets, and turn uncertainty into a practical next step."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-gold">Saved careers</p>
                <p className="mt-2 text-2xl font-semibold">{profile.savedCareers.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-gold">APS target</p>
                <p className="mt-2 text-2xl font-semibold">{profile.apsTarget ?? 'Set it'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-gold">Career map</p>
                <p className="mt-2 text-2xl font-semibold">{data?.institutions?.length || 0}</p>
              </div>
            </div>
          </GreekHeroCard>

          <StaggerGrid className="grid gap-4 md:grid-cols-3">
            <StaggerItem><MetricCard label="Career Explorer" value={String(data?.careers?.length || 0)} helper="Filter pathways by interests, subjects, and category." icon={Compass} tone="aegean" /></StaggerItem>
            <StaggerItem><MetricCard label="Subject Match" value={String(profile.preferredSubjects.length)} helper="Subjects saved into your career profile." icon={GraduationCap} tone="gold" /></StaggerItem>
            <StaggerItem><MetricCard label="Opportunity Map" value={String(data?.institutions?.length || 0)} helper="Institution options loaded from the careers dataset." icon={Target} tone="marble" /></StaggerItem>
          </StaggerGrid>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">Career Explorer</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">This is a decision cockpit, not a raw API list. Start broad, then save the careers worth investigating.</p>
              </div>
              <PremiumButton disabled={refetching} onClick={() => void reload()}>{refetching ? 'Refreshing...' : 'Refresh'}</PremiumButton>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <FormField label="Interest">
                <select className={inputClassName} value={filters.interest} onChange={(event) => setFilters((current) => ({ ...current, interest: event.target.value }))}>
                  <option value="">All interests</option>
                  {INTEREST_OPTIONS.map((interest) => <option key={interest} value={interest}>{interest}</option>)}
                </select>
              </FormField>
              <FormField label="Subject">
                <select className={inputClassName} value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}>
                  <option value="">All subjects</option>
                  {(data?.supportedSubjects || []).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </FormField>
              <FormField label="Career category">
                <select className={inputClassName} value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">All categories</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </FormField>
            </div>
            {loading ? <div className="mt-4"><SkeletonCard /></div> : null}
            {error ? <div className="mt-4"><ErrorState title="Careers unavailable" description={error} onRetry={() => void reload()} /></div> : null}
            <StaggerGrid className="mt-5 grid gap-3 lg:grid-cols-2">
              {filteredCareers.slice(0, 10).map((career) => (
                <StaggerItem key={career.id}>
                  <CareerCard career={career} saved={profile.savedCareers.includes(career.id)} onToggleSave={() => toggleSavedCareer(career.id)} />
                </StaggerItem>
              ))}
            </StaggerGrid>
            {data && !filteredCareers.length ? (
              <div className="mt-4">
                <EmptyState
                  title="No matching careers yet"
                  description="Clear one filter, try a broader interest, or save more subjects so the cockpit has more context."
                  actionLabel="Reset filters"
                  actionHref="/dashboard/student/careers"
                  icon={Compass}
                />
              </div>
            ) : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">Subject Match</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Save subjects you want Odie to consider when giving pathway advice.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(data?.supportedSubjects || []).slice(0, 14).map((subject) => (
                  <FilterChip key={subject} active={profile.preferredSubjects.includes(subject)} onClick={() => updateProfile({ preferredSubjects: toggleValue(profile.preferredSubjects, subject) })}>
                    {subject}
                  </FilterChip>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">APS Planner</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Set a target APS so career conversations stay anchored to admission planning.</p>
              <div className="mt-4 max-w-xs">
                <FormField label="Target APS">
                  <TextInput
                    type="number"
                    min={0}
                    max={60}
                    value={profile.apsTarget ?? ''}
                    onChange={(event) => updateProfile({ apsTarget: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Example: 34"
                  />
                </FormField>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-brand-marble">{profileBusy ? 'Saving profile...' : 'Saved profile context is used by Odie on Careers.'}</p>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">Opportunity Map</h2>
              <div className="mt-4 grid gap-3">
                {(data?.institutions || []).slice(0, 4).map((institution) => (
                  <InsightCard
                    key={institution.id}
                    title={institution.name}
                    description={`${institution.city} · ${(institution.institutionTypes || []).join(', ') || 'institution pathway'}`}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">Saved Careers</h2>
              <div className="mt-4 space-y-3">
                {savedCareers.map((career) => (
                  <InsightCard key={career.id} title={career.title} description={career.description || career.category || 'Saved for deeper planning.'} />
                ))}
                {!savedCareers.length ? (
                  <EmptyState
                    title="No saved careers yet"
                    description="Save careers from the explorer to build a shortlist you can compare with subjects, APS targets, and Odie advice."
                    actionLabel="Explore careers"
                    actionHref="/dashboard/student/careers"
                    icon={Sparkles}
                  />
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-brand-parchment">Ask Odie</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-brand-marble">Odie is only available on Careers, and focuses on subject choice, APS planning, study planning, and pathways.</p>
          <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto rounded-[1.5rem] border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
            {chat.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${item.role === 'assistant' ? 'border-white/70 bg-white/72 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment' : 'border-brand-navy bg-brand-navy text-white dark:border-brand-aegean dark:bg-brand-aegean'}`}>
                {item.text || (busy && index === chat.length - 1 ? 'Odie is thinking...' : '')}
              </div>
            ))}
          </div>
          <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
            <FormField label="Message">
              <TextArea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about a career pathway, APS target, or subject choice..." />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <PremiumButton type="submit" disabled={busy || !message.trim()}>{busy ? 'Streaming...' : 'Send'}</PremiumButton>
              {busy ? <PremiumButton type="button" variant="outline" onClick={stopGeneration}>Stop generation</PremiumButton> : null}
            </div>
          </form>
        </Card>
      </section>
    </PageShell>
  );
}
