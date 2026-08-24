import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  GraduationCap,
  MessageCircle,
  Route,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AnimatedProgressBar, EmptyState } from '../../components/dashboard/DashboardDesignSystem';
import { FormField, TextInput, inputClassName } from '../../components/ui/FormField';
import type { ApsSummary, ImprovementAction, ProgrammeEligibility, SubjectEvidence } from './careerPathway';
import type { CareerSummary } from './studentCareersRepository';

const surface = 'rounded-[1.35rem] border border-[#ded5c6] bg-[#fffdf8] shadow-[0_10px_30px_rgba(15,23,42,0.055)] dark:border-white/10 dark:bg-slate-900';

export function CareerTargetControl({
  careers,
  selectedId,
  onChange,
}: {
  careers: CareerSummary[];
  selectedId: string;
  onChange: (careerId: string) => void;
}) {
  return (
    <div className="ml-auto w-full sm:max-w-md">
      <FormField label="Career target">
        <select className={inputClassName} value={selectedId} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose a career</option>
          {careers.map((career) => <option key={career.id} value={career.id}>{career.title}</option>)}
        </select>
      </FormField>
    </div>
  );
}

export function ApsSummaryPanel({
  aps,
  career,
  relevantSubjects,
  targetAps,
  targetBusy,
  onTargetChange,
}: {
  aps: ApsSummary;
  career: CareerSummary;
  relevantSubjects: SubjectEvidence[];
  targetAps: number | null;
  targetBusy: boolean;
  onTargetChange: (target: number | null) => void;
}) {
  const [targetDraft, setTargetDraft] = useState(targetAps == null ? '' : String(targetAps));
  useEffect(() => setTargetDraft(targetAps == null ? '' : String(targetAps)), [targetAps]);
  const progress = aps.current != null && targetAps != null && targetAps > 0
    ? Math.max(0, Math.min(100, Math.round((aps.current / targetAps) * 100)))
    : null;

  return (
    <section className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-academy-navy p-5 text-white shadow-[0_18px_42px_rgba(7,19,38,0.2)] sm:p-7" aria-labelledby="pathway-summary-title">
      <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/[0.07]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-80 bg-[url('/images/dashboard/student-learning-plan-classical.webp')] bg-cover bg-center opacity-[0.07]" aria-hidden="true" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)_17rem] xl:items-center">
        <div className="order-1 xl:order-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Your pathway</p>
          <h2 id="pathway-summary-title" className="mt-2 font-display text-3xl font-semibold">{career.title}</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:max-w-lg sm:grid-cols-3">
            <SummaryMetric label="Current APS" value={aps.current == null ? 'Not ready' : String(aps.current)} helper={aps.current == null ? `${aps.missingCount} more result${aps.missingCount === 1 ? '' : 's'} needed` : 'Guidance score'} />
            <div className="border-l border-white/15 pl-4">
              <label className="text-xs font-semibold text-slate-300" htmlFor="pathway-aps-target">Target APS</label>
              <input
                className="mt-1 h-11 w-full max-w-24 rounded-xl border border-white/20 bg-white/10 px-3 text-2xl font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-academy-gold"
                id="pathway-aps-target"
                inputMode="numeric"
                max={60}
                min={0}
                onBlur={() => onTargetChange(targetDraft ? Number(targetDraft) : null)}
                onChange={(event) => setTargetDraft(event.target.value)}
                placeholder="Set"
                type="number"
                value={targetDraft}
              />
              <p className="mt-1 text-xs text-slate-300">{targetBusy ? 'Saving…' : targetAps == null ? 'No target set' : 'Saved target'}</p>
            </div>
            <SummaryMetric label="Progress" value={progress == null ? '—' : `${progress}%`} helper={aps.current != null && targetAps != null ? `${Math.max(0, targetAps - aps.current)} points to target` : 'Set APS and results'} />
          </div>
          {progress != null ? <div className="mt-4 max-w-lg" role="progressbar" aria-label="Progress toward saved APS target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><AnimatedProgressBar value={progress} className="bg-academy-aegean" /></div> : null}
        </div>
        <div className="order-3 xl:order-none"><SubjectEvidencePanel subjects={relevantSubjects} /></div>
        <div className="relative order-2 xl:order-none">
          <a className="academy-btn academy-btn-gold min-h-12 w-full justify-between" data-testid="pathway-primary-action" href="#improvement-plan">
            Build improvement plan <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </a>
          <details className="mt-3 text-sm text-slate-300">
            <summary className="min-h-11 cursor-pointer list-none py-3 text-center font-semibold underline decoration-white/30 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academy-gold">How APS is calculated</summary>
            <p className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5">
              This guidance APS adds points for the six strongest distinct released subject averages: 80%+ = 7, 70–79% = 6, down to 0–29% = 1. Blank marks and Life Orientation are excluded. Institutions may calculate APS differently, so verify every linked requirement.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><p className="text-xs font-semibold text-slate-300">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-300">{helper}</p></div>;
}

export function SubjectEvidencePanel({ subjects }: { subjects: SubjectEvidence[] }) {
  return (
    <section aria-labelledby="relevant-subjects-title">
      <h3 id="relevant-subjects-title" className="text-sm font-semibold text-white">Relevant subject performance</h3>
      {subjects.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {subjects.slice(0, 3).map((subject) => (
            <div key={subject.subject}>
              <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{subject.subject}</span><strong>{subject.score == null ? 'No result' : `${Math.round(subject.score)}%`}</strong></div>
              <div className="mt-2" role="progressbar" aria-label={`${subject.subject} result`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={subject.score ?? undefined}><AnimatedProgressBar value={subject.score} className="bg-academy-aegean" /></div>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 text-sm leading-6 text-slate-300">No aligned released subject results are available yet.</p>}
    </section>
  );
}

export function PathwayJourney({ hasResults, hasProgrammes, careerTitle }: { hasResults: boolean; hasProgrammes: boolean; careerTitle: string }) {
  const steps = [
    { title: 'Career goal', detail: careerTitle, complete: true },
    { title: 'Subject and APS fit', detail: hasResults ? 'Evidence available' : 'Add released results', complete: hasResults },
    { title: 'Study routes', detail: hasProgrammes ? 'Compare your options' : 'No matched programmes', complete: hasProgrammes },
  ];
  return (
    <nav className={`${surface} p-4 sm:p-5`} aria-label="Pathway journey">
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li className="flex min-w-0 items-center gap-3" key={step.title}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-bold ${step.complete ? 'border-academy-aegean bg-academy-aegean text-white' : 'border-[#ded5c6] bg-white text-academy-navy dark:border-white/15 dark:bg-slate-950 dark:text-white'}`}>{step.complete ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : index + 1}</span>
            <span className="min-w-0"><strong className="block text-sm text-academy-navy dark:text-white">{step.title}</strong><span className="block truncate text-xs text-academy-muted">{step.detail}</span></span>
            {index < steps.length - 1 ? <span className="ml-auto hidden h-px w-10 bg-slate-300 md:block dark:bg-white/15" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      <p className="sr-only">All pathway sections remain available; this journey does not lock later steps.</p>
    </nav>
  );
}

const eligibilityStyles: Record<ProgrammeEligibility['kind'], string> = {
  'appears-eligible': 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200',
  close: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100',
  'requirements-to-check': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/30 dark:bg-blue-950/40 dark:text-blue-100',
  'missing-results': 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.07] dark:text-slate-200',
  'not-currently-eligible': 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-100',
};

export function EligibilityBadge({ result }: { result: ProgrammeEligibility }) {
  return <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-bold ${eligibilityStyles[result.kind]}`}>{result.label}</span>;
}

export function ProgrammeComparison({ results }: { results: ProgrammeEligibility[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(results[0]?.programme.id ?? null);
  if (!results.length) {
    return (
      <section className={`${surface} p-5`} aria-labelledby="programme-eligibility-title">
        <h2 id="programme-eligibility-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Programme eligibility</h2>
        <EmptyState title="No matching programmes in the current catalogue" description="This does not mean the career has no study route. Review the catalogue’s alternative routes or ask Odie to explain what to verify next." actionLabel="Ask Odie" actionHref="#odie-pathway" icon={GraduationCap} />
      </section>
    );
  }
  return (
    <section className={`${surface} min-w-0 p-4 sm:p-5`} aria-labelledby="programme-eligibility-title">
      <div>
        <h2 id="programme-eligibility-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Programme eligibility</h2>
        <p className="mt-1 text-sm text-academy-muted">Guidance from available released results and stored requirements—not an admission decision.</p>
      </div>
      <div className="mt-5 hidden md:block">
        <div className="grid grid-cols-[minmax(11rem,1.1fr)_7.75rem_minmax(11rem,1fr)_5.8rem] gap-3 border-b border-[#ded5c6] px-2 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-academy-muted dark:border-white/10">
          <span>Institution & programme</span><span>Classification</span><span>Evidence & gap</span><span>Next action</span>
        </div>
        <div className="divide-y divide-[#e8e0d5] dark:divide-white/10">
          {results.map((result) => <ProgrammeDesktopRow key={result.programme.id} result={result} />)}
        </div>
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {results.map((result) => {
          const expanded = expandedId === result.programme.id;
          const panelId = `programme-${result.programme.id}-details`;
          return (
            <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={result.programme.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="font-semibold text-academy-navy dark:text-white">{result.programme.institutionName}</h3><p className="mt-1 text-sm text-academy-muted">{result.programme.programmeName}</p></div>
                <EligibilityBadge result={result} />
              </div>
              <p className="mt-3 text-sm font-semibold text-academy-navy dark:text-white">{result.apsComparison}</p>
              <p className="mt-1 text-sm leading-6 text-academy-muted">{result.gaps[0] ?? result.explanation}</p>
              <button aria-controls={panelId} aria-expanded={expanded} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-[#ded5c6] px-4 text-sm font-semibold text-academy-aegean focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/15 dark:text-academy-gold" onClick={() => setExpandedId(expanded ? null : result.programme.id)} type="button">
                {expanded ? 'Hide details' : 'View details'} <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <div className={expanded ? 'mt-4' : 'hidden'} id={panelId}><ProgrammeDetails result={result} /></div>
            </article>
          );
        })}
      </div>
      <p className="mt-5 flex gap-2 border-t border-[#ded5c6] pt-4 text-xs leading-5 text-academy-muted dark:border-white/10"><CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />Requirements can change by intake. Always confirm details on the linked institution page.</p>
    </section>
  );
}

function ProgrammeDesktopRow({ result }: { result: ProgrammeEligibility }) {
  return (
    <article className="grid grid-cols-[minmax(11rem,1.1fr)_7.75rem_minmax(11rem,1fr)_5.8rem] items-center gap-3 px-2 py-4">
      <div className="min-w-0"><h3 className="font-semibold text-academy-navy dark:text-white">{result.programme.institutionName}</h3><p className="mt-1 text-sm text-academy-muted">{result.programme.programmeName} · {result.programme.qualificationType}</p></div>
      <EligibilityBadge result={result} />
      <div><p className="text-sm font-semibold text-academy-navy dark:text-white">{result.apsComparison}</p><p className="mt-1 text-xs leading-5 text-academy-muted">{result.explanation}</p></div>
      {result.programme.sourceUrl ? <a className="academy-btn academy-btn-outline min-h-11 px-3 text-xs" href={result.programme.sourceUrl} rel="noreferrer" target="_blank">Verify <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : <Link className="academy-btn academy-btn-outline min-h-11 px-3 text-xs" to="/dashboard/student/results">Add results</Link>}
    </article>
  );
}

function ProgrammeDetails({ result }: { result: ProgrammeEligibility }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="leading-6 text-academy-muted">{result.explanation}</p>
      <div><h4 className="font-semibold text-academy-navy dark:text-white">Listed subject requirements</h4>{result.requirements.length ? <ul className="mt-2 space-y-1 text-academy-muted">{result.requirements.map((requirement) => <li key={`${result.programme.id}-${requirement.label}`}>{requirement.label}: {requirement.minimumPercentage}% minimum</li>)}</ul> : <p className="mt-1 text-academy-muted">No structured subject requirements are stored.</p>}</div>
      <p className="text-xs text-academy-muted">Requirement confidence: {result.programme.requirementConfidence ?? 'not recorded'}. Last-updated date: unavailable.</p>
      {result.programme.sourceUrl ? <a className="academy-btn academy-btn-outline min-h-11 w-full" href={result.programme.sourceUrl} rel="noreferrer" target="_blank">Open official source <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
    </div>
  );
}

export function ImprovementPanel({ actions }: { actions: ImprovementAction[] }) {
  return (
    <section className={`${surface} p-5`} id="improvement-plan" aria-labelledby="improvement-plan-title">
      <h2 id="improvement-plan-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">What to improve next</h2>
      <p className="mt-1 text-sm text-academy-muted">Evidence-based actions for the selected career and matched programmes.</p>
      <div className="mt-4 divide-y divide-[#e8e0d5] dark:divide-white/10">
        {actions.map((item) => <ImprovementActionRow key={item.id} item={item} />)}
        {!actions.length ? <p className="py-5 text-sm leading-6 text-academy-muted">No supported improvement action can be derived yet. Add released results or verify a programme source first.</p> : null}
      </div>
    </section>
  );
}

export function ImprovementActionRow({ item }: { item: ImprovementAction }) {
  const body = <><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-academy-aegean/[0.1] text-academy-aegean dark:bg-academy-aegean/20 dark:text-academy-gold"><TrendingUp className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-academy-navy dark:text-white">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-academy-muted">{item.evidence} {item.why}</span><span className="mt-1 block text-xs font-bold text-academy-aegean dark:text-academy-gold">{item.action}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /></>;
  const className = 'flex min-h-16 items-center gap-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-academy-gold';
  if (item.sourceUrl) return <a className={className} href={item.sourceUrl} rel="noreferrer" target="_blank">{body}</a>;
  if (item.href) return <Link className={className} to={item.href}>{body}</Link>;
  return <div className={className}>{body}</div>;
}

function routeKind(route: string) {
  const value = route.toLowerCase();
  if (value.includes('tvet') || value.includes('national n') || value.includes('college')) return { label: 'TVET / college', icon: Building2 };
  if (value.includes('diploma') || value.includes('certificate') || value.includes('bootcamp')) return { label: 'Diploma / certificate', icon: BookOpen };
  return { label: 'University / degree', icon: GraduationCap };
}

export function AlternativeRoutes({ career }: { career: CareerSummary }) {
  const routes = career.educationRoutes ?? [];
  return (
    <section className={`${surface} p-5`} aria-labelledby="alternative-routes-title">
      <h2 id="alternative-routes-title" className="font-display text-2xl font-semibold text-academy-navy dark:text-white">Alternative routes</h2>
      <p className="mt-1 text-sm leading-6 text-academy-muted">Different qualifications may lead toward related work, with different depth, cost, duration and progression opportunities.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {routes.map((route) => { const kind = routeKind(route); const Icon = kind.icon; return <article className="rounded-2xl border border-[#ded5c6] bg-white p-4 dark:border-white/10 dark:bg-slate-950" key={route}><Icon className="h-6 w-6 text-academy-aegean dark:text-academy-gold" aria-hidden="true" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-academy-muted">{kind.label}</p><h3 className="mt-1 text-sm font-semibold text-academy-navy dark:text-white">{route}</h3></article>; })}
      </div>
      {!routes.length ? <p className="mt-4 text-sm text-academy-muted">No alternative-route descriptions are stored for this career.</p> : null}
    </section>
  );
}

export function OdiePathwayCallout({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-academy-navy p-5 text-white shadow-[0_14px_34px_rgba(7,19,38,0.18)]" id="odie-pathway">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="-my-2 h-24 w-24 shrink-0 self-center sm:self-auto" aria-hidden="true">
          <img className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.3)]" src="/images/dashboard/odie-pathway-mascot.png" alt="" />
        </div>
        <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-semibold">Ask Odie to explain this pathway</h2><p className="mt-1 text-sm leading-6 text-slate-300">Odie can explain the saved career, subjects and APS target already approved for Careers. You review the prompt before anything is sent.</p></div>
        <button className="academy-btn academy-btn-gold min-h-12 shrink-0" onClick={onOpen} type="button"><MessageCircle className="h-4 w-4" aria-hidden="true" />Ask Odie</button>
      </div>
    </section>
  );
}

export function CareerSelectionState({
  careers,
  savedIds,
  onBuild,
  onToggleSave,
}: {
  careers: CareerSummary[];
  savedIds: string[];
  onBuild: (careerId: string) => void;
  onToggleSave: (careerId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = useMemo(() => [...new Set(careers.map((career) => career.category).filter(Boolean) as string[])].sort(), [careers]);
  const matches = careers.filter((career) => (!category || career.category === category) && (!query.trim() || `${career.title} ${career.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))).sort((left, right) => Number(savedIds.includes(right.id)) - Number(savedIds.includes(left.id)) || left.title.localeCompare(right.title));
  return (
    <section className="space-y-5" aria-labelledby="career-selection-title">
      <div className="rounded-[1.35rem] border border-white/10 bg-academy-navy p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-academy-gold">Career Explorer</p>
        <h2 id="career-selection-title" className="mt-2 font-display text-3xl font-semibold">Choose a career idea to build</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Start from the real catalogue or a Saved Career. Choosing a target opens Subject Match, the APS Planner and the Opportunity Map without forcing a quiz.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative"><label className="sr-only" htmlFor="career-search">Search careers</label><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" /><TextInput className="pl-10" id="career-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search careers" /></div>
          <div><label className="sr-only" htmlFor="career-category">Filter by career category</label><select className={inputClassName} id="career-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((career) => {
          const saved = savedIds.includes(career.id);
          return <article className={`${surface} flex min-h-56 flex-col p-5`} key={career.id}><p className="text-xs font-bold uppercase tracking-[0.14em] text-academy-aegean dark:text-academy-gold">{career.category || 'Career'}</p><h3 className="mt-2 font-display text-xl font-semibold text-academy-navy dark:text-white">{career.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-academy-muted">{career.description || 'Explore the subjects, APS evidence and study routes linked to this career.'}</p><div className="mt-auto flex flex-wrap gap-2 pt-5"><button aria-label={`${saved ? 'Remove' : 'Save'} ${career.title}`} aria-pressed={saved} className="academy-btn academy-btn-outline min-h-11" onClick={() => onToggleSave(career.id)} type="button"><Sparkles className="h-4 w-4" aria-hidden="true" />{saved ? 'Saved' : 'Save'}</button><button className="academy-btn academy-btn-gold min-h-11 flex-1" onClick={() => onBuild(career.id)} type="button">Build pathway <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div></article>;
        })}
      </div>
      {!matches.length ? <EmptyState title="No careers match those filters" description="Clear the search or choose another category to keep exploring." actionLabel="View all careers" actionHref="/dashboard/student/careers" icon={Route} /> : null}
    </section>
  );
}
