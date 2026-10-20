import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BriefcaseBusiness, Check, ChevronRight, Compass, GraduationCap, Lightbulb, MessageCircle, Search, Sparkles } from 'lucide-react';
import { EmptyState } from '../../components/dashboard/DashboardDesignSystem';
import { TextInput } from '../../components/ui/FormField';
import { availableCareerWorlds, careersInWorld, matchCareers, type CareerWorld } from './careerDiscovery';
import { programmeRequirements } from './careerPathway';
import type { CareerProgramme, CareerSummary, StudentCareerProfile } from './studentCareersRepository';

const surface = 'rounded-[1.35rem] border border-[#ded5c6] bg-[#fffdf8] shadow-[0_10px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900';
const hero = 'relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-academy-navy text-white shadow-[0_18px_44px_rgba(7,19,38,0.22)]';
const worldVisuals: Record<string, string> = {
  technology: 'from-sky-100 via-blue-50 to-indigo-100 text-sky-800 dark:from-sky-950 dark:via-blue-950 dark:to-indigo-950 dark:text-sky-200',
  'health-science': 'from-emerald-100 via-teal-50 to-cyan-100 text-emerald-800 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950 dark:text-emerald-200',
  engineering: 'from-cyan-100 via-slate-50 to-blue-100 text-cyan-800 dark:from-cyan-950 dark:via-slate-900 dark:to-blue-950 dark:text-cyan-200',
  business: 'from-amber-100 via-yellow-50 to-orange-100 text-amber-900 dark:from-amber-950 dark:via-yellow-950 dark:to-orange-950 dark:text-amber-100',
  'creative-arts': 'from-pink-100 via-rose-50 to-fuchsia-100 text-pink-800 dark:from-pink-950 dark:via-rose-950 dark:to-fuchsia-950 dark:text-pink-200',
  education: 'from-teal-100 via-emerald-50 to-lime-100 text-teal-800 dark:from-teal-950 dark:via-emerald-950 dark:to-lime-950 dark:text-teal-200',
  'public-service': 'from-violet-100 via-purple-50 to-indigo-100 text-violet-800 dark:from-violet-950 dark:via-purple-950 dark:to-indigo-950 dark:text-violet-200',
};

function OdieImage({ className = '' }: { className?: string }) {
  return <img alt="Odie, the Project Odysseus mascot" className={`object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.3)] ${className}`} src="/images/dashboard/odie-pathway-mascot.png" />;
}

