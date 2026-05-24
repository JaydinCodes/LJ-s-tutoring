import { buildSafeItem } from '/assets/common.js';

function formatNotificationTime(value) {
  if (!value) {return '';}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return String(value);}
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function renderNotificationCard(notification, onMarkRead) {
  const card = document.createElement('article');
  card.className = 'notification-card list-item';
  if (!notification.is_read) {
    card.dataset.unread = 'true';
  }

  const content = buildSafeItem({
    className: 'notification-copy',
    rows: [
      {
        el: 'div',
        className: 'notification-meta',
        children: [
          (() => {
            const badge = document.createElement('span');
            badge.className = 'badge subtle flat';
            badge.textContent = notification.type ? String(notification.type).replace(/_/g, ' ') : 'update';
            return badge;
          })(),
          (() => {
            const time = document.createElement('span');
            time.className = 'note';
            time.textContent = formatNotificationTime(notification.created_at);
            return time;
          })(),
        ],
      },
      { el: 'strong', text: notification.title || 'Update available', className: 'panel-title' },
      { el: 'div', text: notification.body || '', className: 'note' },
    ],
  });

  card.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  if (notification.link) {
    const link = document.createElement('a');
    link.className = 'button secondary';
    link.href = notification.link;
    link.textContent = 'Open';
    actions.appendChild(link);
  }

  if (!notification.is_read && typeof onMarkRead === 'function') {
    const button = document.createElement('button');
    button.className = 'button';
    button.type = 'button';
    button.textContent = 'Mark read';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await onMarkRead(notification.id);
      } finally {
        button.disabled = false;
      }
    });
    actions.appendChild(button);
  }

  if (actions.childNodes.length > 0) {
    card.appendChild(actions);
  }

  return card;
}
