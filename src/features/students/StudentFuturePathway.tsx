import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, ExternalLink, GraduationCap, Lightbulb, MessageCircle, Route, Search, Target, TrendingUp } from 'lucide-react';
import type { ApsSummary, ImprovementAction, ProgrammeEligibility, SubjectEvidence } from './careerPathway';
import { EligibilityBadge, ImprovementActionRow } from './StudentPathwayBuilderComponents';
import type { CareerSummary } from './studentCareersRepository';

const surface = 'rounded-[1.35rem] border border-[#ded5c6] bg-[#fffdf8] shadow-[0_10px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900';

type FuturePathwayProps = {
  career: CareerSummary;
  grade?: string;
  eligibility: ProgrammeEligibility[];
  aps: ApsSummary;
  targetAps: number | null;
  targetBusy: boolean;
  relevantSubjects: SubjectEvidence[];
  improvementActions: ImprovementAction[];
  onTargetChange: (value: number | null) => void;
  onAskOdie: (prompt?: string) => void;
};

const stages = [
  { id: 'overview', title: 'Career overview', detail: 'Understand the role and opportunities.', icon: Search },
  { id: 'subjects', title: 'Subjects that matter', detail: 'Review subjects and your available evidence.', icon: BookOpen },
  { id: 'routes', title: 'Study routes', detail: 'Explore qualifications and institutions.', icon: Route },
  { id: 'requirements', title: 'Entry requirements', detail: 'Compare APS and listed minimums.', icon: GraduationCap },
  { id: 'next', title: 'Next steps', detail: 'Choose realistic actions to take next.', icon: Target },
] as const;

export function StudentFuturePathway(props: FuturePathwayProps) {
  const [activeStage, setActiveStage] = useState<(typeof stages)[number]['id']>('overview');
  const { career } = props;
  const activeStageIndex = stages.findIndex((stage) => stage.id === activeStage);
  const gradeNumber = Number(props.grade?.match(/\d{1,2}/)?.[0] ?? Number.NaN);
  const recommendedStage = gradeNumber === 12 ? 'requirements' : 'subjects';

  function selectStage(index: number) {
    const stage = stages[index];
    if (!stage) return;
    setActiveStage(stage.id);
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keyToIndex: Partial<Record<string, number>> = {
      ArrowLeft: (index - 1 + stages.length) % stages.length,
      ArrowRight: (index + 1) % stages.length,
      Home: 0,
      End: stages.length - 1,
    };
    const nextIndex = keyToIndex[event.key];
    if (nextIndex == null) return;
    event.preventDefault();
    selectStage(nextIndex);
    document.getElementById(`pathway-${stages[nextIndex].id}-tab`)?.focus();
  }

  return <div className="space-y-4">
    <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-academy-navy p-5 text-white shadow-[0_18px_44px_rgba(7,19,38,0.22)] sm:p-7">
      <div className="relative z-10 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">My Future Pathway</p>
        <h2 className="mt-2 font-display text-4xl font-semibold">{career.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">Move through one section at a time. Nothing here guarantees admission; programme requirements must still be verified with the institution.</p>
        <button className="academy-btn academy-btn-gold mt-5 min-h-12" data-testid="pathway-primary-action" onClick={() => setActiveStage(recommendedStage)} type="button">{gradeNumber === 12 ? 'Review entry requirements' : 'Start with subjects'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <img alt="" aria-hidden="true" className="absolute -bottom-5 -right-6 hidden h-48 w-48 object-contain opacity-90 sm:block" src="/images/dashboard/odie-pathway-mascot.png" />
    </section>

    <nav className={`${surface} p-3 sm:p-4`} aria-label="Your career pathway">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="tablist" aria-label="Future pathway sections">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const active = activeStage === stage.id;
          return <li key={stage.id} role="presentation"><button aria-controls={`pathway-${stage.id}-panel`} aria-selected={active} className={`flex min-h-16 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-academy-gold sm:min-h-28 sm:flex-col sm:items-start ${active ? 'bg-academy-navy text-white ring-2 ring-academy-gold' : 'bg-academy-parchment text-academy-navy dark:bg-white/[0.05] dark:text-white'}`} id={`pathway-${stage.id}-tab`} onClick={() => setActiveStage(stage.id)} onKeyDown={(event) => handleStageKeyDown(event, index)} role="tab" tabIndex={active ? 0 : -1} type="button"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-academy-gold text-academy-navy' : 'bg-white text-academy-aegean dark:bg-slate-950 dark:text-academy-gold'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><strong className="block text-xs leading-4 sm:text-sm">{index + 1}. {stage.title}</strong><span className={`mt-1 hidden text-xs leading-5 md:block ${active ? 'text-slate-200' : 'text-academy-muted'}`}>{stage.detail}</span></span></button></li>;
        })}
      </ol>
      <p className="sr-only">These sections guide navigation and do not represent automatic achievement milestones.</p>
    </nav>

    <div className="space-y-4">
      <PathwaySection active={activeStage === 'overview'} id="overview" title="Career overview" icon={Search}><CareerOverview career={career} onAskOdie={props.onAskOdie} /></PathwaySection>
      <PathwaySection active={activeStage === 'subjects'} id="subjects" title="Subjects that matter" icon={BookOpen}><SubjectsSection eligibility={props.eligibility} evidence={props.relevantSubjects} /></PathwaySection>
      <PathwaySection active={activeStage === 'routes'} id="routes" title="Study routes" icon={Route}><StudyRoutes career={career} eligibility={props.eligibility} /></PathwaySection>
      <PathwaySection active={activeStage === 'requirements'} id="requirements" title="Entry requirements" icon={GraduationCap}><EntryRequirements {...props} /></PathwaySection>
      <PathwaySection active={activeStage === 'next'} id="next" title="Next steps" icon={Target}><NextSteps actions={props.improvementActions} career={career} onAskOdie={props.onAskOdie} /></PathwaySection>
      <div className="flex items-center justify-between gap-3">
        <button className="academy-btn academy-btn-outline min-h-11" disabled={activeStageIndex === 0} onClick={() => selectStage(activeStageIndex - 1)} type="button"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
        <p className="text-xs font-semibold text-academy-muted" aria-live="polite">Section {activeStageIndex + 1} of {stages.length}</p>
        <button className="academy-btn academy-btn-gold min-h-11" disabled={activeStageIndex === stages.length - 1} onClick={() => selectStage(activeStageIndex + 1)} type="button">Next<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  </div>;
}