export function CareersHome({ careers, profile, grade, onNavigate, onToggleSave, onAskOdie }: {
  careers: CareerSummary[];
  profile: StudentCareerProfile;
  grade?: string;
  onNavigate: (view: string, values?: Record<string, string>) => void;
  onToggleSave: (id: string) => void;
  onAskOdie: (prompt?: string) => void;
}) {
  const worlds = availableCareerWorlds(careers);
  const saved = profile.savedCareers.map((id) => careers.find((career) => career.id === id)).filter((career): career is CareerSummary => Boolean(career));
  return <div className="space-y-5">
    <section className={`${hero} p-4 sm:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center`}>
      <div className="relative z-10 max-w-2xl sm:pb-40 lg:pb-0">
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-2 sm:block">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-academy-gold">Careers explorer</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-[0.95] sm:text-5xl">Let’s explore your future together.</h2></div>
          <OdieImage className="h-28 w-full sm:hidden" />
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">I’m Odie. I’ll help you explore what you love, discover what you could become, and plan your next steps.</p>
        <p className="mt-3 max-w-xl text-xs font-semibold leading-5 text-academy-gold">{gradeMessage(grade)}</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <button className="academy-btn academy-btn-gold min-h-12 px-3 text-center sm:justify-between sm:px-5" onClick={() => onNavigate('compass')} type="button"><Compass className="hidden h-5 w-5 sm:block" aria-hidden="true" />Discover with Odie <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden="true" /></button>
          <button className="academy-btn min-h-12 px-3 text-center border border-white/20 bg-white text-academy-navy hover:bg-slate-100 sm:justify-between sm:px-5" onClick={() => onNavigate('worlds', { focus: 'search' })} type="button"><Search className="hidden h-5 w-5 sm:block" aria-hidden="true" />Browse careers</button>
        </div>
      </div>
      <OdieImage className="absolute -bottom-7 right-0 hidden h-64 w-64 sm:block sm:right-8 lg:static lg:h-80 lg:w-full" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" aria-hidden="true" />
    </section>

    <SectionHeading title="Explore career worlds" detail="Browse broad career areas drawn from the current catalogue." action="See all" onAction={() => onNavigate('worlds')} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {worlds.map((world) => <CareerWorldCard careers={careers} key={world.id} onOpen={() => onNavigate('worlds', { world: world.id })} world={world} />)}
    </div>

    <section className={`${surface} p-5 sm:p-6`} aria-labelledby="saved-careers-title">
      <SectionHeading compact title="Your saved careers" detail="Continue exploring careers you want to remember." />
      {saved.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{saved.map((career) => <CareerRow career={career} key={career.id} onOpen={() => onNavigate('career', { career: career.id })} onToggleSave={() => onToggleSave(career.id)} saved />)}</div> : <div className="mt-4 rounded-2xl bg-academy-parchment p-4 dark:bg-white/[0.05]"><p className="font-semibold text-academy-navy dark:text-white">Your shortlist starts here.</p><p className="mt-1 text-sm leading-6 text-academy-muted">Save careers as you explore so you can compare their subjects and study routes later.</p></div>}
    </section>

    <section className={`${surface} overflow-hidden`} aria-labelledby="odie-starters-title">
      <div className="grid sm:grid-cols-[10rem_minmax(0,1fr)]"><div className="flex items-end justify-center bg-academy-navy px-3 pt-4"><OdieImage className="h-32 w-32 sm:h-40 sm:w-40" /></div><div className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-academy-gold/20 text-academy-navy"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="odie-starters-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Explore an idea with Odie</h2><p className="text-sm text-academy-muted">Pick a starting point, edit it in the assistant, then choose whether to send.</p></div></div>{profile.interests.length ? <div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-academy-muted">What you’ve told Odie</p><div className="mt-2 flex flex-wrap gap-2">{profile.interests.map((interest) => <span className="rounded-full bg-academy-parchment px-3 py-1.5 text-xs font-semibold text-academy-navy dark:bg-white/[0.06] dark:text-white" key={interest}>{interest}</span>)}</div></div> : null}<div className="mt-4 grid gap-2 sm:grid-cols-2">{['What does a software developer actually do?', 'What subjects should I consider for engineering?', 'What can I study after Grade 12?', "What if I don't qualify for my first choice?"].map((prompt) => <button className="flex min-h-12 items-center gap-2 rounded-xl border border-[#ded5c6] bg-white px-4 text-left text-sm font-semibold text-academy-navy hover:border-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/10 dark:bg-slate-950 dark:text-white" key={prompt} onClick={() => onAskOdie(prompt)} type="button"><Lightbulb className="h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />{prompt}</button>)}</div></div></div>
    </section>
  </div>;
}

function gradeMessage(grade?: string) {
  const match = grade?.match(/(\d{1,2})/);
  const value = match ? Number(match[1]) : null;
  if (value != null && value <= 9) return 'Start with discovery and early subject awareness—you can still explore every route.';
  if (value === 10 || value === 11) return 'Explore subject choices, study routes and the entry requirements worth planning for.';
  if (value === 12) return 'Compare your available results with programme evidence and verify application requirements.';
  return 'Explore careers first, then open subjects and study routes whenever they become useful.';
}

function SectionHeading({ title, detail, action, onAction, compact = false }: { title: string; detail: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return <div className="flex items-end justify-between gap-4"><div><h2 className={`font-display font-semibold text-academy-navy dark:text-white ${compact ? 'text-2xl' : 'text-3xl'}`}>{title}</h2><p className="mt-1 text-sm leading-6 text-academy-muted">{detail}</p></div>{action && onAction ? <button className="min-h-11 shrink-0 text-sm font-bold text-academy-aegean underline-offset-4 hover:underline dark:text-academy-gold" onClick={onAction} type="button">{action} <ArrowRight className="inline h-4 w-4" aria-hidden="true" /></button> : null}</div>;
}

function CareerWorldCard({ world, careers, onOpen }: { world: CareerWorld; careers: CareerSummary[]; onOpen: () => void }) {
  const Icon = world.icon;
  const matches = careersInWorld(careers, world);
  const count = matches.length;
  return <button className={`${surface} group min-h-52 overflow-hidden text-left transition-transform motion-safe:hover:-translate-y-1`} onClick={onOpen} type="button"><span className={`relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br ${worldVisuals[world.id]}`}><span className="absolute -right-5 -top-7 h-24 w-24 rounded-full border-[14px] border-current opacity-10" aria-hidden="true" /><Icon className="h-12 w-12" aria-hidden="true" strokeWidth={1.7} /></span><span className="block p-4"><strong className="block font-display text-xl text-academy-navy dark:text-white">{world.title}</strong><span className="mt-1 block text-xs leading-5 text-academy-muted">{world.description}</span><span className="mt-2 block truncate text-[0.68rem] text-academy-muted">{matches.slice(0, 2).map((career) => career.title).join(' · ')}</span><span className="mt-3 flex items-center justify-between text-xs font-bold text-academy-aegean dark:text-academy-gold">{count} career{count === 1 ? '' : 's'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></span></span></button>;
}

export function CareerCompass({ careers, profile, subjects, onSaveAnswers, onNavigate, onAskOdie }: {
  careers: CareerSummary[]; profile: StudentCareerProfile; subjects: string[];
  onSaveAnswers: (interests: string[], subjects: string[]) => void;
  onNavigate: (view: string, values?: Record<string, string>) => void;
  onAskOdie: (prompt?: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState(profile.interests);
  const [preferredSubjects, setPreferredSubjects] = useState(profile.preferredSubjects);
  const questions = [
    { title: 'What kinds of activities do you enjoy?', options: ['Solving problems', 'Helping people', 'Designing and creating', 'Working with technology', 'Understanding science', 'Organising and leading', 'Not sure yet'], values: interests, setValues: setInterests },
    { title: 'Which subjects would you like to use more?', options: subjects, values: preferredSubjects, setValues: setPreferredSubjects },
  ];
  const matches = useMemo(() => matchCareers(careers, interests.filter((item) => item !== 'Not sure yet'), preferredSubjects), [careers, interests, preferredSubjects]);
  const selectedChoices = [...new Set([...interests.filter((item) => item !== 'Not sure yet'), ...preferredSubjects])];
  if (step >= questions.length) return <div className="space-y-5"><CompassHero title="Ideas to explore" detail="These are catalogue matches based only on what you selected—not a prediction of what you should become." /><section className={`${surface} p-5 sm:p-6`}><div className="mb-5 flex flex-col gap-4 rounded-2xl bg-academy-navy p-4 text-white sm:flex-row sm:items-center"><OdieImage className="mx-auto h-24 w-24 shrink-0 sm:mx-0" /><div><h2 className="font-display text-xl font-semibold">You selected</h2><p className="mt-1 text-xs leading-5 text-slate-300">Odie matched these choices against words and categories in the current catalogue.</p><div className="mt-3 flex flex-wrap gap-2">{selectedChoices.map((item) => <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs" key={item}>{item}</span>)}</div></div></div><SectionHeading title="Your career ideas" detail="Each description comes from the catalogue so you can see how the careers differ." /><div className="mt-5 grid gap-3 md:grid-cols-2">{matches.slice(0, 6).map((match) => <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={match.career.id}><p className="text-xs font-bold uppercase tracking-[0.14em] text-academy-aegean dark:text-academy-gold">{match.career.category}</p><h3 className="mt-2 font-display text-xl font-semibold text-academy-navy dark:text-white">{match.career.title}</h3><p className="mt-3 text-sm leading-6 text-academy-muted">{match.reasons[0]}</p><button className="academy-btn academy-btn-gold mt-4 min-h-11" onClick={() => onNavigate('career', { career: match.career.id })} type="button">Explore career <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></article>)}</div>{!matches.length ? <EmptyState title="No strong text matches yet" description="That is completely fine. Browse every career world or ask Odie a question instead." actionLabel="Explore all careers" actionHref="/dashboard/student/careers?view=worlds" icon={Compass} /> : null}<div className="mt-5 flex flex-wrap gap-3"><button className="academy-btn academy-btn-outline min-h-11" onClick={() => setStep(0)} type="button"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Change answers</button><button className="academy-btn academy-btn-outline min-h-11" onClick={() => onAskOdie('Help me understand these career ideas without assuming they determine what I should become.')} type="button"><MessageCircle className="h-4 w-4" aria-hidden="true" />Discuss with Odie</button></div></section></div>;
  const question = questions[step];
  const toggle = (value: string) => {
    if (value === 'Not sure yet') {
      question.setValues(question.values.includes(value) ? [] : [value]);
      return;
    }
    question.setValues(question.values.includes(value) ? question.values.filter((item) => item !== value) : [...question.values.filter((item) => item !== 'Not sure yet'), value]);
  };
  const advance = () => {
    // Persist the complete draft at every transition. This keeps earlier answers
    // when the learner skips the final question or returns to edit them.
    onSaveAnswers(interests, preferredSubjects);
    setStep(step + 1);
  };
  return <div className="space-y-5"><CompassHero title="Odie’s Career Compass" detail="A short, optional way to discover career ideas. Skip anything you do not want to answer." /><section className={`${surface} mx-auto max-w-3xl p-5 sm:p-8`}><div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-academy-muted"><span>Question {step + 1} of {questions.length}</span><button className="min-h-11 px-2 text-academy-aegean dark:text-academy-gold" onClick={advance} type="button">Skip this question</button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-academy-gold" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><h2 className="mt-6 font-display text-3xl font-semibold text-academy-navy dark:text-white">{question.title}</h2><p className="mt-2 text-sm text-academy-muted">Choose as many as you like. There are no right answers.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{question.options.map((option) => { const selected = question.values.includes(option); return <button aria-pressed={selected} className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-academy-gold ${selected ? 'border-academy-aegean bg-academy-aegean text-white' : 'border-[#ded5c6] bg-white text-academy-navy dark:border-white/10 dark:bg-slate-950 dark:text-white'}`} key={option} onClick={() => toggle(option)} type="button">{option}{selected ? <Check className="h-5 w-5" aria-hidden="true" /> : null}</button>; })}</div><div className="mt-7 flex justify-between gap-3"><button className="academy-btn academy-btn-outline min-h-11" disabled={step === 0} onClick={() => setStep(step - 1)} type="button"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</button><button className="academy-btn academy-btn-gold min-h-11" onClick={advance} type="button">{step === questions.length - 1 ? 'See career ideas' : 'Continue'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div></section></div>;
}

function CompassHero({ title, detail }: { title: string; detail: string }) {
  return <section className={`${hero} grid min-h-64 grid-cols-[minmax(0,1fr)_8rem] items-center p-5 sm:grid-cols-[minmax(0,1fr)_15rem] sm:p-8`}><div className="relative z-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Discover with Odie</p><h2 className="mt-3 font-display text-4xl font-semibold leading-none">{title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">{detail}</p></div><OdieImage className="h-40 w-full sm:h-56" /></section>;
}

export function CareerWorlds({ careers, selectedWorldId, savedIds, focusSearch = false, onNavigate, onToggleSave }: { careers: CareerSummary[]; selectedWorldId: string; savedIds: string[]; focusSearch?: boolean; onNavigate: (view: string, values?: Record<string, string>) => void; onToggleSave: (id: string) => void }) {
  const worlds = availableCareerWorlds(careers);
  const selectedWorld = worlds.find((world) => world.id === selectedWorldId);
  const [query, setQuery] = useState('');
  const candidates = selectedWorld ? careersInWorld(careers, selectedWorld) : careers;
  const matches = candidates.filter((career) => `${career.title} ${career.description ?? ''} ${career.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    if (focusSearch) document.getElementById('career-world-search')?.focus();
  }, [focusSearch]);
  return <div className="space-y-5"><section className={`${hero} p-5 sm:p-8`}><button className="min-h-11 text-sm font-semibold text-slate-200" onClick={() => selectedWorld ? onNavigate('worlds') : onNavigate('home')} type="button"><ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />{selectedWorld ? 'All career worlds' : 'Careers home'}</button><div className="mt-3 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Careers explorer</p><h2 className="mt-2 font-display text-4xl font-semibold">{selectedWorld?.title ?? 'Explore career worlds'}</h2><p className="mt-3 text-sm leading-6 text-slate-200">{selectedWorld?.description ?? 'Search by career name or browse a broad career world. Both use the same verified catalogue.'}</p></div><div className="relative mt-6 max-w-xl"><label className="sr-only" htmlFor="career-world-search">Search careers</label><Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-500" aria-hidden="true" /><TextInput className="min-h-12 pl-11" id="career-world-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selectedWorld ? `Search ${selectedWorld.title}` : 'Search all careers'} /></div></section>{!selectedWorld && !query ? <><SectionHeading title="Browse career worlds" detail="Only worlds represented in the current catalogue are shown." /><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{worlds.map((world) => <CareerWorldCard careers={careers} key={world.id} onOpen={() => onNavigate('worlds', { world: world.id })} world={world} />)}</div></> : <section className={`${surface} p-5 sm:p-6`}><SectionHeading title={selectedWorld ? `Careers in ${selectedWorld.title}` : 'Search results'} detail={`${matches.length} result${matches.length === 1 ? '' : 's'} from the current catalogue.`} /><div className="mt-5 grid gap-3 md:grid-cols-2">{matches.map((career) => <CareerRow career={career} key={career.id} onOpen={() => onNavigate('career', { career: career.id })} onToggleSave={() => onToggleSave(career.id)} saved={savedIds.includes(career.id)} />)}</div>{!matches.length ? <EmptyState title="No careers match those filters" description="Clear the search or choose another category to keep exploring." actionLabel="View all careers" actionHref="/dashboard/student/careers?view=worlds" icon={Search} /> : null}</section>}</div>;
}

function CareerRow({ career, saved, onOpen, onToggleSave }: { career: CareerSummary; saved: boolean; onOpen: () => void; onToggleSave: () => void }) {
  return <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><BriefcaseBusiness className="h-5 w-5" aria-hidden="true" /></span><button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button"><strong className="block truncate text-sm text-academy-navy dark:text-white">{career.title}</strong><span className="mt-1 block line-clamp-2 text-xs leading-5 text-academy-muted">{career.description ?? 'Open this career to explore available information.'}</span></button><button aria-label={`${saved ? 'Remove' : 'Save'} ${career.title}`} aria-pressed={saved} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold" onClick={onToggleSave} type="button"><Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" /></button><button aria-label={`Open ${career.title}`} className="grid h-11 w-8 shrink-0 place-items-center text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold" onClick={onOpen} type="button"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></article>;
}

export function CareerDetail({ career, careers, programmes, saved, onNavigate, onToggleSave, onAskOdie }: { career: CareerSummary; careers: CareerSummary[]; programmes: CareerProgramme[]; saved: boolean; onNavigate: (view: string, values?: Record<string, string>) => void; onToggleSave: () => void; onAskOdie: (prompt?: string) => void }) {
  const subjects = [...new Set(programmes.flatMap((programme) => programmeRequirements(programme).map((requirement) => requirement.label)))];
  const relatedCareers = (career.relatedCareerIds ?? []).map((id) => careers.find((item) => item.id === id)).filter((item): item is CareerSummary => Boolean(item));
  return <div className="space-y-5">
    <section className={`${hero} p-5 sm:p-8`}>
      <button className="min-h-11 text-sm font-semibold text-slate-200" onClick={() => onNavigate('worlds')} type="button"><ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />Explore careers</button>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">{career.category ?? 'Career detail'}</p><h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{career.title}</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">Explore the work, subjects and catalogue-backed study routes before building a detailed plan.</p></div><OdieImage className="hidden h-48 w-full lg:block" /></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <main className="space-y-5">
        <section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">What does this career involve?</h2><p className="mt-3 text-sm leading-7 text-academy-muted">{career.description ?? 'A detailed description is not available yet. Explore the verified study routes below and check the role with a careers adviser.'}</p></section>
        {career.pathCategories?.length || subjects.length ? <section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Subjects that might matter</h2>{career.pathCategories?.length ? <><p className="mt-1 text-sm leading-6 text-academy-muted">These catalogue themes describe areas connected with the work. They are not admission requirements.</p><div className="mt-4 flex flex-wrap gap-2">{career.pathCategories.map((tag) => <span className="rounded-full bg-academy-parchment px-3 py-2 text-sm font-semibold text-academy-navy dark:bg-white/[0.06] dark:text-white" key={tag}>{tag}</span>)}</div></> : null}{subjects.length ? <><h3 className={`${career.pathCategories?.length ? 'mt-5' : 'mt-2'} text-sm font-semibold text-academy-navy dark:text-white`}>Subjects listed by linked programmes</h3><div className="mt-3 flex flex-wrap gap-2">{subjects.map((subject) => <span className="rounded-full bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-100" key={subject}>{subject}</span>)}</div><p className="mt-3 text-xs leading-5 text-academy-muted">These are not universal career requirements. Open My Future Plan to compare each programme’s exact minimums and alternatives.</p></> : null}</section> : null}
        <section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">How could I get there?</h2>{career.educationRoutes?.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{career.educationRoutes.map((route) => <li className="flex gap-2 rounded-xl bg-academy-parchment p-3 text-sm text-academy-navy dark:bg-white/[0.05] dark:text-white" key={route}><GraduationCap className="h-5 w-5 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />{route}</li>)}</ul> : <p className="mt-3 text-sm text-academy-muted">No study routes are recorded for this career yet. Verify options with an institution or careers adviser.</p>}</section>
        {relatedCareers.length ? <section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Related careers</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{relatedCareers.map((related) => <button className="min-h-11 rounded-xl border border-[#ded5c6] bg-white px-4 text-left text-sm font-semibold text-academy-navy focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/10 dark:bg-slate-950 dark:text-white" key={related.id} onClick={() => onNavigate('career', { career: related.id })} type="button">{related.title}<ChevronRight className="ml-2 inline h-4 w-4" aria-hidden="true" /></button>)}</div></section> : null}
      </main>
      <aside className="space-y-5"><section className={`${surface} p-5`}><OdieImage className="mx-auto h-24 w-24" /><h2 className="mt-2 text-center font-display text-2xl font-semibold text-academy-navy dark:text-white">Ask Odie about this career</h2><p className="mt-2 text-center text-xs leading-5 text-academy-muted">Choose a question, edit the draft, then send it when you are ready.</p><div className="mt-4 grid gap-2">{[`What does a ${career.title} actually do?`, `What subjects should I consider for ${career.title}?`, `What can I study after Grade 12 to work toward ${career.title}?`, `What other careers are similar to ${career.title}?`].map((prompt) => <button className="min-h-11 rounded-xl border border-[#ded5c6] bg-white px-3 text-left text-sm font-semibold text-academy-navy dark:border-white/10 dark:bg-slate-950 dark:text-white" key={prompt} onClick={() => onAskOdie(prompt)} type="button">{prompt}</button>)}</div></section><div className="grid gap-3"><button className="academy-btn academy-btn-gold min-h-12 w-full" onClick={() => onNavigate('pathway', { career: career.id })} type="button"><Sparkles className="h-5 w-5" aria-hidden="true" />Open My Future Plan</button><button aria-pressed={saved} className="academy-btn academy-btn-outline min-h-12 w-full" onClick={onToggleSave} type="button"><Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />{saved ? 'Saved career' : 'Save career'}</button></div></aside>
    </div>
  </div>;
}
