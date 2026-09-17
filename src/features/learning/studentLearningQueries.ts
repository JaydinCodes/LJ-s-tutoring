import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useStudentScope } from '../students/studentQueries';

import {
  loadAvailableLearningDiagnostics,
  loadDiagnosticProgress,
  loadLearnerQuestion,
  submitLearningAttempt,
  type SubmitLearningAttemptInput,
} from './studentLearningRepository';

export const studentLearningQueryKeys = {
  all: ['student-learning'] as const,

  diagnostics: (studentScope: string) =>
    [
      ...studentLearningQueryKeys.all,
      studentScope,
      'diagnostics',
    ] as const,

  diagnostic: (
    studentScope: string,
    diagnosticCode: string,
  ) =>
    [
      ...studentLearningQueryKeys.all,
      studentScope,
      'diagnostic',
      diagnosticCode,
    ] as const,

  question: (
    studentScope: string,
    questionVersionId: string,
  ) =>
    [
      ...studentLearningQueryKeys.all,
      studentScope,
      'question',
      questionVersionId,
    ] as const,
};

export function useAvailableLearningDiagnostics() {
  const studentScope = useStudentScope();

  return useQuery({
    queryKey:
      studentLearningQueryKeys.diagnostics(studentScope),

    queryFn: loadAvailableLearningDiagnostics,

    staleTime: 60_000,

    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useDiagnosticProgress(
  diagnosticCode: string,
) {
  const studentScope = useStudentScope();

  return useQuery({
    queryKey:
      studentLearningQueryKeys.diagnostic(
        studentScope,
        diagnosticCode,
      ),

    queryFn: () =>
      loadDiagnosticProgress(diagnosticCode),

    enabled: Boolean(diagnosticCode),

    staleTime: 10_000,

    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useLearnerQuestion(
  questionVersionId: string | null,
) {
  const studentScope = useStudentScope();

  return useQuery({
    queryKey:
      studentLearningQueryKeys.question(
        studentScope,
        questionVersionId ?? 'none',
      ),

    queryFn: () => {
      if (!questionVersionId) {
        throw new Error('No question was selected.');
      }

      return loadLearnerQuestion(questionVersionId);
    },

    enabled: Boolean(questionVersionId),

    staleTime: 5 * 60_000,

    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSubmitLearningAttemptMutation(
  diagnosticCode: string,
) {
  const queryClient = useQueryClient();
  const studentScope = useStudentScope();

  return useMutation({
    mutationFn: (
      input: SubmitLearningAttemptInput,
    ) => submitLearningAttempt(input),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            studentLearningQueryKeys.diagnostic(
              studentScope,
              diagnosticCode,
            ),
          exact: true,
        }),

        queryClient.invalidateQueries({
          queryKey:
            studentLearningQueryKeys.diagnostics(
              studentScope,
            ),
          exact: true,
        }),
      ]);
    },
  });
}