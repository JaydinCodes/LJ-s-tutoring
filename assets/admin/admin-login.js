import { apiFetch } from '../common.js';

const passwordForm    = document.getElementById('passwordForm');
const passwordFeedback = document.getElementById('passwordFeedback');

// Admin password-only sign-in (MFA disabled)
passwordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordFeedback.textContent = 'Signing in…';
  const data = Object.fromEntries(new FormData(passwordForm).entries());

  const res = await apiFetch('/auth/login', { method: 'POST', body: data });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (body.error === 'invalid_credentials') {
      passwordFeedback.textContent = 'Incorrect email or password.';
    } else if (body.error === 'rate_limited') {
      passwordFeedback.textContent = 'Too many attempts. Please wait and try again.';
    } else if (body.error === 'account_disabled') {
      passwordFeedback.textContent = 'This admin account is disabled.';
    } else {
      passwordFeedback.textContent = 'Sign-in failed. Please try again.';
    }
    return;
  }

  if (body.role && body.role !== 'ADMIN') {
    passwordFeedback.textContent = 'This portal is for admins only.';
    return;
  }

  window.location.href = body.redirectTo || '/admin/';
});
