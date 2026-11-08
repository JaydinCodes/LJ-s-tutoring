import { requireSupabase } from '../../lib/supabase/client';
import type { Json } from '../../../supabase/types/public.generated';
import { validateMultipleChoiceSpecification } from '../learning/grade9Term1FoundationContracts';

export type ContentQuestion = { id:string; item_code:string; version_number:number; review_status:string; prompt:string; marks:number; activity_type:string; grade:string; subject_name:string; primary_skill_code:string; source_tier:string; created_at:string };
export type ContentSkill = { id:string; code:string; name:string };
export type ContentMisconception = { id:string; code:string; name:string; skillId:string };
export type ContentCatalog = { items:ContentQuestion[]; total:number; skills:ContentSkill[]; misconceptions:ContentMisconception[] };
export type QuestionDraft = { itemCode:string; primarySkillId:string; supportingSkillIds:string[]; misconceptionIds:string[]; prompt:string; questionType:string; expected:string; optionsText:string; distractorExplanationsText:string; tolerance:string; correctOption:string; requiredForm:string; marks:string; difficulty:string; reasoningClassification:string; activityType:string; cognitiveLevel:string; representation:string; calculatorPolicy:string; solution:string; sourceTier:string; sourceNotes:string; hints:string[] };

/** Review-gated payloads owned by the assessment-configuration admin RPCs. */
export type TopicMasteryPolicyDraft = {
  curriculumTopicId: string;
  code: string;
  version: number;
  name: string;
  overallAchievementThreshold: number;
  criticalSkillCoverageThreshold: number;
  minimumReasoningEvidenceCount: number;
  minimumReasoningAchievementThreshold: number;
  strongBaselineThreshold: number;
  requiresMasteryChallenge: boolean;
  allowQualifyingAssignmentEvidence: boolean;
  qualifyingAssignmentMinimumAchievement: number;
  skills: Array<{
    skillId: string;
    skillCode?: string;
    isEssential: boolean;
    isCritical: boolean;
    requiresReasoningEvidence: boolean;
  }>;
};

export type LearningAssessmentDraft = {
  curriculumVersionId: string;
  curriculumTopicId?: string;
  topicMasteryPolicyId?: string;
  code: string;
  formCode: string;
  name: string;
  assessmentType: 'entry_baseline' | 'topic_baseline' | 'endline' | 'mastery_challenge';
  description?: string;
  durationMinutes: number;
  /** Formal configurations are server-constrained to one scored response. */
  scoredAttemptsPerQuestion: 1;
  questionVersionIds: string[];
};

export async function loadLearningContentCatalog(search = '', status = '', page = 1): Promise<ContentCatalog> {
  const { data, error } = await requireSupabase().rpc('get_learning_content_catalog', { p_search: search || undefined, p_status: (status || undefined) as 'draft'|'in_review'|'approved'|'rejected'|'retired'|undefined, p_page: page, p_page_size: 25 });
  if (error) throw error;
  return data as unknown as ContentCatalog;
}

export function answerConfigFromDraft(draft: QuestionDraft): Json {
  const type = draft.questionType;
  if (type === 'multiple_choice') {
    const parseKeyedLines = (value: string) => Object.fromEntries(value.split('\n')
      .map(line => line.split(':'))
      .filter(parts => parts.length >= 2)
      .map(([key, ...label]) => [key.trim(), label.join(':').trim()]));
    const options = parseKeyedLines(draft.optionsText);
    const distractorExplanations = parseKeyedLines(draft.distractorExplanationsText);
    const errors = validateMultipleChoiceSpecification({
      type: 'multiple_choice',
      options: options as { A: string; B: string; C: string; D: string },
      correctOption: draft.correctOption as 'A'|'B'|'C'|'D',
      distractorExplanations,
      difficulty: Number(draft.difficulty) as 1|2|3|4|5,
      reasoningClassification: draft.reasoningClassification as 'not_classified'|'procedural'|'mathematical_reasoning',
    });
    if (errors.length) throw new Error(`Multiple-choice specification: ${errors.join(', ')}`);
    return { type, correct_option: draft.correctOption, options, distractor_explanations: distractorExplanations };
  }
  const config: Record<string, Json> = { type, accepted: draft.expected.split('\n').map((value) => value.trim()).filter(Boolean) };
  if (type === 'numeric' && draft.tolerance.trim()) config.tolerance = Number(draft.tolerance);
  if (type === 'factorised_expression') config.required_form = draft.requiredForm || 'factorised';
  return config;
}

