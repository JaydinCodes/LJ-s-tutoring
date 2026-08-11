// src/features/students/StudentNotificationsPanel.tsx
import { Bell, Check, X } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useModalDialog } from '../../hooks/useModalDialog';
import { useStudentNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './useStudentNotifications';
import type { StudentNotification } from '../../types/lms';

type NotificationSurfaceProps = {
  open: boolean;
  onClose: () => void;
};

export function NotificationDialog(props: NotificationSurfaceProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog({
    dialogRef,
    onClose: props.onClose,
    open: props.open,
  });

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) props.onClose();
      }}
    >
      <div
        aria-labelledby="notification-dialog-title"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 max-h-[calc(100vh-2rem)] rounded-t-sheet border border-white/70 bg-white/[0.92] p-4 shadow-[0_-20px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/[0.92] lg:inset-y-6 lg:left-auto lg:right-6 lg:w-[26rem] lg:rounded-sheet lg:shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <NotificationPanel {...props} />
      </div>
    </div>
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
          <h2 id="notification-dialog-title" className="mt-1 text-xl font-semibold text-academy-ink dark:text-academy-parchment">Notifications</h2>
        </div>
        <button aria-label="Close notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.08]" data-modal-initial-focus type="button" onClick={onClose}>
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
          <NotificationRow key={notification.id} notification={notification} onClose={onClose} onMarkRead={() => markRead.mutate(notification.id)} />
        ))}
      </div>
    </div>
  );
}

function NotificationRow({ notification, onMarkRead, onClose }: { notification: StudentNotification; onMarkRead: () => void; onClose: () => void }) {
  const actionHref = notification.link || actionHrefFor(notification);
  const urgency = urgencyFor(notification);
  const markRead = () => { if (!notification.is_read) onMarkRead(); };
  return (
    <article
      className={`w-full rounded-ios border px-4 py-3 text-left text-sm leading-6 shadow-sm transition ${
        notification.is_read
          ? 'border-white/70 bg-white/[0.5] text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-academy-muted'
          : 'border-academy-gold/50 bg-academy-gold/10 text-academy-ink dark:text-academy-parchment'
      }`}
    >
      <div className="flex items-start justify-between gap-3"><p className="font-semibold">{notification.title}</p><span className="shrink-0 rounded-full bg-slate-950/[0.06] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide dark:bg-white/[0.08]">{urgency}</span></div>
      <p className="mt-1 text-academy-muted">{notification.body}</p>
      <div className="mt-3 flex items-center gap-2"><Link className="academy-btn academy-btn-outline min-h-9 px-3 text-xs" to={actionHref} onClick={() => { markRead(); onClose(); }}>{actionLabelFor(notification)}</Link>{!notification.is_read ? <button className="text-xs font-semibold text-academy-aegean dark:text-academy-gold" type="button" onClick={markRead}>Mark read</button> : null}</div>
    </article>
  );
}

function actionHrefFor(notification: StudentNotification) {
  if (notification.entity_type === 'assignment' && notification.entity_id) return `/dashboard/student/assignments/${notification.entity_id}`;
  if (notification.type === 'GRADE_RELEASED') return '/dashboard/student/results';
  if (notification.type === 'ASSIGNMENT_DUE' || notification.type === 'ASSIGNMENT_RELEASED' || notification.type === 'ASSIGNMENT_UPDATED') return '/dashboard/student/assignments';
  return '/dashboard/student';
}

function actionLabelFor(notification: StudentNotification) {
  if (notification.type === 'GRADE_RELEASED') return 'View feedback';
  if (notification.type === 'ASSIGNMENT_DUE') return 'Open task';
  return 'Open';
}

function urgencyFor(notification: StudentNotification) {
  if (notification.type === 'ASSIGNMENT_DUE') return 'Action needed';
  if (notification.type === 'GRADE_RELEASED') return 'Feedback ready';
  if (notification.type === 'SYSTEM_ALERT') return 'Important';
  return notification.is_read ? 'Read' : 'New';
}
