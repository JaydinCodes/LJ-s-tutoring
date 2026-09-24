import { requireSupabase } from '../../lib/supabase/client';
import type { Json } from '../../../supabase/types/public.generated';

export type ContentQuestion = { id:string; item_code:string; version_number:number; review_status:string; prompt:string; marks:number; activity_type:string; grade:string; subject_name:string; primary_skill_code:string; source_tier:string; created_at:string };
export type ContentSkill = { id:string; code:string; name:string };
export type ContentMisconception = { id:string; code:string; name:string; skillId:string };
export type ContentCatalog = { items:ContentQuestion[]; total:number; skills:ContentSkill[]; misconceptions:ContentMisconception[] };
export type QuestionDraft = { itemCode:string; primarySkillId:string; supportingSkillIds:string[]; misconceptionIds:string[]; prompt:string; questionType:string; expected:string; optionsText:string; tolerance:string; correctOption:string; requiredForm:string; marks:string; activityType:string; cognitiveLevel:string; representation:string; calculatorPolicy:string; solution:string; sourceTier:string; sourceNotes:string; hints:string[] };

export async function loadLearningContentCatalog(search = '', status = '', page = 1): Promise<ContentCatalog> {
  const { data, error } = await requireSupabase().rpc('get_learning_content_catalog', { p_search: search || undefined, p_status: (status || undefined) as 'draft'|'in_review'|'approved'|'rejected'|'retired'|undefined, p_page: page, p_page_size: 25 });
  if (error) throw error;
  return data as unknown as ContentCatalog;
}

export function answerConfigFromDraft(draft: QuestionDraft): Json {
  const type = draft.questionType;
  if (type === 'multiple_choice') {
    const options = Object.fromEntries(draft.optionsText.split('\n').map(line => line.split(':')).filter(parts => parts.length >= 2).map(([key, ...value]) => [key.trim(), value.join(':').trim()]));
    return { type, correct_option: draft.correctOption, options };
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

export async function importLearningQuestionDrafts(records: Json[], dryRun = true) {
  const { data, error } = await requireSupabase().rpc('import_learning_question_drafts', { p_records: records, p_dry_run: dryRun });
  if (error) throw error;
  return data;
}

export const dryRunImport = (records: Json[]) => importLearningQuestionDrafts(records, true);

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