function PathwaySection({ active, id, title, icon: Icon, children }: { active: boolean; id: string; title: string; icon: typeof Search; children: ReactNode }) {
  return <section aria-labelledby={`pathway-${id}-tab`} className={`${surface} p-5 sm:p-6`} hidden={!active} id={`pathway-${id}-panel`} role="tabpanel" tabIndex={0}><div className="flex items-center gap-3 border-b border-[#e8e0d5] pb-4 dark:border-white/10"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-academy-aegean/10 text-academy-aegean dark:text-academy-gold"><Icon className="h-5 w-5" aria-hidden="true" /></span><h2 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">{title}</h2></div><div className="pt-5">{children}</div></section>;
}

function CareerOverview({ career, onAskOdie }: { career: CareerSummary; onAskOdie: (prompt?: string) => void }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"><div><p className="text-sm leading-7 text-academy-muted">{career.description ?? 'The current catalogue does not yet include a detailed overview for this career.'}</p>{career.pathCategories?.length ? <div className="mt-4 flex flex-wrap gap-2">{career.pathCategories.map((tag) => <span className="rounded-full bg-academy-parchment px-3 py-2 text-xs font-semibold text-academy-navy dark:bg-white/[0.06] dark:text-white" key={tag}>{tag}</span>)}</div> : null}</div><aside className="rounded-2xl bg-academy-navy p-4 text-white"><div className="flex items-center gap-3"><img alt="" aria-hidden="true" className="h-16 w-16 object-contain" src="/images/dashboard/odie-pathway-mascot.png" /><div><p className="font-display text-lg font-semibold">Curious about the work?</p><p className="text-xs leading-5 text-slate-300">Review Odie’s question before sending it.</p></div></div><button className="academy-btn academy-btn-gold mt-3 min-h-11 w-full" onClick={() => onAskOdie(`What does a typical day look like for a ${career.title}?`)} type="button"><MessageCircle className="h-4 w-4" aria-hidden="true" />Ask Odie</button></aside></div>;
}

