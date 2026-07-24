import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Compass, GraduationCap, MapPinned, MessageCircle, Send, Sparkles, Target, X } from 'lucide-react';
import { EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { FormField, TextArea, TextInput, inputClassName } from '../../components/ui/FormField';
import { streamSupabaseFunctionText } from '../../lib/supabase/edgeFunctions';
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
  return streamSupabaseFunctionText('odie-careers-chat-stream', {
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
      className={`academy-chip ${active ? 'bg-academy-gold text-academy-ink dark:text-academy-ink' : ''}`}
    >
      {children}
    </button>
  );
}

export function StudentCareersRoute() {
  const { data, loading, error, refetching, reload } = useStudentCareersQuery();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [odieOpen, setOdieOpen] = useState(false);
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

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === '#odie-career-assistant') {
        setOdieOpen(true);
      }
    }

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

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

  function updateFilters(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }));
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
            ? { ...item, text: `I cannot connect to Odie right now. ${details.includes('groq_not_configured') ? 'Odie is not configured yet.' : 'Please try again shortly.'}` }
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
      title="Career Discovery"
      subtitle="Explore pathways, test subject fit, plan APS targets, and ask Odie only when career guidance needs a coach."
      section="student"
    >
      <section className="space-y-6">
        <CareerHero
          savedCount={profile.savedCareers.length}
          apsTarget={profile.apsTarget}
          institutionCount={data?.institutions?.length || 0}
          onOpenOdie={() => setOdieOpen(true)}
        />
        <CareerExplorer
          categories={categories}
          careers={filteredCareers}
          filters={filters}
          profile={profile}
          supportedSubjects={data?.supportedSubjects || []}
          onFilterChange={updateFilters}
          onToggleSave={toggleSavedCareer}
          onRefresh={() => void reload()}
          loading={loading}
          error={error}
          refetching={refetching}
          onRetry={() => void reload()}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SubjectMatch
            subjects={data?.supportedSubjects || []}
            selectedSubjects={profile.preferredSubjects}
            onToggleSubject={(subject) => updateProfile({ preferredSubjects: toggleValue(profile.preferredSubjects, subject) })}
          />
          <APSPlanner
            apsTarget={profile.apsTarget}
            profileBusy={profileBusy}
            onChange={(apsTarget) => updateProfile({ apsTarget })}
          />
          <SavedCareers careers={savedCareers} />
        </div>
        <OpportunityMap institutions={data?.institutions || []} />
        <OdieCareerSheet
          open={odieOpen}
          chat={chat}
          message={message}
          busy={busy}
          onClose={() => setOdieOpen(false)}
          onMessageChange={setMessage}
          onSubmit={(event) => void submit(event)}
          onStop={stopGeneration}
        />
        <OdieCareerDrawer
          open={odieOpen}
          chat={chat}
          message={message}
          busy={busy}
          onClose={() => setOdieOpen(false)}
          onMessageChange={setMessage}
          onSubmit={(event) => void submit(event)}
          onStop={stopGeneration}
        />
      </section>
    </PageShell>
  );
}

