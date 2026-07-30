// src/features/students/useStudentNotifications.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentNotificationsRepository } from './studentNotificationsRepository';
import { useStudentScope } from './studentQueries'; // export this one function from studentQueries.ts

export const notificationKeys = {
  all: ['student_notifications'] as const,
  list: (scope: string) => [...notificationKeys.all, scope] as const,
};

export function useStudentNotifications() {
  const scope = useStudentScope();
  return useQuery({
    queryKey: notificationKeys.list(scope),
    queryFn: () => studentNotificationsRepository.getNotifications(),
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => studentNotificationsRepository.markAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => studentNotificationsRepository.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
