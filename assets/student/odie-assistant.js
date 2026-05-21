import { apiFetch } from '/assets/common.js';

export function initOdieAssistant({
  formId = 'odieForm',
  inputId = 'odieInput',
  messagesId = 'odieMessages',
  stateId = 'odieState',
  chipSelector = '[data-odie-prompt]',
  defaultSubject = '',
  careerPathwayContext = '',
} = {}) {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  const messages = document.getElementById(messagesId);
  const state = document.getElementById(stateId);
  if (!form || !input || !messages || !state) {return;}

  let conversationId = null;

  const addMessage = (role, text) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'You' : 'Odie';
    const body = document.createElement('div');
    body.textContent = text;
    item.append(label, body);
    messages.append(item);
  };

  if (!messages.children.length) {
    messages.innerHTML = '<div class="empty-state"><strong>Ask Odie anything about your learning.</strong><span>Odie uses your dashboard context when it is available and will say when something is missing.</span></div>';
  }

  async function send(message) {
    const clean = String(message || '').trim();
    if (!clean) {return;}
    if (messages.querySelector('.empty-state')) {messages.innerHTML = '';}
    addMessage('user', clean);
    input.value = '';
    state.textContent = 'Odie is thinking...';
    try {
      const res = await apiFetch('/student/odie/chat', {
        method: 'POST',
        body: {
          message: clean,
          conversationId,
          subject: defaultSubject || undefined,
          careerPathwayContext: careerPathwayContext || undefined,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {throw new Error(payload?.error || 'odie_failed');}
      conversationId = payload.conversationId || conversationId;
      addMessage('assistant', payload.message || payload.text || 'I need a little more context before I can help.');
      state.textContent = '';
    } catch {
      state.textContent = 'Odie is unavailable right now. Please try again later.';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value);
  });
  document.querySelectorAll(chipSelector).forEach((button) => {
    button.addEventListener('click', () => send(button.dataset.odiePrompt));
  });
}
