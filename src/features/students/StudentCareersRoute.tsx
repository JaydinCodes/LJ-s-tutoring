import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { FormField, TextArea } from '../../components/ui/FormField';
import { useModalDialog } from '../../hooks/useModalDialog';
import { streamSupabaseFunctionText } from '../../lib/supabase/edgeFunctions';
import {
  calculateGuidanceAps,
  careerProgrammes,
  classifyProgramme,
  deriveImprovementActions,
  normalizeApsTarget,
  programmeRequirements,
  type SubjectEvidence,
} from './careerPathway';
import {
  AlternativeRoutes,
  ApsSummaryPanel,
  CareerSelectionState,
  CareerTargetControl,
  ImprovementPanel,
  OdiePathwayCallout,
  PathwayJourney,
  ProgrammeComparison,
} from './StudentPathwayBuilderComponents';
import { saveCareerProfile, type CareerProgramme, type StudentCareerProfile } from './studentCareersRepository';
import { useStudentCareersQuery, useStudentResultsQuery } from './studentQueries';

const MAX_CHAT_MESSAGES = 12;
type ChatMessage = { role: 'user' | 'assistant'; text: string };

function emptyProfile(): StudentCareerProfile {
  return { interests: [], preferredSubjects: [], targetCareers: [], apsTarget: null, savedCareers: [] };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function normalizeSubject(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function relevantSubjectEvidence(programmes: CareerProgramme[], subjects: SubjectEvidence[], preferredSubjects: string[]) {
  const requested = new Set([
    ...preferredSubjects.map(normalizeSubject),
    ...programmes.flatMap((programme) => programmeRequirements(programme).flatMap((requirement) => requirement.acceptedSubjects.map(normalizeSubject))),
  ]);
  const matched = subjects.filter((subject) => requested.has(normalizeSubject(subject.subject)));
  return (matched.length ? matched : subjects).sort((left, right) => Number(right.score ?? -1) - Number(left.score ?? -1));
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
      'The learner is using the Project Odysseus Careers Pathway Builder.',
      `Saved interests: ${profile.interests.join(', ') || 'none yet'}.`,
      `Preferred subjects: ${profile.preferredSubjects.join(', ') || 'none yet'}.`,
      `Saved careers: ${profile.savedCareers.join(', ') || 'none yet'}.`,
      profile.apsTarget != null ? `APS target: ${profile.apsTarget}.` : 'APS target: not set.',
      `Learner question: ${message}`,
    ].join('\n'),
    history: history.filter((item) => item.text.trim()).slice(-8).map((item) => ({ role: item.role, content: item.text })),
  }, onChunk, signal);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export function StudentCareersRoute() {
  const careersQuery = useStudentCareersQuery();
  const resultsQuery = useStudentResultsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<StudentCareerProfile>(emptyProfile);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [odieOpen, setOdieOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Ask me to explain a saved career, subject evidence, an APS target, or what to verify on a programme source.' },
  ]);
  const abortRef = useRef<AbortController | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    if (careersQuery.data?.profile) setProfile(careersQuery.data.profile);
  }, [careersQuery.data?.profile]);

  useEffect(() => {
    if (window.location.hash === '#odie-career-assistant') setOdieOpen(true);
  }, []);

  const selectedCareerId = searchParams.get('career') ?? '';
  const careers = careersQuery.data?.careers ?? [];
  const selectedCareer = careers.find((career) => career.id === selectedCareerId) ?? null;
  const programmes = useMemo(
    () => selectedCareer ? careerProgrammes(careersQuery.data?.programmes ?? [], selectedCareer.id) : [],
    [careersQuery.data?.programmes, selectedCareer],
  );
  const subjectEvidence = useMemo<SubjectEvidence[]>(
    () => (resultsQuery.data?.subjectBreakdown ?? []).map((subject) => ({ subject: subject.subject, score: subject.score, assessments: subject.assessments })),
    [resultsQuery.data?.subjectBreakdown],
  );
  const aps = useMemo(() => calculateGuidanceAps(subjectEvidence), [subjectEvidence]);
  const targetAps = normalizeApsTarget(profile.apsTarget);
  const relevantSubjects = useMemo(
    () => relevantSubjectEvidence(programmes, subjectEvidence, profile.preferredSubjects),
    [programmes, profile.preferredSubjects, subjectEvidence],
  );
  const eligibility = useMemo(
    () => programmes.map((programme) => classifyProgramme(programme, aps, subjectEvidence)),
    [aps, programmes, subjectEvidence],
  );
  const improvementActions = useMemo(
    () => selectedCareer ? deriveImprovementActions(selectedCareer, eligibility, aps, targetAps) : [],
    [aps, eligibility, selectedCareer, targetAps],
  );

  async function persistProfile(nextProfile: StudentCareerProfile) {
    setProfile(nextProfile);
    setProfileBusy(true);
    setProfileError(null);
    try {
      const response = await saveCareerProfile(nextProfile);
      setProfile(response.profile);
      await careersQuery.reload();
    } catch {
      setProfileError('That Careers profile change is saved on this screen only. Reconnect and try again to keep it after refresh.');
    } finally {
      setProfileBusy(false);
    }
  }

  function updateProfile(patch: Partial<StudentCareerProfile>) {
    void persistProfile({ ...profile, ...patch });
  }

  function selectCareer(careerId: string) {
    const next = new URLSearchParams(searchParams);
    if (careerId) next.set('career', careerId); else next.delete('career');
    setSearchParams(next);
    if (careerId && !profile.targetCareers.includes(careerId)) {
      updateProfile({ targetCareers: [careerId, ...profile.targetCareers].slice(0, 6) });
    }
  }

  function openOdie() {
    if (selectedCareer && !message.trim()) {
      setMessage(`Please explain my pathway to ${selectedCareer.title}. What do my saved subjects and APS target show, and which programme requirements should I verify?`);
    }
    setOdieOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt || !online) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessage('');
    setChat([...chat, { role: 'user' as const, text: prompt }, { role: 'assistant' as const, text: '' }].slice(-MAX_CHAT_MESSAGES));
    try {
      await streamCareersAssistant(prompt, chat, profile, (chunk) => {
        setChat((current) => current.map((item, index) => index === current.length - 1 ? { ...item, text: `${item.text}${chunk}` } : item).slice(-MAX_CHAT_MESSAGES));
      }, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        setChat((current) => current.map((item, index) => index === current.length - 1 ? { ...item, text: item.text || 'Stopped. Your draft stays here until you decide what to ask next.' } : item));
      } else {
        const details = error instanceof Error ? error.message : '';
        setChat((current) => current.map((item, index) => index === current.length - 1 ? { ...item, text: `I cannot connect to Odie right now. ${details.includes('groq_not_configured') ? 'Odie is not configured yet.' : 'Please check your connection and try again.'}` } : item));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <PageShell title="Pathway Builder" subtitle="Turn a career idea into subjects, APS targets and realistic study routes." section="student">
      <section className="min-w-0 space-y-4">
        {!online ? <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="status">You are offline. Cached pathway information remains visible, but profile changes and Odie need a connection.</div> : null}
        {profileError ? <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="alert">{profileError}</div> : null}
        {careersQuery.loading ? <><SkeletonCard /><SkeletonCard /></> : null}
        {careersQuery.error && !careersQuery.data ? <ErrorState title="Pathway Builder is unavailable" description={careersQuery.error} onRetry={() => void careersQuery.reload()} /> : null}
        {!careersQuery.loading && careersQuery.data ? (
          <>
            <CareerTargetControl careers={careers} selectedId={selectedCareerId} onChange={selectCareer} />
            {selectedCareer ? (
              <>
                {resultsQuery.error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-100" role="alert">Learner results could not be loaded. Eligibility stays in a missing-results state rather than treating the missing data as failure. <button className="ml-2 min-h-11 font-bold underline" onClick={() => void resultsQuery.reload()} type="button">Try again</button></div> : null}
                {resultsQuery.loading ? (
                  <section aria-busy="true" aria-label="Loading pathway evidence" className="rounded-[1.35rem] border border-white/10 bg-academy-navy p-6 text-white shadow-[0_18px_42px_rgba(7,19,38,0.2)]">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Your pathway</p>
                    <div className="mt-4 h-8 w-64 max-w-full animate-pulse rounded-xl bg-white/15 motion-reduce:animate-none" />
                    <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" /><div className="h-20 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" /><div className="h-20 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" /></div>
                    <p className="sr-only" role="status">Loading released results and pathway evidence</p>
                  </section>
                ) : <ApsSummaryPanel aps={aps} career={selectedCareer} relevantSubjects={relevantSubjects} targetAps={targetAps} targetBusy={profileBusy} onTargetChange={(value) => updateProfile({ apsTarget: normalizeApsTarget(value) })} />}
                {!resultsQuery.loading ? <PathwayJourney careerTitle={selectedCareer.title} hasResults={aps.enoughResults} hasProgrammes={programmes.length > 0} /> : null}
                {resultsQuery.loading ? <SkeletonCard /> : (
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.85fr)] xl:items-start">
                    <ProgrammeComparison results={eligibility} />
                    <aside className="min-w-0 space-y-4">
                      <ImprovementPanel actions={improvementActions} />
                      <AlternativeRoutes career={selectedCareer} />
                      <OdiePathwayCallout onOpen={openOdie} />
                    </aside>
                  </div>
                )}
              </>
            ) : (
              <>
                {selectedCareerId ? <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="alert">That career is not available in the current catalogue. Choose another target below.</div> : null}
                <CareerSelectionState careers={careers} savedIds={profile.savedCareers} onBuild={selectCareer} onToggleSave={(careerId) => updateProfile({ savedCareers: toggleValue(profile.savedCareers, careerId) })} />
              </>
            )}
          </>
        ) : null}
        <OdieCareerDialog
          open={odieOpen}
          chat={chat}
          message={message}
          busy={busy}
          online={online}
          onClose={() => { abortRef.current?.abort(); setOdieOpen(false); }}
          onMessageChange={setMessage}
          onSubmit={(event) => void submit(event)}
          onStop={() => abortRef.current?.abort()}
        />
      </section>
    </PageShell>
  );
}

