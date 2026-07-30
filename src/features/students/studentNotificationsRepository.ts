// src/features/students/studentNotificationsRepository.ts
import { requireSupabase } from '../../lib/supabase/client';
import { callRpc } from '../../lib/supabase/rpc';
import type { StudentNotification } from '../../types/lms';

export const studentNotificationsRepository = {
  async getNotifications(): Promise<StudentNotification[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('student_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
    return data as StudentNotification[];
  },
  async markAsRead(notificationId: string): Promise<StudentNotification> {
    const supabase = requireSupabase();
    return callRpc(supabase, 'mark_notification_read', { p_notification_id: notificationId }) as Promise<StudentNotification>;
  },
  async markAllAsRead(): Promise<number> {
    const supabase = requireSupabase();
    return callRpc(supabase, 'mark_all_notifications_read', {});
  },
};
