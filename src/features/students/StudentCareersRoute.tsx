import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, X } from 'lucide-react';
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
import { createCareerProfileSaveQueue } from './careerProfileSaveQueue';
import {
  CareerSelectionState,
  CareerTargetControl,
} from './StudentPathwayBuilderComponents';
import {
  CareerCompass,
  CareerDetail,
  CareersHome,
  CareerWorlds,
} from './StudentCareersExperienceComponents';
import { StudentFuturePathway } from './StudentFuturePathway';
import { saveCareerProfile, type CareerProgramme, type StudentCareerProfile } from './studentCareersRepository';
import { useStudentCareersQuery, useStudentDashboardQuery, useStudentResultsQuery } from './studentQueries';

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
  const dashboardQuery = useStudentDashboardQuery();
  const resultsQuery = useStudentResultsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<StudentCareerProfile>(emptyProfile);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<{ message: string; failedProfile: StudentCareerProfile } | null>(null);
  const [odieOpen, setOdieOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Ask me to explain a saved career, subject evidence, an APS target, or what to verify on a programme source.' },
  ]);
  const abortRef = useRef<AbortController | null>(null);
  const confirmedProfileRef = useRef<StudentCareerProfile>(emptyProfile());
  const optimisticProfileRef = useRef<StudentCareerProfile>(emptyProfile());
  const profileSaveSequenceRef = useRef(0);
  const pendingProfileSavesRef = useRef(0);
  const enqueueProfileSaveRef = useRef(createCareerProfileSaveQueue());
  const online = useOnlineStatus();

  useEffect(() => {
    if (careersQuery.data?.profile && pendingProfileSavesRef.current === 0) {
      confirmedProfileRef.current = careersQuery.data.profile;
      optimisticProfileRef.current = careersQuery.data.profile;
      setProfile(careersQuery.data.profile);
    }
  }, [careersQuery.data?.profile]);

  useEffect(() => {
    if (window.location.hash === '#odie-career-assistant') setOdieOpen(true);
  }, []);

  const selectedCareerId = searchParams.get('career') ?? '';
  const requestedView = searchParams.get('view');
  const supportedViews = new Set(['home', 'compass', 'worlds', 'career', 'pathway']);
  // Existing shared links used only ?career=. Keep those links useful by
  // opening the established pathway, while all new navigation names its view.
  const view = requestedView && supportedViews.has(requestedView) ? requestedView : selectedCareerId ? 'pathway' : 'home';
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
    const saveSequence = ++profileSaveSequenceRef.current;
    if (!online) {
      optimisticProfileRef.current = confirmedProfileRef.current;
      setProfile(confirmedProfileRef.current);
      setProfileError({ message: 'You are offline, so that change was not saved. Reconnect and try again.', failedProfile: nextProfile });
      return;
    }
    optimisticProfileRef.current = nextProfile;
    setProfile(nextProfile);
    pendingProfileSavesRef.current += 1;
    setProfileBusy(true);
    setProfileError(null);
    try {
      // Serialize full-profile upserts so a slower older request can never land
      // after a newer edit and overwrite it in student_career_profiles.
      const response = await enqueueProfileSaveRef.current(() => saveCareerProfile(nextProfile));
      confirmedProfileRef.current = response.profile;
      if (saveSequence !== profileSaveSequenceRef.current) return;
      optimisticProfileRef.current = response.profile;
      setProfile(response.profile);
      await careersQuery.reload();
    } catch (error) {
      if (saveSequence !== profileSaveSequenceRef.current) return;
      optimisticProfileRef.current = confirmedProfileRef.current;
      setProfile(confirmedProfileRef.current);
      const code = error instanceof Error ? error.message : '';
      const message = code.includes('student_profile_missing')
        ? 'Your student profile could not be verified, so no Careers changes were saved.'
        : 'We could not save that Careers change. Your last confirmed profile is still safe.';
      setProfileError({ message, failedProfile: nextProfile });
    } finally {
      pendingProfileSavesRef.current = Math.max(0, pendingProfileSavesRef.current - 1);
      if (pendingProfileSavesRef.current === 0) setProfileBusy(false);
    }
  }

  function updateProfile(patch: Partial<StudentCareerProfile>) {
    void persistProfile({ ...optimisticProfileRef.current, ...patch });
  }

  function navigate(viewName: string, values: Record<string, string> = {}) {
    const next = new URLSearchParams(searchParams);
    next.set('view', viewName);
    for (const key of ['career', 'world', 'focus']) {
      const value = values[key];
      if (value) next.set(key, value); else next.delete(key);
    }
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function selectCareer(careerId: string) {
    navigate('pathway', careerId ? { career: careerId } : {});
    const currentTargets = optimisticProfileRef.current.targetCareers;
    if (careerId && !currentTargets.includes(careerId)) {
      updateProfile({ targetCareers: [careerId, ...currentTargets].slice(0, 6) });
    }
  }

  function openOdie(prompt?: string) {
    if (prompt) {
      setMessage(prompt);
    } else if (selectedCareer && !message.trim()) {
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
    <PageShell title="Careers" subtitle="Explore what you love, discover what you could become, and plan your next steps with Odie." section="student" identity={dashboardQuery.data ? { name: dashboardQuery.data.profile.name, meta: dashboardQuery.data.profile.grade || 'Student' } : undefined}>
      <section className="min-w-0 space-y-4">
        {!online ? <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="status">You are offline. Cached pathway information remains visible, but profile changes and Odie need a connection.</div> : null}
        {profileError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="alert"><span>{profileError.message}</span><button className="min-h-11 rounded-xl border border-current px-4 font-bold" disabled={profileBusy || !online} onClick={() => void persistProfile(profileError.failedProfile)} type="button">Retry save</button></div> : null}
        {careersQuery.loading ? <><SkeletonCard /><SkeletonCard /></> : null}
        {careersQuery.error && !careersQuery.data ? <ErrorState title="Careers is unavailable" description={careersQuery.error} onRetry={() => void careersQuery.reload()} /> : null}
        {!careersQuery.loading && careersQuery.data ? (
          <>
            {view === 'home' ? <CareersHome careers={careers} profile={profile} grade={dashboardQuery.data?.profile.grade} onNavigate={navigate} onToggleSave={(careerId) => updateProfile({ savedCareers: toggleValue(optimisticProfileRef.current.savedCareers, careerId) })} onAskOdie={openOdie} /> : null}
            {view === 'compass' ? <CareerCompass careers={careers} profile={profile} subjects={careersQuery.data.supportedSubjects ?? []} onSaveAnswers={(interests, preferredSubjects) => updateProfile({ interests, preferredSubjects })} onNavigate={navigate} onAskOdie={openOdie} /> : null}
            {view === 'worlds' ? <CareerWorlds careers={careers} selectedWorldId={searchParams.get('world') ?? ''} focusSearch={searchParams.get('focus') === 'search'} savedIds={profile.savedCareers} onNavigate={navigate} onToggleSave={(careerId) => updateProfile({ savedCareers: toggleValue(optimisticProfileRef.current.savedCareers, careerId) })} /> : null}
            {view === 'career' && selectedCareer ? <CareerDetail career={selectedCareer} careers={careers} programmes={programmes} saved={profile.savedCareers.includes(selectedCareer.id)} onNavigate={navigate} onToggleSave={() => updateProfile({ savedCareers: toggleValue(optimisticProfileRef.current.savedCareers, selectedCareer.id) })} onAskOdie={openOdie} /> : null}
            {view === 'pathway' ? <div className="space-y-4">
              <button className="min-h-11 text-sm font-bold text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold" onClick={() => selectedCareer ? navigate('career', { career: selectedCareer.id }) : navigate('home')} type="button"><ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />{selectedCareer ? 'Career overview' : 'Careers home'}</button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">My Future Plan</p><h2 className="mt-1 font-display text-3xl font-semibold text-academy-navy dark:text-white">Plan a way forward</h2><p className="mt-1 text-sm text-academy-muted">Explore one step at a time: subjects, study routes, requirements and practical next actions.</p></div><CareerTargetControl careers={careers} selectedId={selectedCareerId} onChange={selectCareer} /></div>
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
                ) : <StudentFuturePathway career={selectedCareer} grade={dashboardQuery.data?.profile.grade} eligibility={eligibility} aps={aps} targetAps={targetAps} targetBusy={profileBusy} relevantSubjects={relevantSubjects} improvementActions={improvementActions} onTargetChange={(value) => updateProfile({ apsTarget: normalizeApsTarget(value) })} onAskOdie={openOdie} />}
              </>
            ) : (
              <>
                {selectedCareerId ? <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100" role="alert">That career is not available in the current catalogue. Choose another target below.</div> : null}
                <CareerSelectionState careers={careers} savedIds={profile.savedCareers} onBuild={selectCareer} onToggleSave={(careerId) => updateProfile({ savedCareers: toggleValue(optimisticProfileRef.current.savedCareers, careerId) })} />
              </>
            )}</div> : null}
            {view === 'career' && !selectedCareer ? <ErrorState title="Career not found" description="That career is not available in the current catalogue." onRetry={() => navigate('worlds')} /> : null}
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
        <div aria-live="polite" className="mt-4 min-h-28 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-900" data-testid="odie-career-transcript">
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