function SubjectsSection({ eligibility, evidence }: { eligibility: ProgrammeEligibility[]; evidence: SubjectEvidence[] }) {
  const requirements = [...new Map(eligibility.flatMap((result) => result.requirements).flatMap((requirement) => requirement.acceptedSubjects.map((subject) => [subject.toLowerCase(), { subject, minimum: requirement.minimumPercentage }]))).values()];
  const evidenceBySubject = new Map(evidence.map((item) => [item.subject.toLowerCase(), item]));
  return <><p className="text-sm leading-6 text-academy-muted">Required subjects below come from at least one stored programme requirement. They are not universal requirements for the career.</p>{requirements.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{requirements.map((item) => { const result = evidenceBySubject.get(item.subject.toLowerCase()); return <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={item.subject}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-academy-aegean dark:text-academy-gold">Listed requirement</p><h3 className="mt-1 font-semibold text-academy-navy dark:text-white">{item.subject}</h3></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">{item.minimum}%+</span></div><p className="mt-3 text-sm text-academy-muted">{result?.score == null ? 'No released result available yet.' : `Available evidence: ${Math.round(result.score)}%.`}</p></article>; })}</div> : <p className="mt-4 rounded-2xl bg-academy-parchment p-4 text-sm text-academy-muted dark:bg-white/[0.05]">No structured subject requirements are stored for the matched programmes.</p>}</>;
}

function StudyRoutes({ career, eligibility }: { career: CareerSummary; eligibility: ProgrammeEligibility[] }) {
  return <div className="space-y-5"><div><p className="text-sm leading-6 text-academy-muted">These are catalogue routes, not a complete list of every way into the field.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(career.educationRoutes ?? []).map((route) => <article className="rounded-2xl bg-academy-parchment p-4 dark:bg-white/[0.05]" key={route}><BookOpen className="h-5 w-5 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-academy-navy dark:text-white">{route}</h3></article>)}</div></div>{eligibility.length ? <div><h3 className="font-display text-xl font-semibold text-academy-navy dark:text-white">Matched programmes</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{eligibility.map(({ programme }) => <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={programme.id}><p className="text-xs font-bold uppercase tracking-[0.12em] text-academy-aegean dark:text-academy-gold">{programme.qualificationType}</p><h4 className="mt-1 font-semibold text-academy-navy dark:text-white">{programme.programmeName}</h4><p className="mt-1 text-sm text-academy-muted">{programme.institutionName}</p></article>)}</div></div> : null}</div>;
}

