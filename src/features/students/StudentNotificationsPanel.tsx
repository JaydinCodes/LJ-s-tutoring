// src/features/students/StudentNotificationsPanel.tsx
import { Bell, Check, X } from 'lucide-react';
import { useStudentNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './useStudentNotifications';
import type { StudentNotification } from '../../types/lms';

type NotificationSurfaceProps = {
  open: boolean;
  onClose: () => void;
};

export function NotificationSheet(props: NotificationSurfaceProps) {
  return (
    <div
      aria-hidden={!props.open}
      aria-label="Notifications"
      aria-modal={props.open}
      className={`fixed inset-x-0 bottom-0 z-50 rounded-t-sheet border border-white/70 bg-white/[0.92] p-4 shadow-[0_-20px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl transition duration-sheet ease-ios dark:border-white/10 dark:bg-slate-950/[0.92] lg:hidden ${props.open ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
      role="dialog"
    >
      <NotificationPanel {...props} />
    </div>
  );
}

export function NotificationDrawer(props: NotificationSurfaceProps) {
  return (
    <aside
      aria-hidden={!props.open}
      aria-label="Notifications"
      aria-modal={props.open}
      className={`fixed bottom-6 right-6 top-6 z-50 hidden w-[26rem] rounded-sheet border border-white/70 bg-white/[0.9] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl transition duration-sheet ease-ios dark:border-white/10 dark:bg-slate-950/[0.9] lg:block ${props.open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-8 opacity-0'}`}
      role="dialog"
    >
      <NotificationPanel {...props} />
    </aside>
  );
}

function NotificationPanel({ onClose }: NotificationSurfaceProps) {
  const { data: notifications, isPending } = useStudentNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="flex max-h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-academy-aegean dark:text-academy-gold">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Notifications</h2>
        </div>
        <button aria-label="Close notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.08]" type="button" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {unreadCount > 0 ? (
        <button className="academy-btn academy-btn-outline mt-3 self-start" type="button" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Mark all as read
        </button>
      ) : null}

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-ios-lg border border-white/70 bg-white/[0.55] p-3 shadow-academy-inset dark:border-white/10 dark:bg-white/[0.04]">
        {isPending ? <p className="p-3 text-sm text-academy-muted">Loading...</p> : null}
        {!isPending && !notifications?.length ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <Bell className="h-6 w-6 text-academy-muted" aria-hidden="true" />
            <p className="text-sm text-academy-muted">No notifications yet.</p>
          </div>
        ) : null}
        {notifications?.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} onMarkRead={() => markRead.mutate(notification.id)} />
        ))}
      </div>
    </div>
  );
}

function NotificationRow({ notification, onMarkRead }: { notification: StudentNotification; onMarkRead: () => void }) {
  return (
    <button
      className={`w-full rounded-ios border px-4 py-3 text-left text-sm leading-6 shadow-sm transition ${
        notification.is_read
          ? 'border-white/70 bg-white/[0.5] text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-academy-muted'
          : 'border-academy-gold/50 bg-academy-gold/10 text-academy-ink dark:text-academy-parchment'
      }`}
      type="button"
      onClick={() => !notification.is_read && onMarkRead()}
    >
      <p className="font-semibold">{notification.title}</p>
      <p className="mt-1 text-academy-muted">{notification.body}</p>
    </button>
  );
}
