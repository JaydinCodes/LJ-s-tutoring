import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BriefcaseBusiness, Check, ChevronRight, Compass, GraduationCap, Lightbulb, MessageCircle, Search, Sparkles } from 'lucide-react';
import { EmptyState } from '../../components/dashboard/DashboardDesignSystem';
import { TextInput } from '../../components/ui/FormField';
import { availableCareerWorlds, careersInWorld, matchCareers, type CareerWorld } from './careerDiscovery';
import { programmeRequirements } from './careerPathway';
import type { CareerProgramme, CareerSummary, StudentCareerProfile } from './studentCareersRepository';

const surface = 'rounded-[1.35rem] border border-[#ded5c6] bg-[#fffdf8] shadow-[0_10px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900';
const hero = 'relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-academy-navy text-white shadow-[0_18px_44px_rgba(7,19,38,0.22)]';

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
    <section className={`${hero} min-h-[25rem] p-5 sm:min-h-0 sm:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center`}>
      <div className="relative z-10 max-w-2xl pb-44 sm:pb-40 lg:pb-0">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-academy-gold">Careers explorer</p>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-[0.95] sm:text-5xl">Let’s explore your future together.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">I’m Odie. I’ll help you explore what you love, discover what you could become, and plan your next steps.</p>
        <p className="mt-3 max-w-xl text-xs font-semibold leading-5 text-academy-gold">{gradeMessage(grade)}</p>
        <div className="mt-6 grid gap-3 sm:flex">
          <button className="academy-btn academy-btn-gold min-h-12 justify-between" onClick={() => onNavigate('compass')} type="button"><Compass className="h-5 w-5" aria-hidden="true" />Discover with Odie <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          <button className="academy-btn min-h-12 justify-between border border-white/20 bg-white text-academy-navy hover:bg-slate-100" onClick={() => onNavigate('worlds', { focus: 'search' })} type="button"><Search className="h-5 w-5" aria-hidden="true" />Search careers</button>
        </div>
      </div>
      <OdieImage className="absolute -bottom-7 right-0 h-60 w-60 sm:right-8 sm:h-64 sm:w-64 lg:static lg:h-80 lg:w-full" />
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

    <section className={`${surface} p-5 sm:p-6`} aria-labelledby="odie-starters-title">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-academy-gold/20 text-academy-navy"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="odie-starters-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Start a conversation with Odie</h2><p className="text-sm text-academy-muted">Choose a prompt, edit it, then send only when you are ready.</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{['I enjoy solving problems.', 'I like working with people.', 'What careers use Mathematics?', "I don't know what I want to become."].map((prompt) => <button className="min-h-12 rounded-xl border border-[#ded5c6] bg-white px-4 text-left text-sm font-semibold text-academy-navy hover:border-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/10 dark:bg-slate-950 dark:text-white" key={prompt} onClick={() => onAskOdie(prompt)} type="button">{prompt}</button>)}</div>
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
  const count = careersInWorld(careers, world).length;
  return <button className={`${surface} group min-h-44 p-4 text-left transition-transform motion-safe:hover:-translate-y-1`} onClick={onOpen} type="button"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${world.tone}`}><Icon className="h-6 w-6" aria-hidden="true" /></span><strong className="mt-4 block font-display text-xl text-academy-navy dark:text-white">{world.title}</strong><span className="mt-1 block text-xs leading-5 text-academy-muted">{world.description}</span><span className="mt-3 flex items-center justify-between text-xs font-bold text-academy-aegean dark:text-academy-gold">{count} career{count === 1 ? '' : 's'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></span></button>;
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
  if (step >= questions.length) return <div className="space-y-5"><CompassHero title="Ideas to explore" detail="These are catalogue matches based only on what you selected—not a prediction of what you should become." /><section className={`${surface} p-5 sm:p-6`}><SectionHeading title="Your career ideas" detail="Explore freely, change your answers, or ask Odie to help you think them through." /><div className="mt-5 grid gap-3 md:grid-cols-2">{matches.slice(0, 6).map((match) => <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={match.career.id}><p className="text-xs font-bold uppercase tracking-[0.14em] text-academy-aegean dark:text-academy-gold">{match.career.category}</p><h3 className="mt-2 font-display text-xl font-semibold text-academy-navy dark:text-white">{match.career.title}</h3><p className="mt-2 text-sm leading-6 text-academy-muted">{match.reasons[0] ?? 'A career from the current catalogue worth exploring.'}</p><button className="academy-btn academy-btn-gold mt-4 min-h-11" onClick={() => onNavigate('career', { career: match.career.id })} type="button">Explore career <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></article>)}</div>{!matches.length ? <EmptyState title="No strong text matches yet" description="That is completely fine. Browse every career world or ask Odie a question instead." actionLabel="Explore all careers" actionHref="/dashboard/student/careers?view=worlds" icon={Compass} /> : null}<div className="mt-5 flex flex-wrap gap-3"><button className="academy-btn academy-btn-outline min-h-11" onClick={() => setStep(0)} type="button"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Change answers</button><button className="academy-btn academy-btn-outline min-h-11" onClick={() => onAskOdie('Help me understand these career ideas without assuming they determine what I should become.')} type="button"><MessageCircle className="h-4 w-4" aria-hidden="true" />Discuss with Odie</button></div></section></div>;
  const question = questions[step];
  const toggle = (value: string) => question.setValues(question.values.includes(value) ? question.values.filter((item) => item !== value) : [...question.values.filter((item) => item !== 'Not sure yet'), value]);
  return <div className="space-y-5"><CompassHero title="Odie’s Career Compass" detail="A short, optional way to discover career ideas. Skip anything you do not want to answer." /><section className={`${surface} mx-auto max-w-3xl p-5 sm:p-8`}><div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-academy-muted"><span>Question {step + 1} of {questions.length}</span><button className="min-h-11 px-2 text-academy-aegean dark:text-academy-gold" onClick={() => setStep(step + 1)} type="button">Skip</button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-academy-gold" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><h2 className="mt-6 font-display text-3xl font-semibold text-academy-navy dark:text-white">{question.title}</h2><p className="mt-2 text-sm text-academy-muted">Choose as many as you like. There are no right answers.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{question.options.map((option) => { const selected = question.values.includes(option); return <button aria-pressed={selected} className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-academy-gold ${selected ? 'border-academy-aegean bg-academy-aegean text-white' : 'border-[#ded5c6] bg-white text-academy-navy dark:border-white/10 dark:bg-slate-950 dark:text-white'}`} key={option} onClick={() => toggle(option)} type="button">{option}{selected ? <Check className="h-5 w-5" aria-hidden="true" /> : null}</button>; })}</div><div className="mt-7 flex justify-between gap-3"><button className="academy-btn academy-btn-outline min-h-11" disabled={step === 0} onClick={() => setStep(step - 1)} type="button"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</button><button className="academy-btn academy-btn-gold min-h-11" onClick={() => { if (step === questions.length - 1) onSaveAnswers(interests, preferredSubjects); setStep(step + 1); }} type="button">{step === questions.length - 1 ? 'See career ideas' : 'Continue'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div></section></div>;
}