function EntryRequirements({ aps, targetAps, targetBusy, eligibility, onTargetChange }: FuturePathwayProps) {
  const [targetDraft, setTargetDraft] = useState(targetAps == null ? '' : String(targetAps));
  const [showAllProgrammes, setShowAllProgrammes] = useState(false);
  const visibleEligibility = showAllProgrammes ? eligibility : eligibility.slice(0, 4);
  useEffect(() => setTargetDraft(targetAps == null ? '' : String(targetAps)), [targetAps]);
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Guidance APS" value={aps.current == null ? 'Not ready' : String(aps.current)} detail={aps.current == null ? `${aps.missingCount} more released result${aps.missingCount === 1 ? '' : 's'} needed.` : 'Based on six released subjects.'} /><div className="rounded-2xl bg-academy-parchment p-4 dark:bg-white/[0.05]"><label className="text-xs font-bold uppercase tracking-[0.12em] text-academy-muted" htmlFor="future-pathway-target">Target APS</label><input className="mt-2 h-11 w-full rounded-xl border border-[#ded5c6] bg-white px-3 text-xl font-semibold text-academy-navy focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/10 dark:bg-slate-950 dark:text-white" id="future-pathway-target" inputMode="numeric" max={60} min={0} onBlur={() => onTargetChange(targetDraft ? Number(targetDraft) : null)} onChange={(event) => setTargetDraft(event.target.value)} placeholder="Set target" type="number" value={targetDraft} /><p className="mt-2 text-xs text-academy-muted">{targetBusy ? 'Saving…' : targetAps == null ? 'Optional personal target' : 'Server-confirmed target'}</p></div><Metric label="Evidence status" value={aps.enoughResults ? 'Available' : 'Incomplete'} detail="Missing results are never treated as failed eligibility." /></div><details className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950"><summary className="min-h-11 cursor-pointer font-semibold text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-academy-gold">How the guidance APS is calculated</summary><p className="mt-2 text-sm leading-6 text-academy-muted">The six strongest distinct released subject averages are converted to 1–7 points. Life Orientation and missing marks are excluded. Institutions may use different methods.</p></details><div><div className="flex items-end justify-between gap-3"><div><h3 className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Programme eligibility</h3><p className="mt-1 text-sm text-academy-muted">Indicative guidance from stored requirements—not an admission decision.</p></div></div>{eligibility.length ? <><div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleEligibility.map((result) => <ProgrammeCard key={result.programme.id} result={result} />)}</div>{eligibility.length > 4 ? <button className="academy-btn academy-btn-outline mt-4 min-h-11" onClick={() => setShowAllProgrammes((current) => !current)} type="button">{showAllProgrammes ? 'Show fewer programmes' : `Show all ${eligibility.length} programmes`}</button> : null}</> : <p className="mt-4 rounded-2xl bg-academy-parchment p-4 text-sm text-academy-muted dark:bg-white/[0.05]">No matching programmes are stored in the current catalogue.</p>}<p className="mt-4 flex gap-2 text-xs leading-5 text-academy-muted"><CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />Requirements can change by intake. Verify every programme with the institution.</p></div></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-2xl bg-academy-parchment p-4 dark:bg-white/[0.05]"><p className="text-xs font-bold uppercase tracking-[0.12em] text-academy-muted">{label}</p><p className="mt-2 font-display text-2xl font-semibold text-academy-navy dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{detail}</p></article>;
}

function ProgrammeCard({ result }: { result: ProgrammeEligibility }) {
  const listedAps = result.programme.requirements?.minimumAps;
  return <details className="group rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950"><summary className="min-h-11 cursor-pointer list-none focus-visible:ring-2 focus-visible:ring-academy-gold"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-academy-aegean dark:text-academy-gold">{result.programme.institutionName}</p><h4 className="mt-1 break-words font-semibold text-academy-navy dark:text-white">{result.programme.programmeName}</h4><p className="mt-1 text-xs text-academy-muted">{result.programme.qualificationType} · Listed APS: {listedAps ?? 'not recorded'}</p></div><EligibilityBadge result={result} /></div><span className="mt-3 block text-sm font-bold text-academy-aegean group-open:hidden dark:text-academy-gold">View programme details</span><span className="mt-3 hidden text-sm font-bold text-academy-aegean group-open:block dark:text-academy-gold">Hide programme details</span></summary><div className="mt-3 space-y-4 border-t border-[#e8e0d5] pt-4 text-sm dark:border-white/10"><div><p className="font-semibold text-academy-navy dark:text-white">Available learner evidence</p><p className="mt-1 leading-6 text-academy-muted">{result.apsComparison}</p></div><div><p className="font-semibold text-academy-navy dark:text-white">Indicative comparison</p><p className="mt-1 leading-6 text-academy-muted">{result.explanation}</p></div><div><p className="font-semibold text-academy-navy dark:text-white">Listed subject requirements</p><div className="mt-1 space-y-1 text-academy-muted">{result.requirements.length ? result.requirements.map((requirement) => <p key={`${result.programme.id}-${requirement.label}`}>{requirement.label}: {requirement.minimumPercentage}% minimum</p>) : <p>No structured subject requirements are stored.</p>}</div></div><div><p className="font-semibold text-academy-navy dark:text-white">Information to check</p>{result.gaps.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-academy-muted">{result.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className="mt-1 text-academy-muted">No gap is identified from the available evidence. Admission is still not guaranteed.</p>}<p className="mt-2 text-xs text-academy-muted">Catalogue confidence: {result.programme.requirementConfidence ?? 'not recorded'}. Last updated date: unavailable.</p></div>{result.programme.sourceUrl ? <a className="academy-btn academy-btn-outline min-h-11 w-full" href={result.programme.sourceUrl} rel="noreferrer" target="_blank">Verify on the official institution page <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : <p className="rounded-xl bg-academy-parchment p-3 text-academy-muted dark:bg-white/[0.05]">No official verification link is stored for this programme yet.</p>}</div></details>;
}

function NextSteps({ actions, career, onAskOdie }: { actions: ImprovementAction[]; career: CareerSummary; onAskOdie: (prompt?: string) => void }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"><div><p className="text-sm leading-6 text-academy-muted">Prioritised from the evidence and stored requirements currently available.</p><div className="mt-3 divide-y divide-[#e8e0d5] dark:divide-white/10">{actions.length ? actions.map((action) => <ImprovementActionRow item={action} key={action.id} />) : <div className="flex gap-3 py-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /><p className="text-sm leading-6 text-academy-muted">No supported improvement action can be derived yet. Verify a programme or add released results first.</p></div>}</div></div><aside className="rounded-2xl bg-academy-navy p-4 text-white"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-academy-gold" aria-hidden="true" /><h3 className="font-display text-lg font-semibold">Plan with Odie</h3></div><p className="mt-2 text-xs leading-5 text-slate-300">Ask for realistic next steps, then review the prompt before sending.</p><button className="academy-btn academy-btn-gold mt-4 min-h-11 w-full" onClick={() => onAskOdie(`Help me understand realistic next steps toward ${career.title}. Use only my saved Careers information and remind me what to verify.`)} type="button"><TrendingUp className="h-4 w-4" aria-hidden="true" />Review next steps</button></aside></div>;
}