export async function saveQuestionDraft(draft: QuestionDraft, questionVersionId?: string) {
  const { data, error } = await requireSupabase().rpc('save_learning_question_draft', { p_question_version_id: questionVersionId ?? undefined, p_payload: {
    itemCode: draft.itemCode, primarySkillId: draft.primarySkillId, supportingSkillIds: draft.supportingSkillIds, misconceptionIds: draft.misconceptionIds,
    prompt: draft.prompt, answerConfig: answerConfigFromDraft(draft), marks: Number(draft.marks), activityType: draft.activityType,
    cognitiveLevel: draft.cognitiveLevel, representation: draft.representation, calculatorPolicy: draft.calculatorPolicy,
    difficulty: draft.difficulty, reasoningClassification: draft.reasoningClassification,
    solution: draft.solution, sourceTier: draft.sourceTier, sourceNotes: draft.sourceNotes,
    hints: draft.hints.filter(Boolean).map((prompt, index) => ({ level: index + 1, prompt })),
  } as Json });
  if (error) throw error;
  return data;
}

export async function reviewQuestion(questionVersionId: string, action: 'submit_for_review'|'approve'|'reject'|'return_for_revision'|'retire', notes?: string) {
  const { error } = await requireSupabase().rpc('review_question_version_action', { p_question_version_id: questionVersionId, p_action: action, p_review_notes: notes || undefined });
  if (error) throw error;
}

export async function createRevision(questionVersionId:string) {
  const { data, error } = await requireSupabase().rpc('create_learning_question_revision', { p_question_version_id: questionVersionId, p_material_change_note: 'Created from content workspace.' });
  if (error) throw error;
  return data;
}

export async function loadReviewBundle(questionVersionId:string) {
  const { data, error } = await requireSupabase().rpc('get_question_version_review_bundle', { p_question_version_id: questionVersionId });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function dryRunImport(records: Json[]) {
  const { data, error } = await requireSupabase().rpc('import_learning_question_drafts', { p_records: records, p_dry_run: true });
  if (error) throw error;
  return data;
}

export async function loadLearningActivityContentCatalog() {
  const { data, error } = await requireSupabase().rpc('get_learning_activity_content_catalog');
  if (error) throw error;
  return data as { activities: Array<{ id:string; code:string; title:string; description:string; status:string; targetSkillCode:string; stages:Array<{ sequence:number; type:string; instruction:string; questionCount:number }> }> };
}

export async function saveLearningActivityDraft(payload: Json, activityId?: string) {
  const { data, error } = await requireSupabase().rpc('save_learning_activity_draft', { p_payload: payload, p_activity_id: activityId });
  if (error) throw error;
  return data;
}

export async function reviewLearningActivity(activityId: string, action: 'submit_for_review'|'approve'|'reject'|'return_for_revision'|'retire', notes?: string) {
  const { error } = await requireSupabase().rpc('review_learning_activity_action', { p_activity_id: activityId, p_action: action, p_notes: notes });
  if (error) throw error;
}

export type LearningSkillContent = { id:string; skillCode:string; skillName:string; title:string; status:'draft'|'in_review'|'approved'|'rejected'|'retired'; hasVideo:boolean; hasWorksheet:boolean; reviewNotes?:string|null };
export async function loadLearningSkillContentCatalog(): Promise<LearningSkillContent[]> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_learning_skill_content_catalog') => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_learning_skill_content_catalog');
  if (error) throw error;
  return Array.isArray(data) ? data as LearningSkillContent[] : [];
}
export async function reviewLearningSkillContent(contentId:string, action:'submit_for_review'|'approve'|'reject'|'return_for_revision'|'retire', notes?:string) {
  const client = requireSupabase() as unknown as { rpc: (name: 'review_learning_skill_content_action', args: { p_content_id:string; p_action:string; p_notes?:string }) => Promise<{ error: Error | null }> };
  const { error } = await client.rpc('review_learning_skill_content_action', { p_content_id: contentId, p_action: action, p_notes: notes });
  if (error) throw error;
}

export type LearningVideoResource = { id:string; code:string; title:string; channelName:string; youtubeVideoId:string; status:'draft'|'in_review'|'approved'|'rejected'|'retired'; availabilityStatus:'unverified'|'available'|'unavailable'|'restricted'; durationSeconds:number|null; displayOrder:number; reviewNotes?:string|null; skills:string[] };
export async function loadLearningVideoResourceCatalog(): Promise<LearningVideoResource[]> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_learning_video_resource_catalog') => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_learning_video_resource_catalog');
  if (error) throw error;
  return Array.isArray(data) ? data as LearningVideoResource[] : [];
}
export async function reviewLearningVideoResource(id:string, action:'submit_for_review'|'approve'|'reject'|'return_for_revision'|'retire', notes?:string, availabilityStatus?:'available'|'unavailable'|'restricted', durationSeconds?:number) {
  const client = requireSupabase() as unknown as { rpc: (name: 'review_learning_video_resource_action', args: Record<string, unknown>) => Promise<{ error: Error | null }> };
  const { error } = await client.rpc('review_learning_video_resource_action', { p_resource_id:id, p_action:action, p_notes:notes, p_availability_status:availabilityStatus, p_duration_seconds:durationSeconds });
  if (error) throw error;
}
export async function updateLearningVideoResourceMetadata(id:string, input:{ youtubeVideoId?:string; displayOrder?:number; skillCodes?:string[] }) {
  const client = requireSupabase() as unknown as { rpc: (name: 'update_learning_video_resource_metadata', args: Record<string, unknown>) => Promise<{ error: Error | null }> };
  const { error } = await client.rpc('update_learning_video_resource_metadata', { p_resource_id:id, p_youtube_video_id:input.youtubeVideoId, p_display_order:input.displayOrder, p_skill_codes:input.skillCodes });
  if (error) throw error;
}

