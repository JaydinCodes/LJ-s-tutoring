import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { submitAssignment, type SubmitAssignmentInput } from '../assignments/assignmentMutations';
import { loadCareersOverview } from './studentCareersRepository';
import { loadStudentDashboard } from './studentDashboardRepository';
import { loadStudentResultsAnalytics } from './studentResultsRepository';

export const studentQueryKeys = {
  all: ['student'] as const,
  dashboard: (studentScope: string) => [...studentQueryKeys.all, studentScope, 'dashboard'] as const,
  results: (studentScope: string) => [...studentQueryKeys.all, studentScope, 'results'] as const,
  careers: (studentScope: string) => [...studentQueryKeys.all, studentScope, 'careers'] as const,
};

function useStudentScope() {
  const auth = useAuth();
  return auth.profile?.id || auth.session?.user.id || 'anonymous';
}

function useCachedStudentQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>, staleTime?: number) {
  const query = useQuery({ queryKey, queryFn, staleTime });
  const reload = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Unexpected error' : null,
    refetching: query.isRefetching,
    reload,
  };
}

export function useStudentDashboardQuery() {
  const studentScope = useStudentScope();
  return useCachedStudentQuery(studentQueryKeys.dashboard(studentScope), loadStudentDashboard);
}

export function useStudentResultsQuery() {
  const studentScope = useStudentScope();
  return useCachedStudentQuery(studentQueryKeys.results(studentScope), loadStudentResultsAnalytics);
}

export function useStudentCareersQuery() {
  const studentScope = useStudentScope();
  return useCachedStudentQuery(studentQueryKeys.careers(studentScope), loadCareersOverview, 5 * 60_000);
}

export function useSubmitStudentAssignmentMutation() {
  const queryClient = useQueryClient();
  const studentScope = useStudentScope();

  return useMutation({
    mutationFn: (input: SubmitAssignmentInput) => submitAssignment(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: studentQueryKeys.dashboard(studentScope),
        exact: true,
      });
    },
  });
}