type OdieCareerDialogProps = {
  open: boolean;
  chat: ChatMessage[];
  message: string;
  busy: boolean;
  online: boolean;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
};

export function OdieCareerDialog({ open, chat, message, busy, online, onClose, onMessageChange, onSubmit, onStop }: OdieCareerDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog({ dialogRef, onClose, open });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 p-0 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div
        aria-hidden={!open}
        aria-label="Odie career assistant"
        aria-modal="true"
        className="flex max-h-[min(92vh,46rem)] w-full flex-col rounded-t-[1.5rem] border border-white/10 bg-[#fffdf8] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.3)] dark:bg-slate-950 sm:max-w-2xl sm:rounded-[1.5rem] sm:p-5"
        id="odie-career-assistant"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">Ask Odie</p><h2 className="mt-1 font-display text-2xl font-semibold text-academy-navy dark:text-white">Explain this pathway</h2><p className="mt-1 text-sm leading-6 text-academy-muted">Review and edit the prompt below. Nothing is sent automatically.</p></div>
          <button aria-label="Close Odie" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#ded5c6] focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/15" data-modal-initial-focus type="button" onClick={onClose}><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div aria-live="polite" className="mt-4 min-h-28 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          {chat.map((item, index) => <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'assistant' ? 'bg-slate-100 text-slate-700 dark:bg-white/[0.07] dark:text-slate-200' : 'ml-auto max-w-[90%] bg-academy-navy text-white'}`} key={`${item.role}-${index}`}>{item.text || (busy && index === chat.length - 1 ? 'Odie is thinking…' : '')}</div>)}
        </div>
        {!online ? <p className="mt-3 text-sm font-semibold text-amber-800 dark:text-amber-200" role="status">Odie is unavailable while you are offline. Your draft remains editable.</p> : null}
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <FormField label="Message"><TextArea value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Ask about this career, APS target, or a programme requirement…" /></FormField>
          <div className="flex flex-wrap gap-2"><button className="academy-btn academy-btn-gold min-h-11" type="submit" disabled={busy || !message.trim() || !online}><Send className="h-4 w-4" aria-hidden="true" />{busy ? 'Streaming…' : 'Send to Odie'}</button>{busy ? <button className="academy-btn academy-btn-outline min-h-11" type="button" onClick={onStop}>Stop generation</button> : null}</div>
        </form>
      </div>
    </div>
  );
}