export function CareerHero({
  savedCount,
  apsTarget,
  institutionCount,
  onOpenOdie,
}: {
  savedCount: number;
  apsTarget: number | null;
  institutionCount: number;
  onOpenOdie: () => void;
}) {
  return (
    <section className="academy-major-surface relative overflow-hidden">
      <div className="absolute inset-x-6 top-0 h-px greek-keyline" aria-hidden="true" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-academy-gold">Career discovery cockpit</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Build a pathway that fits your subjects and ambition
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-academy-parchment">
            Explore careers, save serious options, compare subject fit, plan APS, and ask Odie when pathway choices need coaching.
          </p>
          <button className="academy-btn academy-btn-gold mt-6" type="button" onClick={onOpenOdie}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Ask Odie
          </button>
        </div>
        <div className="grid gap-3">
          <HeroFact label="Saved" value={String(savedCount)} />
          <HeroFact label="APS target" value={apsTarget == null ? 'Set it' : String(apsTarget)} />
          <HeroFact label="Map" value={String(institutionCount)} />
        </div>
      </div>
    </section>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ios-lg border border-white/15 bg-white/10 p-4 shadow-academy-inset backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-gold">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function CareerExplorer({
  categories,
  careers,
  filters,
  profile,
  supportedSubjects,
  onFilterChange,
  onToggleSave,
  onRefresh,
  loading,
  error,
  refetching,
  onRetry,
}: {
  categories: string[];
  careers: CareerSummary[];
  filters: { interest: string; subject: string; category: string };
  profile: StudentCareerProfile;
  supportedSubjects: string[];
  onFilterChange: (patch: Partial<{ interest: string; subject: string; category: string }>) => void;
  onToggleSave: (careerId: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error?: string | null;
  refetching: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="space-y-4" aria-labelledby="career-explorer-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Career Explorer</p>
          <h2 id="career-explorer-title" className="mt-1 text-2xl font-semibold text-academy-ink dark:text-academy-parchment">Discovery list</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-academy-muted">Filter broad pathways, then save the options worth comparing with subjects and APS.</p>
        </div>
        <button className="academy-btn academy-btn-outline" disabled={refetching} type="button" onClick={onRefresh}>
          {refetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField label="Interest">
          <select className={inputClassName} value={filters.interest} onChange={(event) => onFilterChange({ interest: event.target.value })}>
            <option value="">All interests</option>
            {INTEREST_OPTIONS.map((interest) => <option key={interest} value={interest}>{interest}</option>)}
          </select>
        </FormField>
        <FormField label="Subject">
          <select className={inputClassName} value={filters.subject} onChange={(event) => onFilterChange({ subject: event.target.value })}>
            <option value="">All subjects</option>
            {supportedSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
        </FormField>
        <FormField label="Career category">
          <select className={inputClassName} value={filters.category} onChange={(event) => onFilterChange({ category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </FormField>
      </div>
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorState title="Careers unavailable" description={error} onRetry={onRetry} /> : null}
      <div className="divide-y divide-slate-950/5 rounded-ios-lg border border-white/70 bg-white/[0.48] px-4 shadow-academy-inset backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]">
        {careers.slice(0, 12).map((career) => (
          <CareerRow key={career.id} career={career} saved={profile.savedCareers.includes(career.id)} onToggleSave={() => onToggleSave(career.id)} />
        ))}
      </div>
      {!loading && !careers.length ? (
        <EmptyState
          title="No matching careers yet"
          description="Clear one filter, try a broader interest, or save more subjects so the cockpit has more context."
          actionLabel="Reset filters"
          actionHref="/dashboard/student/careers"
          icon={Compass}
        />
      ) : null}
    </section>
  );
}

export function CareerRow({ career, saved, onToggleSave }: { career: CareerSummary; saved: boolean; onToggleSave: () => void }) {
  const metrics = latestCareerMetric(career);
  return (
    <article className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">{career.category || 'Pathway'}</p>
          <h3 className="mt-1 text-lg font-semibold text-academy-ink dark:text-academy-parchment">{career.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-academy-muted">{career.description || 'Explore this pathway and compare subject fit before choosing a next step.'}</p>
        </div>
        <button className={`academy-btn min-h-10 shrink-0 px-4 ${saved ? 'academy-btn-gold' : 'academy-btn-outline'}`} type="button" onClick={onToggleSave}>
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {metrics ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-academy-muted">
          {metrics.salary ? <span className="academy-chip min-h-8">{metrics.salary}</span> : null}
          {metrics.growth ? <span className="academy-chip min-h-8">Growth: {metrics.growth}</span> : null}
          {metrics.demand ? <span className="academy-chip min-h-8">Demand: {metrics.demand}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export function SubjectMatch({ subjects, selectedSubjects, onToggleSubject }: { subjects: string[]; selectedSubjects: string[]; onToggleSubject: (subject: string) => void }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Subject Match</p>
      <h2 className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Subjects Odie should consider</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {subjects.slice(0, 14).map((subject) => (
          <FilterChip key={subject} active={selectedSubjects.includes(subject)} onClick={() => onToggleSubject(subject)}>
            {subject}
          </FilterChip>
        ))}
      </div>
    </section>
  );
}

export function APSPlanner({ apsTarget, profileBusy, onChange }: { apsTarget: number | null; profileBusy: boolean; onChange: (value: number | null) => void }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">APS Planner</p>
      <h2 className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Set a target APS</h2>
      <div className="mt-4 max-w-xs">
        <FormField label="Target APS">
          <TextInput type="number" min={0} max={60} value={apsTarget ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} placeholder="Example: 34" />
        </FormField>
      </div>
      <p className="mt-3 text-xs text-academy-muted">{profileBusy ? 'Saving profile...' : 'Saved profile context is used by Odie on Careers.'}</p>
    </section>
  );
}

function SavedCareers({ careers }: { careers: CareerSummary[] }) {
  return (
    <section className="rounded-ios-lg border border-white/70 bg-white/[0.48] p-5 shadow-academy-inset backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Saved Careers</p>
      <h2 className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Shortlist</h2>
      <div className="mt-4 space-y-3">
        {careers.map((career) => (
          <div key={career.id} className="academy-row">
            <Sparkles className="h-4 w-4 shrink-0 text-academy-gold" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-academy-ink dark:text-academy-parchment">{career.title}</p>
              <p className="truncate text-xs text-academy-muted">{career.category || 'Saved pathway'}</p>
            </div>
          </div>
        ))}
        {!careers.length ? (
          <EmptyState title="No saved careers yet" description="Save careers from the explorer to build a shortlist you can compare with subjects, APS targets, and Odie advice." actionLabel="Explore careers" actionHref="/dashboard/student/careers" icon={Sparkles} />
        ) : null}
      </div>
    </section>
  );
}

function OpportunityMap({ institutions }: { institutions: Array<{ id: string; name: string; city: string; institutionTypes?: string[] }> }) {
  return (
    <section className="space-y-3" aria-labelledby="opportunity-map-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Opportunity Map</p>
        <h2 id="opportunity-map-title" className="mt-1 text-2xl font-semibold text-academy-ink dark:text-academy-parchment">Institution signals</h2>
      </div>
      <div className="divide-y divide-slate-950/5 rounded-ios-lg border border-white/70 bg-white/[0.48] px-4 shadow-academy-inset backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]">
        {institutions.slice(0, 5).map((institution) => (
          <div key={institution.id} className="academy-row">
            <MapPinned className="h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-academy-ink dark:text-academy-parchment">{institution.name}</p>
              <p className="truncate text-xs text-academy-muted">{institution.city} - {(institution.institutionTypes || []).join(', ') || 'institution pathway'}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OdieCareerSheet(props: OdieCareerSurfaceProps) {
  return (
    <div
      aria-hidden={!props.open}
      aria-label="Odie career assistant"
      aria-modal={props.open}
      className={`fixed inset-x-0 bottom-0 z-50 rounded-t-sheet border border-white/70 bg-white/[0.92] p-4 shadow-[0_-20px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl transition duration-sheet ease-ios dark:border-white/10 dark:bg-slate-950/[0.92] lg:hidden ${props.open ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
      id="odie-career-assistant"
      role="dialog"
    >
      <OdieCareerPanel {...props} />
    </div>
  );
}

export function OdieCareerDrawer(props: OdieCareerSurfaceProps) {
  return (
    <aside
      aria-hidden={!props.open}
      aria-label="Odie career assistant"
      aria-modal={props.open}
      className={`fixed bottom-6 right-6 top-6 z-50 hidden w-[26rem] rounded-sheet border border-white/70 bg-white/[0.9] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl transition duration-sheet ease-ios dark:border-white/10 dark:bg-slate-950/[0.9] lg:block ${props.open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-8 opacity-0'}`}
      role="dialog"
    >
      <OdieCareerPanel {...props} />
    </aside>
  );
}

type OdieCareerSurfaceProps = {
  open: boolean;
  chat: ChatMessage[];
  message: string;
  busy: boolean;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
};

function OdieCareerPanel({ chat, message, busy, onClose, onMessageChange, onSubmit, onStop }: OdieCareerSurfaceProps) {
  return (
    <div className="flex max-h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Ask Odie</p>
          <h2 className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Career guidance only</h2>
          <p className="mt-1 text-sm leading-6 text-academy-muted">Subject choice, APS planning, study planning, and pathways.</p>
        </div>
        <button aria-label="Close Odie" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.08]" type="button" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-ios-lg border border-white/70 bg-white/[0.55] p-4 shadow-academy-inset dark:border-white/10 dark:bg-white/[0.04]">
        {chat.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`rounded-ios border px-4 py-3 text-sm leading-6 shadow-sm ${item.role === 'assistant' ? 'border-white/70 bg-white/[0.72] text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-parchment' : 'border-brand-navy bg-brand-navy text-white dark:border-brand-aegean dark:bg-brand-aegean'}`}>
            {item.text || (busy && index === chat.length - 1 ? 'Odie is thinking...' : '')}
          </div>
        ))}
      </div>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <FormField label="Message">
          <TextArea value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Ask about a career pathway, APS target, or subject choice..." />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <button className="academy-btn academy-btn-primary" type="submit" disabled={busy || !message.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Streaming...' : 'Send'}
          </button>
          {busy ? <button className="academy-btn academy-btn-outline" type="button" onClick={onStop}>Stop generation</button> : null}
        </div>
      </form>
    </div>
  );
}
