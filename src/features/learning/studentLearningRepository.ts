import { requireSupabase } from '../../lib/supabase/client';

export type LearnerConfidence = 1 | 2 | 3 | 4;

export type AvailableLearningDiagnostic = {
  code: string;
  name: string;
  description: string;
  totalQuestions: number;
  completedQuestions: number;
  complete: boolean;
  started: boolean;
};

export type DiagnosticProgressItem = {
  questionVersionId: string;
  sequenceNumber: number;
  attemptId: string | null;
  attemptStatus: string | null;
  submittedAt: string | null;
};

export type LearnerHint = {
  id: string;
  level: number;
  prompt: string;
};

export type LearnerQuestion = {
  id: string;
  prompt: string;
  marks: number;
  questionType:
    | 'numeric'
    | 'fraction'
    | 'multiple_choice'
    | 'coordinate'
    | 'linear_equation_solution'
    | 'algebraic_expression'
    | 'factorised_expression';
  options?: Array<{
    value: string;
    label: string;
  }>;
  activityType: string;
  representation: string;
  calculatorPolicy: string;
  hints: LearnerHint[];
};

export type SubmitLearningAttemptInput = {
  diagnosticCode?: string;
  activityCode?: string;
  questionVersionId: string;
  answer: string;
  confidence: LearnerConfidence | null;
  timeSpentSeconds: number;
  idempotencyKey: string;
  hintIds: string[];
};

export type LearnerActivityStage = {
  id: string;
  sequence: number;
  type: string;
  instruction: string;
  questionVersionIds: string[];
};

export type LearnerActivity = {
  activityCode: string;
  name: string;
  description: string;
  targetSkillCode: string;
  stages: LearnerActivityStage[];
};

export type NextLearningStep = {
  activityCode: string;
  name: string;
  description: string;
  targetSkillCode: string;
  targetSkillName: string;
  estimatedMinutes: number;
  learnerReason: string;
};

export type DueRetentionStep = NextLearningStep & {
  retentionCheckId: string;
};

export type ActivityProgressItem = DiagnosticProgressItem & {
  stageId: string;
  stageSequence: number;
  stageType: string;
  stageInstruction: string;
  questionSequence: number;
};

export type LearnerMasterySummary = {
  skillCode: string;
  skillName: string;
  state: 'unassessed' | 'emerging' | 'developing' | 'secure' | 'retained';
  determinedAt: string;
};

export type LearningCatalogueSkill = {
  skillCode: string;
  skillName: string;
  skillDescription: string;
  activityCode?: string | null;
  hasExplanation: boolean;
};

export type LearningCatalogueTopic = {
  topicCode: string;
  topicName: string;
  topicDescription: string | null;
  areaName: string;
  skills: LearningCatalogueSkill[];
};

export type LearnerTopicContent = {
  title: string;
  explanation: string;
  workedExample: string;
  videoUrl?: string | null;
  worksheetUrl?: string | null;
  worksheetPermissionNote?: string | null;
};

export type LearningTopicSkill = LearningCatalogueSkill & {
  activityName?: string | null;
  content?: LearnerTopicContent | null;
};

export type LearningTopic = Omit<LearningCatalogueTopic, 'skills'> & {
  skills: LearningTopicSkill[];
};

export type LearnerVideoResource = {
  resourceCode: string;
  skillCode: string;
  title: string;
  channelName: string;
  description: string;
  youtubeUrl: string;
  durationSeconds: number | null;
  displayOrder: number;
};

export type AvailableLearningAssessment = {
  definitionId: string;
  formVersionId: string;
  name: string;
  assessmentType: 'entry_baseline' | 'topic_baseline' | 'endline' | 'mastery_challenge';
  topicCode: string | null;
  topicName: string | null;
  durationMinutes: number;
  questionCount: number;
};

