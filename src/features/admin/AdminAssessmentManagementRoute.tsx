import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarChart3, CheckCircle2, ClipboardList, Save, Send, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { Card } from '../../components/ui/Card';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { approveTopicMasteryPolicyRevision, authorizeLearningAssessmentReassessment, createLearningAssessmentRevision, createTopicMasteryPolicyRevision, loadAssessmentManagementCatalog, publishLearningAssessmentConfiguration, reviewLearningAssessmentConfiguration, reviewTopicMasteryPolicyConfiguration, saveLearningAssessmentConfiguration, saveTopicMasteryPolicyAssignmentEvidenceRequirements, saveTopicMasteryPolicyConfiguration, type AssessmentManagementCatalog } from './learningContentRepository';

type AssessmentDraft = AssessmentManagementCatalog['definitions'][number];
type PolicyDraft = AssessmentManagementCatalog['policies'][number];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The requested update could not be saved.';
}
function asNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AdminAssessmentManagementRoute() {
  const resource = useAsyncResource(loadAssessmentManagementCatalog, []);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const definitions = resource.data?.definitions ?? [];
  const policies = resource.data?.policies ?? [];
  const selectedAssessment = definitions.find((item) => item.id === selectedAssessmentId) ?? definitions[0] ?? null;
  const selectedPolicy = policies.find((item) => item.id === selectedPolicyId) ?? policies[0] ?? null;

  useEffect(() => {
    if (selectedAssessment && selectedAssessment.id !== selectedAssessmentId) setSelectedAssessmentId(selectedAssessment.id);
  }, [selectedAssessment, selectedAssessmentId]);
  useEffect(() => {
    if (selectedPolicy && selectedPolicy.id !== selectedPolicyId) setSelectedPolicyId(selectedPolicy.id);
  }, [selectedPolicy, selectedPolicyId]);

  async function refresh(success: string) {
    setError(null);
    setMessage(success);
    await resource.reload();
  }

  return (
    <DashboardShell title="Assessment management" subtitle="Configure review-gated formal forms and immutable mastery policies." section="admin">
      {resource.loading ? <LoadingState title="Loading assessments" description="Reading secure assessment configurations and results…" /> : null}
      {resource.error ? <ErrorState title="Assessment management unavailable" description={resource.error} onRetry={() => void resource.reload()} dashboardHref="/dashboard/admin" /> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</p> : null}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {resource.data ? (
        <div className="space-y-5">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.8fr)]">
            <Card>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-aegean" />
                <h2 className="text-xl font-semibold">Assessment forms</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Only an approved definition with approved four-choice questions can be published. Publication creates an immutable form version.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2">Form</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Questions</th>
                      <th className="pb-2">Duration</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((definition) => (
                      <tr className="border-b last:border-0" key={definition.id}>
                        <td className="py-3">
                          <p className="font-semibold">{definition.name}</p>
                          <p className="text-xs text-slate-500">
                            {definition.topicName ?? 'Entry baseline'}
                            {definition.publishedFormVersion ? ` · form v${definition.publishedFormVersion}` : ''}
                          </p>
                        </td>
                        <td className="py-3 capitalize">{definition.assessmentType.replaceAll('_', ' ')}</td>
                        <td className="py-3">{definition.questionCount}</td>
                        <td className="py-3">{definition.durationMinutes} min</td>
                        <td className="py-3 capitalize">{definition.reviewStatus.replaceAll('_', ' ')}</td>
                        <td className="py-3">
                          <button className="rounded-lg border px-3 py-2 font-semibold" onClick={() => setSelectedAssessmentId(definition.id)} type="button">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <BarChart3 className="h-5 w-5 text-brand-aegean" />
                Recent outcomes
              </h2>
              <div className="mt-4 space-y-3">
                {resource.data.recentSessions.length ? (
                  resource.data.recentSessions.slice(0, 8).map((session) => (
                    <article className="rounded-xl border p-3" key={session.id}>
                      <p className="font-semibold capitalize">{session.assessmentType.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-sm">
                        {session.topicName ?? 'Term 1'} · form v{session.formVersion}
                      </p>
                      <p className="mt-1 text-sm">
                        {session.status} · {session.percentage == null ? 'not scored' : `${session.percentage}%`}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {session.topicMasteryStatus?.replaceAll('_', ' ') ?? 'No topic decision'}
                        {session.criticalSkillCoverage == null ? '' : ` · critical ${session.criticalSkillCoverage}%`}
                        {session.reasoningAchievement == null ? '' : ` · reasoning ${session.reasoningAchievement}%`}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No formal assessment sessions have been completed yet.</p>
                )}
              </div>
            </Card>
          </section>
          <ContentQaPanel rows={resource.data.contentQa ?? []} />
          {selectedAssessment ? <AssessmentEditor definition={selectedAssessment} questions={resource.data.questions} policies={policies} onError={setError} onSaved={(text) => void refresh(text)} /> : null}
          {selectedPolicy ? <PolicyEditor policy={selectedPolicy} policies={policies} onError={setError} onSaved={(text) => void refresh(text)} /> : null}
          <ReassessmentAuthorisation definitions={definitions} sessions={resource.data.recentSessions} onError={setError} onSaved={(text) => void refresh(text)} />
        </div>
      ) : null}
    </DashboardShell>
  );
}

function ReassessmentAuthorisation({ definitions, sessions, onSaved, onError }: { definitions: AssessmentDraft[]; sessions: AssessmentManagementCatalog['recentSessions']; onSaved: (message: string) => void; onError: (message: string) => void }) {
  const completed = sessions.filter((session) => session.status === 'submitted' || session.status === 'timed_out');
  const alternatives = definitions.filter((definition) => definition.code.includes('REASSESSMENT'));
  const [priorSessionId, setPriorSessionId] = useState('');
  const [definitionId, setDefinitionId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function authorise() {
    if (!priorSessionId || !definitionId || !reason.trim()) return;
    setBusy(true); onError('');
    try {
      await authorizeLearningAssessmentReassessment({ priorSessionId, reassessmentDefinitionId: definitionId, reason: reason.trim() });
      setReason(''); onSaved('Independent reassessment authorised. The learner can now start exactly one new attempt.');
    } catch (error) { onError(errorText(error)); } finally { setBusy(false); }
  }
  return <Card>
    <h2 className="text-xl font-semibold">Controlled reassessment</h2>
    <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">A single attempt is authorised only for an independent Form B. The server rechecks the prior outcome, topic status and form independence.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Field label="Completed learner session"><select value={priorSessionId} onChange={(event) => setPriorSessionId(event.target.value)}><option value="">Choose a completed session</option>{completed.map((session) => <option key={session.id} value={session.id}>{session.topicName ?? 'Term 1'} · {session.assessmentType} · {session.percentage ?? 0}%</option>)}</select></Field>
      <Field label="Independent alternative form"><select value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}><option value="">Choose Form B</option>{alternatives.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></Field>
      <Field label="Authorisation reason"><input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Targeted reassessment after learning" /></Field>
    </div>
    <button className="mt-4 min-h-11 rounded-xl bg-brand-navy px-4 font-semibold text-white disabled:opacity-50" disabled={busy || !priorSessionId || !definitionId || !reason.trim()} onClick={() => void authorise()} type="button">{busy ? 'Authorising…' : 'Authorise one reassessment'}</button>
  </Card>;
}

function AssessmentEditor({ definition, questions, policies, onSaved, onError }: { definition: AssessmentDraft; questions: AssessmentManagementCatalog['questions']; policies: PolicyDraft[]; onSaved: (message: string) => void; onError: (message: string) => void }) {
  const [draft, setDraft] = useState(definition);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(definition), [definition]);
  const selected = useMemo(() => new Set(draft.questionVersionIds), [draft.questionVersionIds]);
  function patch<K extends keyof AssessmentDraft>(key: K, value: AssessmentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await saveLearningAssessmentConfiguration(
        {
          curriculumVersionId: draft.curriculumVersionId,
          curriculumTopicId: draft.topicId ?? undefined,
          topicMasteryPolicyId: draft.topicMasteryPolicyId ?? undefined,
          code: draft.code,
          formCode: draft.formCode,
          name: draft.name,
          assessmentType: draft.assessmentType,
          description: draft.description ?? undefined,
          durationMinutes: asNumber(String(draft.durationMinutes), 15),
          scoredAttemptsPerQuestion: 1,
          questionVersionIds: draft.questionVersionIds,
          questionOrderMode: draft.questionOrderMode,
          solutionReleasePolicy: draft.solutionReleasePolicy
        },
        draft.id
      );
      onSaved('Assessment draft saved.');
    } catch (error) {
      onError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function action(action: 'submit_for_review' | 'approve' | 'reject' | 'return_for_revision' | 'retire' | 'publish' | 'create_revision') {
    setBusy(true);
    onError('');
    try {
      if (action === 'publish') await publishLearningAssessmentConfiguration(draft.id);
      else if (action === 'create_revision') {
        const code = window.prompt('New unique assessment code:', `${draft.code}-REV`);
        const formCode = window.prompt('New form code:', `${draft.formCode}-REV`);
        const name = window.prompt('Revision name:', `${draft.name} revision`);
        if (!code || !formCode || !name) return;
        await createLearningAssessmentRevision(draft.id, {
          code,
          formCode,
          name
        });
      } else {
        const notes = ['reject', 'return_for_revision', 'retire'].includes(action) ? window.prompt('Review note (required):') || undefined : undefined;
        if (['reject', 'return_for_revision', 'retire'].includes(action) && !notes) return;
        await reviewLearningAssessmentConfiguration(draft.id, action, notes);
      }
      onSaved(action === 'publish' ? 'Immutable assessment form published.' : action === 'create_revision' ? 'Revision draft created. Select it from the form list to edit.' : `Assessment ${action.replaceAll('_', ' ')}.`);
    } catch (error) {
      onError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Assessment editor</h2>
          <p className="text-sm text-slate-600 dark:text-brand-marble">{draft.code} · formal answers always allow exactly one scored choice.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize dark:bg-white/10">{draft.reviewStatus}</span>
      </div>
      {draft.publicationValidation && !draft.publicationValidation.valid ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Publication blockers</p>
          <p className="mt-1">{draft.publicationValidation.errors.join(' · ')}</p>
        </div>
      ) : null}
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
        <Field label="Name">
          <input required value={draft.name} onChange={(event) => patch('name', event.target.value)} />
        </Field>
        <Field label="Duration in minutes">
          <input min="1" max="180" required type="number" value={draft.durationMinutes} onChange={(event) => patch('durationMinutes', asNumber(event.target.value, draft.durationMinutes))} />
        </Field>
        {draft.topicId ? (
          <Field label="Mastery policy">
            <select value={draft.topicMasteryPolicyId ?? ''} onChange={(event) => patch('topicMasteryPolicyId', event.target.value || null)}>
              {policies
                .filter((policy) => policy.curriculumTopicId === draft.topicId)
                .map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.code} v{policy.version} · {policy.reviewStatus}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        <Field label="Question ordering">
          <select value={draft.questionOrderMode} onChange={(event) => patch('questionOrderMode', event.target.value as AssessmentDraft['questionOrderMode'])}>
            <option value="fixed">Fixed order</option>
            <option value="session_shuffle">Stable session shuffle</option>
          </select>
        </Field>
        <Field label="Solution release">
          <select value={draft.solutionReleasePolicy} onChange={(event) => patch('solutionReleasePolicy', event.target.value as AssessmentDraft['solutionReleasePolicy'])}>
            <option value="after_submission">After submission policy</option>
            <option value="manual">Manual release</option>
            <option value="never">Never release</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea value={draft.description ?? ''} onChange={(event) => patch('description', event.target.value)} />
        </Field>
        <Field label="Approved question versions">
          <select
            multiple
            className="min-h-48"
            value={draft.questionVersionIds}
            onChange={(event) =>
              patch(
                'questionVersionIds',
                Array.from(event.target.selectedOptions).map((option) => option.value)
              )
            }
          >
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {selected.has(question.id) ? '✓ ' : ''}
                {question.itemCode} · {question.skillCode} · {question.reasoningClassification}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">{draft.questionVersionIds.length} selected. Hold Ctrl/Cmd to select multiple questions.</span>
        </Field>
        {questions.some((question) => selected.has(question.id)) ? (
          <section aria-label="Administrator question preview" className="rounded-2xl border border-slate-200 p-4 md:col-span-2 dark:border-white/15">
            <h3 className="font-semibold">Administrator question preview</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Prompts, answer choices and worked solutions are visible only in this authorised administration view.</p>
            <div className="mt-3 grid gap-2">
              {questions.filter((question) => selected.has(question.id)).map((question) => (
                <details className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950" key={question.id}>
                  <summary className="cursor-pointer font-mono text-xs font-semibold">{question.itemCode} · {question.skillCode} · {question.reasoningClassification}</summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{question.prompt}</p>
                  <ol className="mt-3 grid gap-1 text-sm" type="A">
                    {Object.entries(question.answerConfig?.options ?? {}).map(([option, label]) => <li key={option}>{label}</li>)}
                  </ol>
                  <p className="mt-3 rounded-lg border-l-4 border-brand-aegean bg-white p-3 text-sm dark:bg-slate-900"><span className="font-semibold">Worked solution: </span>{question.solution || 'No worked solution has been recorded.'}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">
            <Save className="h-4 w-4" />
            Save draft
          </button>
          {draft.reviewStatus === 'draft' || draft.reviewStatus === 'rejected' ? (
            <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('submit_for_review')} type="button">
              Submit for review
            </button>
          ) : null}
          {draft.reviewStatus === 'in_review' ? (
            <>
              <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('approve')} type="button">
                Approve configuration
              </button>
              <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('return_for_revision')} type="button">
                Return to draft
              </button>
            </>
          ) : null}
          {draft.reviewStatus === 'approved' ? (
            <>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void action('publish')} type="button">
                <Send className="h-4 w-4" />
                Publish immutable form
              </button>
              <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('create_revision')} type="button">
                Create revision
              </button>
              <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('retire')} type="button">
                Retire form
              </button>
            </>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function ContentQaPanel({ rows }: { rows: NonNullable<AssessmentManagementCatalog['contentQa']> }) {
  if (!rows.length) return null;
  return <Card>
    <h2 className="text-xl font-semibold">Content QA</h2>
    <p className="mt-1 text-sm text-slate-600 dark:text-brand-marble">Structural QA is visible here for review; it does not publish a form or replace the administrator’s mathematical review.</p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="pb-2">Form</th><th className="pb-2">Questions</th><th className="pb-2">Reasoning</th><th className="pb-2">Answer positions</th><th className="pb-2">Validation</th></tr></thead>
        <tbody>{rows.map((row) => <tr className="border-b last:border-0" key={row.definitionId}>
          <td className="py-2 font-mono text-xs">{row.code}</td><td className="py-2">{row.questionCount}</td><td className="py-2">{row.reasoningQuestionCount}</td>
          <td className="py-2">A {row.correctOptionDistribution.A ?? 0} · B {row.correctOptionDistribution.B ?? 0} · C {row.correctOptionDistribution.C ?? 0} · D {row.correctOptionDistribution.D ?? 0}</td>
          <td className="py-2">{row.invalidQuestionCount ? `${row.invalidQuestionCount} invalid` : row.publicationValidation.valid ? 'Ready for publication checks' : row.publicationValidation.errors.join(' · ')}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </Card>;
}

function PolicyEditor({ policy, policies, onSaved, onError }: { policy: PolicyDraft; policies: PolicyDraft[]; onSaved: (message: string) => void; onError: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState(policy.id);
  const current = policies.find((item) => item.id === selectedId) ?? policy;
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelectedId(policy.id);
    setDraft(policy);
  }, [policy]);
  useEffect(() => setDraft(current), [current]);
  function patch<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    setDraft((item) => ({ ...item, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await saveTopicMasteryPolicyConfiguration(
        {
          curriculumTopicId: draft.curriculumTopicId,
          code: draft.code,
          version: draft.version,
          name: draft.name,
          overallAchievementThreshold: asNumber(String(draft.overallAchievementThreshold), 80),
          criticalSkillAchievementThreshold: asNumber(String(draft.criticalSkillAchievementThreshold ?? 75), 75),
          minimumQuestionsPerCriticalSkill: asNumber(String(draft.minimumQuestionsPerCriticalSkill ?? 4), 4),
          criticalSkillCoverageThreshold: asNumber(String(draft.criticalSkillCoverageThreshold), 100),
          minimumReasoningEvidenceCount: asNumber(String(draft.minimumReasoningEvidenceCount), 2),
          minimumReasoningAchievementThreshold: asNumber(String(draft.minimumReasoningAchievementThreshold), 80),
          strongBaselineThreshold: asNumber(String(draft.strongBaselineThreshold), 90),
          requiresMasteryChallenge: draft.requiresMasteryChallenge,
          allowQualifyingAssignmentEvidence: draft.allowQualifyingAssignmentEvidence,
          qualifyingAssignmentMinimumAchievement: asNumber(String(draft.qualifyingAssignmentMinimumAchievement), 80),
          skills: draft.skills
        },
        draft.id
      );
      await saveTopicMasteryPolicyAssignmentEvidenceRequirements(draft.id, asNumber(String(draft.assignmentEvidenceMaximumQuestionEquivalents ?? 2), 2));
      onSaved('Mastery-policy draft saved.');
    } catch (error) {
      onError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function action(action: 'submit_for_review' | 'approve' | 'reject' | 'return_for_revision' | 'retire' | 'create_revision') {
    setBusy(true);
    onError('');
    try {
      if (action === 'create_revision') {
        const name = window.prompt('New policy version name:', `${draft.name} revision`) || undefined;
        await createTopicMasteryPolicyRevision(draft.id, name);
      } else {
        const notes = ['reject', 'return_for_revision', 'retire'].includes(action) ? window.prompt('Review note (required):') || undefined : undefined;
        if (['reject', 'return_for_revision', 'retire'].includes(action) && !notes) return;
        if (action === 'approve') await approveTopicMasteryPolicyRevision(draft.id);
        else await reviewTopicMasteryPolicyConfiguration(draft.id, action, notes);
      }
      onSaved(action === 'create_revision' ? 'New policy draft created. Select it above to edit.' : `Mastery policy ${action.replaceAll('_', ' ')}.`);
    } catch (error) {
      onError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand-aegean" />
        <div>
          <h2 className="text-xl font-semibold">Topic mastery policy</h2>
          <p className="text-sm text-slate-600 dark:text-brand-marble">Published versions are immutable; create a new version for a material policy change.</p>
        </div>
      </div>
      <label className="mt-4 grid gap-1 text-sm font-semibold">
        Policy version
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {policies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} v{item.version} · {item.reviewStatus}
            </option>
          ))}
        </select>
      </label>
      <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={(event) => void save(event)}>
        <Threshold label="Overall achievement" value={draft.overallAchievementThreshold} onChange={(value) => patch('overallAchievementThreshold', value)} />
        <Threshold label="Critical-skill achievement" value={draft.criticalSkillAchievementThreshold ?? 75} onChange={(value) => patch('criticalSkillAchievementThreshold', value)} />
        <Threshold label="Questions per critical skill" value={draft.minimumQuestionsPerCriticalSkill ?? 4} onChange={(value) => patch('minimumQuestionsPerCriticalSkill', value)} />
        <Threshold label="Critical-skill coverage" value={draft.criticalSkillCoverageThreshold} onChange={(value) => patch('criticalSkillCoverageThreshold', value)} />
        <Threshold label="Reasoning achievement" value={draft.minimumReasoningAchievementThreshold} onChange={(value) => patch('minimumReasoningAchievementThreshold', value)} />
        <Threshold label="Independent reasoning items" value={draft.minimumReasoningEvidenceCount} onChange={(value) => patch('minimumReasoningEvidenceCount', value)} />
        <Threshold label="Strong baseline" value={draft.strongBaselineThreshold} onChange={(value) => patch('strongBaselineThreshold', value)} />
        <Threshold label="Qualified Assignment minimum" value={draft.qualifyingAssignmentMinimumAchievement} onChange={(value) => patch('qualifyingAssignmentMinimumAchievement', value)} />
        <Threshold label="Assignment evidence cap per skill" value={draft.assignmentEvidenceMaximumQuestionEquivalents ?? 2} onChange={(value) => patch('assignmentEvidenceMaximumQuestionEquivalents', value)} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input checked={draft.requiresMasteryChallenge} type="checkbox" onChange={(event) => patch('requiresMasteryChallenge', event.target.checked)} />
          Offer mastery challenge after a strong baseline
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input checked={draft.allowQualifyingAssignmentEvidence} type="checkbox" onChange={(event) => patch('allowQualifyingAssignmentEvidence', event.target.checked)} />
          Allow explicitly qualified Assignment evidence
        </label>
        <div className="md:col-span-3 rounded-2xl border p-4">
          <p className="font-semibold">Essential and critical skill mapping</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {draft.skills.map((skill, index) => (
              <label className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950" key={skill.skillId}>
                <span className="min-w-32 font-mono text-xs">{skill.skillCode ?? skill.skillId}</span>
                <span>
                  <input
                    checked={skill.isEssential}
                    type="checkbox"
                    onChange={(event) =>
                      patch(
                        'skills',
                        draft.skills.map((item, itemIndex) => (itemIndex === index ? { ...item, isEssential: event.target.checked } : item))
                      )
                    }
                  />{' '}
                  Essential
                </span>
                <span>
                  <input
                    checked={skill.isCritical}
                    type="checkbox"
                    onChange={(event) =>
                      patch(
                        'skills',
                        draft.skills.map((item, itemIndex) => (itemIndex === index ? { ...item, isCritical: event.target.checked } : item))
                      )
                    }
                  />{' '}
                  Critical
                </span>
                <span>
                  <input
                    checked={skill.requiresReasoningEvidence}
                    type="checkbox"
                    onChange={(event) =>
                      patch(
                        'skills',
                        draft.skills.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                requiresReasoningEvidence: event.target.checked
                              }
                            : item
                        )
                      )
                    }
                  />{' '}
                  Reasoning
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">
            <Save className="h-4 w-4" />
            Save version
          </button>
          {draft.reviewStatus === 'draft' || draft.reviewStatus === 'rejected' ? (
            <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('submit_for_review')} type="button">
              Submit for review
            </button>
          ) : null}
          {draft.reviewStatus === 'in_review' ? (
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('approve')} type="button">
              <CheckCircle2 className="h-4 w-4" />
              Approve version
            </button>
          ) : null}
          {draft.reviewStatus === 'approved' ? (
            <button className="min-h-11 rounded-xl border px-4 font-semibold" disabled={busy} onClick={() => void action('create_revision')} type="button">
              Create new version
            </button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
function Threshold({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input max="100" min="0" required type="number" value={value} onChange={(event) => onChange(asNumber(event.target.value, value))} />
    </Field>
  );
}
