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
  const widget = {
    button: document.getElementById('odie-btn'),
    panel: document.getElementById('odie-panel'),
    close: document.getElementById('odie-close'),
    input: document.getElementById('odie-input'),
    send: document.getElementById('odie-send'),
    messages: document.getElementById('odie-messages'),
  };
  if (!form && widget.button && widget.panel && widget.input && widget.send && widget.messages) {
    initOdieWidget(widget, { defaultSubject, careerPathwayContext });
    return;
  }
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

function initOdieWidget(widget, { defaultSubject = '', careerPathwayContext = '' } = {}) {
  let conversationId = null;
  let isOpen = false;
  let isLoading = false;

  function setPresence(status, label) {
    widget.panel.setAttribute('data-odie-status', status);
    const sub = widget.panel.querySelector('.odie-header-sub');
    if (sub) {sub.textContent = label;}
  }

  function scrollMessages() {
    widget.messages.scrollTop = widget.messages.scrollHeight;
  }

  function appendMessage(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `odie-msg ${role === 'user' ? 'odie-msg-user' : 'odie-msg-bot'}`;
    if (role !== 'user') {
      const avatar = document.createElement('div');
      avatar.className = 'odie-msg-small-avatar';
      avatar.textContent = 'O';
      wrapper.append(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = 'odie-msg-bubble';
    bubble.textContent = text;
    wrapper.append(bubble);
    widget.messages.append(wrapper);
    scrollMessages();
  }

  function showTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'odie-msg odie-msg-bot';
    wrapper.id = 'odie-typing-row';
    const avatar = document.createElement('div');
    avatar.className = 'odie-msg-small-avatar';
    avatar.textContent = 'O';
    const dots = document.createElement('div');
    dots.className = 'odie-typing';
    dots.innerHTML = '<span></span><span></span><span></span>';
    wrapper.append(avatar, dots);
    widget.messages.append(wrapper);
    scrollMessages();
  }

  function hideTyping() {
    document.getElementById('odie-typing-row')?.remove();
  }

  function setLoading(value) {
    isLoading = value;
    widget.send.disabled = value;
  }

  function togglePanel(forceOpen) {
    isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    widget.panel.classList.toggle('odie-open', isOpen);
    widget.button.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      setTimeout(() => widget.input.focus(), 160);
    }
  }

  async function send(message) {
    const clean = String(message || '').trim();
    if (!clean || isLoading) {return;}
    widget.input.value = '';
    appendMessage('user', clean);
    setLoading(true);
    showTyping();
    setPresence('checking', 'Thinking...');
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
      hideTyping();
      appendMessage('assistant', payload.message || payload.text || 'I need a little more context before I can help.');
      setPresence('live', 'Online - learning support');
    } catch {
      hideTyping();
      setPresence('offline', 'Limited - try again shortly');
      appendMessage('assistant', 'I cannot connect right now. Please try again in a moment, or ask your tutor to check the API/session.');
    } finally {
      setLoading(false);
      if (isOpen) {widget.input.focus();}
    }
  }

  widget.button.addEventListener('click', () => togglePanel());
  widget.close?.addEventListener('click', () => togglePanel(false));
  widget.send.addEventListener('click', () => send(widget.input.value));
  widget.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(widget.input.value);
    }
  });

  setPresence('live', 'Online - learning support');
  appendMessage('assistant', 'Hi, I am Odie. I can help with assignments, weak areas, study plans, results, and career pathways. What would you like to work on?');
}