export type LearningAssessmentSession = {
  sessionId: string;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'cancelled' | 'invalidated';
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  assessment: {
    name: string;
    assessmentType: AvailableLearningAssessment['assessmentType'];
    topicCode: string | null;
    topicName: string | null;
    durationMinutes: number;
  };
  questions: Array<{
    sessionQuestionId: string;
    sequenceNumber: number;
    prompt: string;
    options: Record<'A' | 'B' | 'C' | 'D', string>;
    selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  }>;
  result: null | {
    rawScore: number;
    totalMarks: number;
    percentage: number;
    recommendation: {
      nextStep?: string;
      focusSkillCode?: string | null;
      reasonCodes?: string[];
    };
    topicMastery: null | {
      status: 'not_assessed' | 'evidence_incomplete' | 'not_yet_mastered' | 'mastered';
      reasonCodes: string[];
      criticalSkillCoverage: number | null;
      reasoningAchievement: number | null;
      reasoningEvidenceCount: number;
    };
    skillBreakdown: Array<{
      skillCode: string;
      skillName: string;
      correct: number;
      total: number;
      percentage: number;
    }>;
    questionFeedback: Array<{
      sessionQuestionId: string;
      selectedOption: 'A' | 'B' | 'C' | 'D' | null;
      isCorrect: boolean;
      correctOption: 'A' | 'B' | 'C' | 'D';
      distractorExplanation: string | null;
      workedSolution: string;
    }>;
  };
};

export type SubmitLearningAttemptEvaluation = {
  status: 'correct' | 'incorrect' | 'needs_review';
  marksAwarded: number | null;
  marksAvailable: number;
  misconceptionMatches: Array<{
    code: string;
    confidence: string;
    skillCode: string | null;
    evidence: string;
  }>;
  explanationCode: string;
};

export type SubmitLearningAttemptResult = {
  attemptId: string;
  status: string;
  evaluation?: SubmitLearningAttemptEvaluation | null;
};

function parseHints(value: unknown): LearnerHint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;

    if (
      typeof record.id !== 'string' ||
      typeof record.prompt !== 'string' ||
      typeof record.hint_level !== 'number'
    ) {
      return [];
    }

    return [{
      id: record.id,
      level: record.hint_level,
      prompt: record.prompt,
    }];
  });
}

export async function loadAvailableLearningDiagnostics():
Promise<AvailableLearningDiagnostic[]> {
  const client = requireSupabase();

  const { data, error } = await client.rpc(
    'get_my_available_learning_diagnostics',
  );

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const totalQuestions = Number(row.total_questions ?? 0);
    const completedQuestions = Number(row.completed_questions ?? 0);

    return {
      code: row.diagnostic_code,
      name: row.diagnostic_name,
      description: row.diagnostic_description,
      totalQuestions,
      completedQuestions,
      complete:
        totalQuestions > 0 &&
        completedQuestions >= totalQuestions,
      started: completedQuestions > 0,
    };
  });
}

export async function loadDiagnosticProgress(
  diagnosticCode: string,
): Promise<DiagnosticProgressItem[]> {
  const client = requireSupabase();

  const { data, error } = await client.rpc(
    'get_my_approved_diagnostic_state',
    {
      p_code: diagnosticCode,
    },
  );

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    questionVersionId: row.question_version_id,
    sequenceNumber: Number(row.sequence_number),
    attemptId: row.attempt_id,
    attemptStatus: row.attempt_status,
    submittedAt: row.submitted_at,
  }));
}

export async function loadLearnerQuestion(
  questionVersionId: string,
): Promise<LearnerQuestion> {
  const client = requireSupabase();

  const { data, error } = await client.rpc(
    'get_learning_question_display',
    {
      p_question_version_id: questionVersionId,
    },
  );

  if (error) {
    throw error;
  }

  const row = data?.[0];

  if (!row) {
    throw new Error(
      'This question is not currently available.',
    );
  }

  return {
    id: row.question_version_id,
    prompt: row.prompt,
    marks: Number(row.marks),
    questionType: row.question_type as LearnerQuestion['questionType'],
    options: row.options as LearnerQuestion['options'],
    activityType: row.activity_type,
    representation: row.representation,
    calculatorPolicy: row.calculator_policy,
    hints: parseHints(row.hints),
  };
}