export type AssessmentManagementCatalog = {
  definitions: Array<{
    id: string;
    code: string;
    formCode: string;
    name: string;
    description: string | null;
    curriculumVersionId: string;
    topicId: string | null;
    topicName: string | null;
    topicMasteryPolicyId: string | null;
    assessmentType: 'entry_baseline' | 'topic_baseline' | 'endline' | 'mastery_challenge';
    durationMinutes: number;
    questionOrderMode: 'fixed' | 'session_shuffle';
    solutionReleasePolicy: 'after_submission' | 'manual' | 'never';
    reviewStatus: string;
    questionVersionIds: string[];
    questionCount: number;
    publishedFormVersion: number | null;
  }>;
  policies: Array<TopicMasteryPolicyDraft & { id: string; reviewStatus: string }>;
  questions: Array<{
    id: string;
    itemCode: string;
    prompt: string;
    skillCode: string;
    difficulty: number;
    reasoningClassification: 'procedural' | 'mathematical_reasoning';
  }>;
  recentSessions: Array<{
    id: string;
    status: string;
    percentage: number | null;
    assessmentType: string;
    submittedAt: string | null;
    studentId: string;
    topicName: string | null;
    formVersion: number;
    topicMasteryStatus: string | null;
    criticalSkillCoverage: number | null;
    reasoningAchievement: number | null;
  }>;
};

type AssessmentManagementClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export async function loadAssessmentManagementCatalog(): Promise<AssessmentManagementCatalog> {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('get_learning_assessment_management_catalog');
  if (error) throw error;
  const empty: AssessmentManagementCatalog = {
    definitions: [],
    policies: [],
    questions: [],
    recentSessions: []
  };
  return data && typeof data === 'object' ? { ...empty, ...(data as AssessmentManagementCatalog) } : empty;
}

export async function saveLearningAssessmentConfiguration(
  draft: LearningAssessmentDraft & {
    questionOrderMode: 'fixed' | 'session_shuffle';
    solutionReleasePolicy: 'after_submission' | 'manual' | 'never';
  },
  assessmentId?: string
) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('save_learning_assessment_draft', {
    p_assessment_id: assessmentId,
    p_payload: draft
  });
  if (error) throw error;
  return data as string;
}

export async function reviewLearningAssessmentConfiguration(id: string, action: 'submit_for_review' | 'approve' | 'reject' | 'return_for_revision' | 'retire', notes?: string) {
  const { error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('review_learning_assessment_action', {
    p_assessment_id: id,
    p_action: action,
    p_notes: notes
  });
  if (error) throw error;
}

export async function publishLearningAssessmentConfiguration(id: string) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('publish_learning_assessment_form', { p_assessment_definition_id: id });
  if (error) throw error;
  return data as string;
}

export async function createLearningAssessmentRevision(id: string, input: { code: string; formCode: string; name: string }) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('create_learning_assessment_revision', {
    p_assessment_definition_id: id,
    p_code: input.code,
    p_form_code: input.formCode,
    p_name: input.name
  });
  if (error) throw error;
  return data as string;
}

export async function saveTopicMasteryPolicyConfiguration(draft: TopicMasteryPolicyDraft, policyId?: string) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('save_topic_mastery_policy_draft', {
    p_policy_id: policyId,
    p_payload: draft
  });
  if (error) throw error;
  return data as string;
}

export async function reviewTopicMasteryPolicyConfiguration(id: string, action: 'submit_for_review' | 'approve' | 'reject' | 'return_for_revision' | 'retire', notes?: string) {
  const { error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('review_topic_mastery_policy_action', {
    p_policy_id: id,
    p_action: action,
    p_notes: notes
  });
  if (error) throw error;
}

export async function createTopicMasteryPolicyRevision(id: string, name?: string) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('create_topic_mastery_policy_revision', {
    p_policy_id: id,
    p_name: name
  });
  if (error) throw error;
  return data as string;
}

export async function approveTopicMasteryPolicyRevision(id: string, notes?: string) {
  const { error } = await (requireSupabase() as unknown as AssessmentManagementClient).rpc('approve_topic_mastery_policy_revision', {
    p_policy_id: id,
    p_notes: notes
  });
  if (error) throw error;
}
