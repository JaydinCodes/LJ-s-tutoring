import { Brain, CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { AnimatedProgressBar, EmptyState, ErrorState, PageShell, SkeletonCard } from '../../components/dashboard/DashboardDesignSystem';
import { formatDate } from '../../lib/utils/format';
import { useLearnerMasterySummary } from '../learning/studentLearningQueries';
import { useStudentDashboardQuery } from './studentQueries';
import type { StudentProgress } from '../../types/lms';

const labels: Record<string, string> = {
  unassessed: 'Not assessed yet', emerging: 'Building foundations', developing: 'Making progress', secure: 'Confident', retained: 'Secure over time',
};
const emptyStudentProgress: StudentProgress[] = [];

export function StudentProgressRoute() {
  const mastery = useLearnerMasterySummary();
  const dashboard = useStudentDashboardQuery();
  const [activeSubject, setActiveSubject] = useState('All subjects');
  const skills = mastery.data ?? [];
  const legacyProgress = dashboard.data?.progress ?? emptyStudentProgress;
  const filteredProgress = filterProgressBySubject(legacyProgress, activeSubject);
  const subjects = Array.from(new Set(legacyProgress.map((progress) => progress.subject || 'General')));
  if (mastery.isPending) return <PageShell title="Progress" subtitle="Your evidence-driven learning progress." section="student"><SkeletonCard className="min-h-64" /></PageShell>;
  if (mastery.isError) return <PageShell title="Progress" subtitle="Your evidence-driven learning progress." section="student"><ErrorState title="Progress unavailable" description="Check your connection and try again." onRetry={() => void mastery.refetch()} /></PageShell>;
  return <PageShell title="Progress" subtitle="Your skills develop through independent evidence over time, not a percentage score." section="student">
    <section className="rounded-[2rem] bg-brand-navy p-6 text-brand-parchment sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Learning progress</p><h2 className="mt-3 text-3xl font-semibold">{skills.length ? `${skills.length} skill${skills.length === 1 ? '' : 's'} assessed` : 'Progress is starting'}</h2><p className="mt-3 max-w-2xl text-brand-marble">Keep practising one focused step at a time. Later independent retrieval helps show what stays secure over time.</p></section>
    {!skills.length ? <EmptyState icon={Brain} title="No topic mastery yet" description="Complete a diagnostic or practice activity to begin building your learning picture." actionLabel="Open learning" actionHref="/dashboard/student/learning" /> : <section aria-label="Skill progress" className="grid gap-3 sm:grid-cols-2">{skills.map((skill) => <article key={skill.skillCode} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{skill.skillName}</h2><p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">{labels[skill.state] ?? 'Learning in progress'}</p></div><span className="rounded-full bg-brand-aegean/10 px-3 py-1 text-sm capitalize text-brand-aegean">{skill.state}</span></div><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-4 w-4" aria-hidden="true" />Updated {formatDate(skill.determinedAt)}</p></article>)}</section>}
    {legacyProgress.length ? <section className="mt-6"><h2 className="text-lg font-semibold">School progress context</h2><p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Formal school progress is shown separately from the learning evidence above.</p><SubjectFilterChips subjects={subjects} activeSubject={activeSubject} onSelect={setActiveSubject}/><TopicProgressList progress={filteredProgress}/></section> : null}
  </PageShell>;
}

export function filterProgressBySubject(progress: StudentProgress[], activeSubject: string) { return activeSubject === 'All subjects' ? progress : progress.filter((item) => (item.subject || 'General') === activeSubject); }

export function SubjectFilterChips({ subjects, activeSubject, onSelect }: { subjects:string[]; activeSubject:string; onSelect:(subject:string)=>void }) { return <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter school progress by subject">{['All subjects',...subjects].map((subject) => <button key={subject} type="button" aria-pressed={activeSubject===subject} className="rounded-full border px-3 py-1 text-sm" onClick={()=>onSelect(subject)}>{subject}</button>)}</div>; }

export function TopicProgressList({ progress }: { progress: StudentProgress[] }) { return <div className="mt-3 grid gap-2"><>{progress.map((item)=><TopicProgressRow key={item.id} progress={item}/>)}</></div>; }

export function TopicProgressRow({ progress }: { progress: StudentProgress }) { const score=Math.max(0,Math.min(100,progress.score ?? 0)); return <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{progress.topic}</h3><p className="text-sm text-slate-600 dark:text-brand-marble">{progress.cognitive_level || 'General learning context'} · {formatDate(progress.recorded_at)}</p></div><span className="text-sm text-slate-500">Formal context</span></div><AnimatedProgressBar value={score} className="mt-3 bg-slate-400" /></article>; }
