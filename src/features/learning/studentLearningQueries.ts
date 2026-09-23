import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useStudentScope } from '../students/studentQueries';

import {
  loadAvailableLearningDiagnostics,
  loadActivityProgress,
  loadDiagnosticProgress,
  loadLearnerActivity,
  loadLearnerQuestion,
  loadLearnerMasterySummary,
  loadDueRetentionStep,
  loadNextLearningStep,
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

  nextStep: (studentScope: string) => [...studentLearningQueryKeys.all, studentScope, 'next-step'] as const,
  activity: (studentScope: string, code: string) => [...studentLearningQueryKeys.all, studentScope, 'activity', code] as const,
  activityProgress: (studentScope: string, code: string) => [...studentLearningQueryKeys.activity(studentScope, code), 'progress'] as const,
  mastery: (studentScope: string) => [...studentLearningQueryKeys.all, studentScope, 'mastery'] as const,
  retention: (studentScope: string) => [...studentLearningQueryKeys.all, studentScope, 'retention'] as const,
};

export function useDueRetentionStep() {
  const studentScope = useStudentScope();
  return useQuery({ queryKey: studentLearningQueryKeys.retention(studentScope), queryFn: loadDueRetentionStep, staleTime: 10_000 });
}

export function useLearnerMasterySummary() {
  const studentScope = useStudentScope();
  return useQuery({ queryKey: studentLearningQueryKeys.mastery(studentScope), queryFn: loadLearnerMasterySummary, staleTime: 10_000 });
}

export function useNextLearningStep() {
  const studentScope = useStudentScope();
  return useQuery({ queryKey: studentLearningQueryKeys.nextStep(studentScope), queryFn: loadNextLearningStep, staleTime: 10_000 });
}

export function useLearnerActivity(activityCode: string) {
  const studentScope = useStudentScope();
  return useQuery({ queryKey: studentLearningQueryKeys.activity(studentScope, activityCode), queryFn: () => loadLearnerActivity(activityCode), enabled: Boolean(activityCode), staleTime: 60_000 });
}

export function useActivityProgress(activityCode: string) {
  const studentScope = useStudentScope();
  return useQuery({ queryKey: studentLearningQueryKeys.activityProgress(studentScope, activityCode), queryFn: () => loadActivityProgress(activityCode), enabled: Boolean(activityCode), staleTime: 5_000 });
}

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
  activityCode?: string,
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
        ...(activityCode ? [
          queryClient.invalidateQueries({ queryKey: studentLearningQueryKeys.activityProgress(studentScope, activityCode), exact: true }),
          queryClient.invalidateQueries({ queryKey: studentLearningQueryKeys.nextStep(studentScope), exact: true }),
          queryClient.invalidateQueries({ queryKey: studentLearningQueryKeys.mastery(studentScope), exact: true }),
          queryClient.invalidateQueries({ queryKey: studentLearningQueryKeys.retention(studentScope), exact: true }),
        ] : []),

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
