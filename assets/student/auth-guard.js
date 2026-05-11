// Auth guard for student dashboard pages.
// Redirects to student login if not authenticated as STUDENT.
(function () {
  function resolveApiBase() {
    const raw = String(window.__PO_API_BASE__ || '').replace(/\/$/, '');
    const host = window.location.hostname;
    const isLocalHost = (value) => value === 'localhost' || value === '127.0.0.1';

    if (!raw || raw === '__PO_API_BASE__') {
      if (isLocalHost(host)) {
        return `${window.location.protocol}//${host}:3001`;
      }
      return '/api';
    }

    if (isLocalHost(host) && raw === '/api') {
      return `${window.location.protocol}//${host}:3001`;
    }

    try {
      const parsed = new URL(raw);
      if (isLocalHost(host) && isLocalHost(parsed.hostname) && parsed.hostname !== host) {
        parsed.hostname = host;
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // Keep raw value if parsing fails.
    }

    return raw;
  }

  const API_BASE = resolveApiBase();
  document.documentElement.dataset.studentAuth = 'checking';

  window.__PO_STUDENT_AUTH__ = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('unauthenticated');
      }
      const data = await res.json();
      if (!data?.user || data.user.role !== 'STUDENT') {
        throw new Error('wrong_role');
      }
      document.documentElement.dataset.studentAuth = 'signed-in';
      return data;
    } catch (err) {
      document.documentElement.dataset.studentAuth = 'signed-out';
      window.location.replace('/dashboard/login.html');
      throw err;
    }
  })();
}());