export async function submitLearningAttempt(
  input: SubmitLearningAttemptInput,
): Promise<SubmitLearningAttemptResult> {
  const client = requireSupabase();

  const evaluationRequest = client.functions.invoke(
    'evaluate-learning-attempt',
    {
      body: {
      ...(input.activityCode
        ? { p_activity_code: input.activityCode }
        : { p_diagnostic_code: input.diagnosticCode }),
      p_question_version_id: input.questionVersionId,
      p_response: {
        answer: input.answer.trim(),
      },
      p_confidence: input.confidence ?? undefined,
      p_time_spent_seconds: Math.max(
        0,
        Math.floor(input.timeSpentSeconds),
      ),
      p_idempotency_key: input.idempotencyKey,
      p_hint_ids: input.hintIds,
      },
    },
  );

  // A missing Edge Function previously left the activity screen looking busy
  // indefinitely. Keep the same idempotency key on retry; this only bounds
  // the client wait and never changes server-side persistence.
  const { data, error } = await Promise.race([
    evaluationRequest,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Answer checking is taking longer than expected. Your answer has not been changed; please retry the same answer.')), 15_000)),
  ]);

  if (error) {
    throw error;
  }

  const row = data;

  if (!row) {
    throw new Error(
      'Your answer could not be confirmed.',
    );
  }

  return {
    attemptId: row.attempt_id,
    status: row.attempt_status ?? 'submitted',
    evaluation: (row.evaluation as SubmitLearningAttemptEvaluation) ?? null,
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function loadNextLearningStep(): Promise<NextLearningStep | null> {
  const { data, error } = await requireSupabase().rpc('get_my_next_learning_step');
  if (error) throw error;
  const row = objectValue(data);
  if (!row || typeof row.activityCode !== 'string') return null;
  return row as NextLearningStep;
}

export async function loadDueRetentionStep(): Promise<DueRetentionStep | null> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_my_due_learning_retention_step') => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_my_due_learning_retention_step');
  if (error) throw error;
  const row = objectValue(data);
  if (!row || typeof row.activityCode !== 'string' || typeof row.retentionCheckId !== 'string') return null;
  return row as DueRetentionStep;
}

export async function loadLearnerActivity(activityCode: string): Promise<LearnerActivity> {
  const client = requireSupabase();
  const { error: startError } = await client.rpc('start_my_learning_activity', { p_activity_code: activityCode });
  if (startError) throw startError;
  const { data, error } = await client.rpc('get_my_learning_activity', { p_activity_code: activityCode });
  if (error) throw error;
  const row = objectValue(data);
  if (!row || !Array.isArray(row.stages)) throw new Error('This activity is not currently available.');
  return row as LearnerActivity;
}

export async function loadActivityProgress(activityCode: string): Promise<ActivityProgressItem[]> {
  const { data, error } = await requireSupabase().rpc('get_my_learning_activity_state', { p_activity_code: activityCode });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    questionVersionId: row.question_version_id,
    sequenceNumber: Number(row.stage_sequence) * 100 + Number(row.question_sequence),
    stageId: row.stage_id,
    stageSequence: Number(row.stage_sequence),
    stageType: row.stage_type,
    stageInstruction: row.stage_instruction,
    questionSequence: Number(row.question_sequence),
    attemptId: row.attempt_id,
    attemptStatus: row.attempt_status,
    submittedAt: null,
  }));
}

export async function completeLearnerActivity(activityCode: string) {
  const { error } = await requireSupabase().rpc('complete_my_learning_activity', { p_activity_code: activityCode });
  if (error) throw error;
}

export async function completeLearnerRetentionCheck(retentionCheckId: string, activityCode: string) {
  const { error } = await requireSupabase().functions.invoke('evaluate-learning-attempt', {
    body: { p_complete_retention: true, p_retention_check_id: retentionCheckId, p_activity_code: activityCode },
  });
  if (error) throw error;
}

export async function loadLearnerMasterySummary(): Promise<LearnerMasterySummary[]> {
  const { data, error } = await requireSupabase().rpc('get_my_learning_mastery_summary');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    skillCode: row.skill_code,
    skillName: row.skill_name,
    state: row.state,
    determinedAt: row.determined_at,
  }));
}