function CompassHero({ title, detail }: { title: string; detail: string }) {
  return <section className={`${hero} grid min-h-64 grid-cols-[minmax(0,1fr)_8rem] items-center p-5 sm:grid-cols-[minmax(0,1fr)_15rem] sm:p-8`}><div className="relative z-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Discover with Odie</p><h2 className="mt-3 font-display text-4xl font-semibold leading-none">{title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">{detail}</p></div><OdieImage className="h-40 w-full sm:h-56" /></section>;
}

export function CareerWorlds({ careers, selectedWorldId, savedIds, onNavigate, onToggleSave }: { careers: CareerSummary[]; selectedWorldId: string; savedIds: string[]; onNavigate: (view: string, values?: Record<string, string>) => void; onToggleSave: (id: string) => void }) {
  const worlds = availableCareerWorlds(careers);
  const selectedWorld = worlds.find((world) => world.id === selectedWorldId);
  const [query, setQuery] = useState('');
  const candidates = selectedWorld ? careersInWorld(careers, selectedWorld) : careers;
  const matches = candidates.filter((career) => `${career.title} ${career.description ?? ''} ${career.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="space-y-5"><section className={`${hero} p-5 sm:p-8`}><button className="min-h-11 text-sm font-semibold text-slate-200" onClick={() => selectedWorld ? onNavigate('worlds') : onNavigate('home')} type="button"><ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />{selectedWorld ? 'All career worlds' : 'Careers home'}</button><div className="mt-3 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Careers explorer</p><h2 className="mt-2 font-display text-4xl font-semibold">{selectedWorld?.title ?? 'Explore career worlds'}</h2><p className="mt-3 text-sm leading-6 text-slate-200">{selectedWorld?.description ?? 'Discover different fields, see what they involve, and open careers from the real Project Odysseus catalogue.'}</p></div><div className="relative mt-6 max-w-xl"><label className="sr-only" htmlFor="career-world-search">Search careers</label><Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-500" aria-hidden="true" /><TextInput className="min-h-12 pl-11" id="career-world-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selectedWorld ? `Search ${selectedWorld.title}` : 'Search all careers'} /></div></section>{!selectedWorld && !query ? <><SectionHeading title="Browse career worlds" detail="Only worlds represented in the current catalogue are shown." /><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{worlds.map((world) => <CareerWorldCard careers={careers} key={world.id} onOpen={() => onNavigate('worlds', { world: world.id })} world={world} />)}</div></> : <section className={`${surface} p-5 sm:p-6`}><SectionHeading title={selectedWorld ? `Careers in ${selectedWorld.title}` : 'Search results'} detail={`${matches.length} result${matches.length === 1 ? '' : 's'} from the current catalogue.`} /><div className="mt-5 grid gap-3 md:grid-cols-2">{matches.map((career) => <CareerRow career={career} key={career.id} onOpen={() => onNavigate('career', { career: career.id })} onToggleSave={() => onToggleSave(career.id)} saved={savedIds.includes(career.id)} />)}</div>{!matches.length ? <EmptyState title="No careers match those filters" description="Clear the search or choose another category to keep exploring." actionLabel="View all careers" actionHref="/dashboard/student/careers?view=worlds" icon={Search} /> : null}</section>}</div>;
}

function CareerRow({ career, saved, onOpen, onToggleSave }: { career: CareerSummary; saved: boolean; onOpen: () => void; onToggleSave: () => void }) {
  return <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><BriefcaseBusiness className="h-5 w-5" aria-hidden="true" /></span><button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button"><strong className="block truncate text-sm text-academy-navy dark:text-white">{career.title}</strong><span className="mt-1 block line-clamp-2 text-xs leading-5 text-academy-muted">{career.description ?? 'Open this career to explore available information.'}</span></button><button aria-label={`${saved ? 'Remove' : 'Save'} ${career.title}`} aria-pressed={saved} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold" onClick={onToggleSave} type="button"><Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" /></button><button aria-label={`Open ${career.title}`} className="grid h-11 w-8 shrink-0 place-items-center text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold" onClick={onOpen} type="button"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></article>;
}

export function CareerDetail({ career, programmes, saved, onNavigate, onToggleSave, onAskOdie }: { career: CareerSummary; programmes: CareerProgramme[]; saved: boolean; onNavigate: (view: string, values?: Record<string, string>) => void; onToggleSave: () => void; onAskOdie: (prompt?: string) => void }) {
  const subjects = [...new Set(programmes.flatMap((programme) => programmeRequirements(programme).flatMap((requirement) => requirement.acceptedSubjects)))];
  return <div className="space-y-5"><section className={`${hero} p-5 sm:p-8`}><button className="min-h-11 text-sm font-semibold text-slate-200" onClick={() => onNavigate('worlds')} type="button"><ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />Explore careers</button><div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">{career.category ?? 'Career detail'}</p><h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{career.title}</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">{career.description ?? 'The catalogue does not yet include a detailed description for this career.'}</p><div className="mt-5 flex flex-wrap gap-2">{(career.pathCategories ?? []).slice(0, 5).map((tag) => <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs" key={tag}>{tag}</span>)}</div></div><OdieImage className="hidden h-48 w-full lg:block" /></div></section><div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"><main className="space-y-5"><section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">What this career involves</h2><p className="mt-3 text-sm leading-7 text-academy-muted">{career.description ?? 'A student-friendly role overview is not available in the current catalogue yet.'}</p>{career.educationRoutes?.length ? <div className="mt-5"><h3 className="font-semibold text-academy-navy dark:text-white">Available study routes</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{career.educationRoutes.map((route) => <li className="flex gap-2 rounded-xl bg-academy-parchment p-3 text-sm text-academy-navy dark:bg-white/[0.05] dark:text-white" key={route}><GraduationCap className="h-5 w-5 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" />{route}</li>)}</ul></div> : null}</section><section className={`${surface} p-5 sm:p-6`}><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Subjects and programme evidence</h2><p className="mt-1 text-sm leading-6 text-academy-muted">These subjects appear in stored programme requirements; they are not universal requirements for the career.</p>{subjects.length ? <div className="mt-4 flex flex-wrap gap-2">{subjects.map((subject) => <span className="rounded-full bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-100" key={subject}>{subject}</span>)}</div> : <p className="mt-4 text-sm text-academy-muted">No structured subject requirements are linked to this career yet.</p>}</section></main><aside className="space-y-5"><section className={`${surface} p-5`}><OdieImage className="mx-auto h-24 w-24" /><h2 className="mt-2 text-center font-display text-2xl font-semibold text-academy-navy dark:text-white">Ask Odie about this career</h2><div className="mt-4 grid gap-2">{[`What does a typical day look like for a ${career.title}?`, `What should I verify before studying toward ${career.title}?`].map((prompt) => <button className="min-h-11 rounded-xl border border-[#ded5c6] bg-white px-3 text-left text-sm font-semibold text-academy-navy dark:border-white/10 dark:bg-slate-950 dark:text-white" key={prompt} onClick={() => onAskOdie(prompt)} type="button">{prompt}</button>)}</div></section><div className="grid gap-3"><button className="academy-btn academy-btn-gold min-h-12 w-full" onClick={() => onNavigate('pathway', { career: career.id })} type="button"><Sparkles className="h-5 w-5" aria-hidden="true" />Explore my pathway</button><button aria-pressed={saved} className="academy-btn academy-btn-outline min-h-12 w-full" onClick={onToggleSave} type="button"><Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />{saved ? 'Saved career' : 'Save career'}</button></div></aside></div></div>;
}

export function PathwayStageNavigation() {
  const stages = [
    ['Explore the career', 'Understand the role and opportunities.'],
    ['Subjects that matter', 'See supported subject evidence.'],
    ['Compare routes', 'Explore study options and institutions.'],
    ['Programme requirements', 'Review APS and listed minimums.'],
    ['What to improve next', 'Choose realistic next actions.'],
  ];
  return <nav className={`${surface} p-4 sm:p-5`} aria-label="Your career pathway"><div className="mb-4 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-academy-gold" aria-hidden="true" /><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Your career pathway</h2></div><ol className="grid gap-3 md:grid-cols-5">{stages.map(([title, detail], index) => <li className="flex gap-3 rounded-2xl bg-academy-parchment p-3 md:block dark:bg-white/[0.05]" key={title}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-academy-gold text-sm font-bold text-academy-navy">{index + 1}</span><div className="md:mt-3"><strong className="block text-sm text-academy-navy dark:text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-academy-muted">{detail}</span></div></li>)}</ol><p className="sr-only">These stages guide navigation and do not represent automatic achievement milestones.</p></nav>;
}
