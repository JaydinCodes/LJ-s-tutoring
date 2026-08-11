import type { RubricCriterion } from '../../types/lms';

export type LearningActionType = 'revise' | 'retry' | 'practice' | 'discuss';

export interface LearningAction {
  strengths: string;
  fixNext: string;
  actionType: LearningActionType;
  actionDetail: string;
  dueDate?: string;
  allowResubmission: boolean;
}

export interface TeachingCriterion extends RubricCriterion {
  topic?: string;
  cognitiveLevel?: string;
}

export const learningActionKey = '__learning_action';

export function parseCriteria(value: unknown): TeachingCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    const maxMarks = Number(source.maxMarks);
    if (!label || !Number.isFinite(maxMarks) || maxMarks <= 0) return [];
    return [{
      id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `criterion-${index + 1}`,
      label,
      maxMarks,
      description: typeof source.description === 'string' ? source.description : undefined,
      topic: typeof source.topic === 'string' ? source.topic : undefined,
      cognitiveLevel: typeof source.cognitiveLevel === 'string' ? source.cognitiveLevel : undefined,
    }];
  });
}

export function serializeCriteria(criteria: TeachingCriterion[]) {
  return JSON.stringify(criteria.map((criterion, index) => ({
    ...criterion,
    id: criterion.id.trim() || `criterion-${index + 1}`,
    label: criterion.label.trim(),
    maxMarks: Number(criterion.maxMarks),
    topic: criterion.topic?.trim() || undefined,
    cognitiveLevel: criterion.cognitiveLevel?.trim() || undefined,
    description: criterion.description?.trim() || undefined,
  })).filter((criterion) => criterion.label && Number.isFinite(criterion.maxMarks) && criterion.maxMarks > 0));
}

export function parseLearningAction(value: unknown): LearningAction | null {
  if (!value || typeof value !== 'object') return null;
  const source = (value as Record<string, unknown>)[learningActionKey];
  if (!source || typeof source !== 'object') return null;
  const action = source as Record<string, unknown>;
  const actionType = action.actionType;
  if (actionType !== 'revise' && actionType !== 'retry' && actionType !== 'practice' && actionType !== 'discuss') return null;
  return {
    strengths: typeof action.strengths === 'string' ? action.strengths : '',
    fixNext: typeof action.fixNext === 'string' ? action.fixNext : '',
    actionType,
    actionDetail: typeof action.actionDetail === 'string' ? action.actionDetail : '',
    dueDate: typeof action.dueDate === 'string' ? action.dueDate : undefined,
    allowResubmission: Boolean(action.allowResubmission),
  };
}

export function addLearningAction(scores: Record<string, unknown>, action: LearningAction) {
  return { ...scores, [learningActionKey]: action };
}