export async function loadGrade9LearningCatalogue(): Promise<LearningCatalogueTopic[]> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_my_grade9_learning_catalogue') => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_my_grade9_learning_catalogue');
  if (error) throw error;
  return Array.isArray(data) ? data as unknown as LearningCatalogueTopic[] : [];
}

export async function loadGrade9LearningTopic(topicCode: string): Promise<LearningTopic | null> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_my_grade9_learning_topic', args: { p_topic_code: string }) => Promise<{ data: unknown; error: Error | null }> };
  const { data, error } = await client.rpc('get_my_grade9_learning_topic', { p_topic_code: topicCode });
  if (error) throw error;
  return objectValue(data) as unknown as LearningTopic | null;
}

export async function loadApprovedLearningVideos(): Promise<LearnerVideoResource[]> {
  const client = requireSupabase() as unknown as { rpc: (name: 'get_my_approved_learning_video_resources') => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }> };
  const { data, error } = await client.rpc('get_my_approved_learning_video_resources');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    resourceCode: String(row.resource_code), skillCode: String(row.skill_code), title: String(row.title), channelName: String(row.channel_name), description: String(row.description), youtubeUrl: String(row.youtube_url), durationSeconds: typeof row.duration_seconds === 'number' ? row.duration_seconds : null, displayOrder: Number(row.display_order ?? 0),
  }));
}

type AssessmentRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export async function loadAvailableLearningAssessments(): Promise<AvailableLearningAssessment[]> {
  const { data, error } = await (requireSupabase() as unknown as AssessmentRpcClient).rpc('get_my_available_learning_assessments');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const item = objectValue(row);
    if (!item || typeof item.definitionId !== 'string' || typeof item.formVersionId !== 'string' || typeof item.name !== 'string') return [];
    return [
      {
        definitionId: item.definitionId,
        formVersionId: item.formVersionId,
        name: item.name,
        assessmentType: item.assessmentType as AvailableLearningAssessment['assessmentType'],
        topicCode: typeof item.topicCode === 'string' ? item.topicCode : null,
        topicName: typeof item.topicName === 'string' ? item.topicName : null,
        durationMinutes: Number(item.durationMinutes),
        questionCount: Number(item.questionCount)
      }
    ];
  });
}

export async function startLearningAssessment(definitionId: string, idempotencyKey: string) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentRpcClient).rpc('start_my_learning_assessment', {
    p_assessment_definition_id: definitionId,
    p_idempotency_key: idempotencyKey
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Your assessment session could not be started.');
  return data;
}

export async function loadLearningAssessmentSession(sessionId: string): Promise<LearningAssessmentSession> {
  const { data, error } = await (requireSupabase() as unknown as AssessmentRpcClient).rpc('get_my_learning_assessment_session', { p_session_id: sessionId });
  if (error) throw error;
  const item = objectValue(data);
  if (!item || typeof item.sessionId !== 'string' || !Array.isArray(item.questions) || !objectValue(item.assessment)) {
    throw new Error('This assessment session is unavailable.');
  }
  return item as unknown as LearningAssessmentSession;
}

export async function saveLearningAssessmentAnswer(sessionId: string, sessionQuestionId: string, selectedOption: 'A' | 'B' | 'C' | 'D', idempotencyKey: string) {
  const { error } = await (requireSupabase() as unknown as AssessmentRpcClient).rpc('save_my_learning_assessment_answer', {
    p_session_id: sessionId,
    p_session_question_id: sessionQuestionId,
    p_selected_option: selectedOption,
    p_idempotency_key: idempotencyKey
  });
  if (error) throw error;
}

export async function submitLearningAssessment(sessionId: string) {
  const { data, error } = await (requireSupabase() as unknown as AssessmentRpcClient).rpc('submit_my_learning_assessment', { p_session_id: sessionId });
  if (error) throw error;
  return typeof data === 'string' ? data : sessionId;
}
