import { apiFetch, apiUrl } from '../common.js';

const feedback = document.getElementById('authFeedback');
const googleStudentBtn = document.getElementById('googleStudentBtn');

const errorMessages = {
  account_not_found: 'No student account found for that Google address. Contact your administrator.',
  wrong_role: 'That Google account is linked to another portal.',
  account_disabled: 'This student account is disabled. Contact your administrator.',
  google_domain_not_allowed: 'Use the Google account approved for Project Odysseus.',
  google_email_not_verified: 'Google has not verified that email address.',
  google_id_token_missing: 'Google sign-in did not return the required identity token. Please try again.',
  google_id_token_invalid: 'Google sign-in could not be verified. Please try again.',
  google_nonce_invalid: 'Google sign-in expired. Please start again.',
  oauth_callback_failed: 'Google sign-in could not be completed. Please try again.',
  google_oauth_not_configured: 'Google sign-in is not available yet. Contact your administrator.',
};

function setFeedback(message) {
  if (feedback) {
    feedback.textContent = message || '';
  }
}

if (googleStudentBtn) {
  googleStudentBtn.href = apiUrl('/auth/google/student/start');
}

const params = new URLSearchParams(window.location.search);
const error = params.get('error');
if (error) {
  setFeedback(errorMessages[error] || 'Student sign-in failed. Please try again.');
}

(async () => {
  try {
    const res = await apiFetch('/auth/session');
    if (!res.ok) {
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.user?.role === 'STUDENT') {
      window.location.replace('/dashboard/');
    }
  } catch {
    // Signed-out users stay on the Google sign-in page.
  }
})();
