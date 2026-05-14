import { apiFetch, apiUrl } from '../common.js';

const passwordForm    = document.getElementById('passwordForm');
const passwordFeedback = document.getElementById('passwordFeedback');
const googleBtn = document.getElementById('googleBtn');

const oauthErrors = {
  account_not_found: 'No admin account found for that Google address. Contact your administrator.',
  wrong_role: 'That Google account is linked to another portal.',
  account_disabled: 'This admin account is disabled.',
  google_domain_not_allowed: 'Use the Google account approved for Project Odysseus.',
  google_email_not_verified: 'Google has not verified that email address.',
  google_id_token_missing: 'Google sign-in did not return the required identity token. Please try again.',
  google_id_token_invalid: 'Google sign-in could not be verified. Please try again.',
  google_nonce_invalid: 'Google sign-in expired. Please start again.',
  oauth_callback_failed: 'Google sign-in could not be completed. Please try again.',
  google_oauth_not_configured: 'Google sign-in is not available yet. Check the OAuth configuration.',
};

if (googleBtn) {
  googleBtn.href = apiUrl('/auth/google/admin/start');
}

const params = new URLSearchParams(window.location.search);
const error = params.get('error');
if (error && passwordFeedback) {
  passwordFeedback.textContent = oauthErrors[error] || 'Google sign-in failed. Please try again.';
}

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
