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
  activityType: string;
  representation: string;
  calculatorPolicy: string;
  hints: LearnerHint[];
};

export type SubmitLearningAttemptInput = {
  diagnosticCode: string;
  questionVersionId: string;
  answer: string;
  confidence: LearnerConfidence | null;
  timeSpentSeconds: number;
  idempotencyKey: string;
  hintIds: string[];
};

export type SubmitLearningAttemptResult = {
  attemptId: string;
  status: string;
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
    'get_learning_question',
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

  const { data, error } = await client.rpc(
    'submit_my_learning_attempt',
    {
      p_diagnostic_code: input.diagnosticCode,
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
  );

  if (error) {
    throw error;
  }

  const row = data?.[0];

  if (!row) {
    throw new Error(
      'Your answer could not be confirmed.',
    );
  }

  return {
    attemptId: row.attempt_id,
    status: row.attempt_status,
  };
}