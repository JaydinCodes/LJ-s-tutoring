const fs = require('node:fs');
const path = require('node:path');

const envFiles = ['.env', '.env.local'];

for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const roleChecks = [
  {
    role: 'admin',
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
    dashboard: '/dashboard/admin/',
  },
  {
    role: 'student',
    email: process.env.VERIFY_STUDENT_EMAIL,
    password: process.env.VERIFY_STUDENT_PASSWORD,
    dashboard: '/dashboard/student/',
  },
  {
    role: 'tutor',
    email: process.env.VERIFY_TUTOR_EMAIL,
    password: process.env.VERIFY_TUTOR_PASSWORD,
    dashboard: '/dashboard/tutor/',
  },
];

function maskEmail(email) {
  if (!email || !email.includes('@')) {
    return '(missing)';
  }
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

async function verifyRole(check) {
  if (!check.email || !check.password) {
    return {
      role: check.role,
      ok: false,
      skipped: true,
      message: `Set VERIFY_${check.role.toUpperCase()}_EMAIL and VERIFY_${check.role.toUpperCase()}_PASSWORD to verify ${check.role}.`,
    };
  }

  const signInResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: check.email,
      password: check.password,
    }),
  });

  const signInPayload = await signInResponse.json().catch(() => ({}));

  if (!signInResponse.ok || !signInPayload.user || !signInPayload.access_token) {
    return {
      role: check.role,
      ok: false,
      message: `Sign-in failed for ${maskEmail(check.email)}: ${signInPayload.error_description || signInPayload.msg || signInPayload.error || 'missing user token'}`,
    };
  }

  const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
  profileUrl.searchParams.set('select', 'id,email,role');
  profileUrl.searchParams.set('auth_user_id', `eq.${signInPayload.user.id}`);
  profileUrl.searchParams.set('limit', '1');

  const profileResponse = await fetch(profileUrl, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${signInPayload.access_token}`,
      Accept: 'application/json',
    },
  });

  const profilePayload = await profileResponse.json().catch(() => []);
  const profile = Array.isArray(profilePayload) ? profilePayload[0] : null;

  if (!profileResponse.ok || !profile) {
    return {
      role: check.role,
      ok: false,
      message: `No readable profile row for ${maskEmail(check.email)}: ${profilePayload.message || profilePayload.hint || 'missing profile'}`,
    };
  }

  if (profile.role !== check.role) {
    return {
      role: check.role,
      ok: false,
      message: `Expected role ${check.role} but profile has ${profile.role}.`,
    };
  }

  return {
    role: check.role,
    ok: true,
    message: `${check.role} verified for ${maskEmail(check.email)}. Dashboard: ${check.dashboard}`,
  };
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const results = [];
  for (const check of roleChecks) {
    results.push(await verifyRole(check));
  }

  for (const result of results) {
    const prefix = result.ok ? 'PASS' : result.skipped ? 'SKIP' : 'FAIL';
    console.log(`${prefix}: ${result.message}`);
  }

  const failures = results.filter((result) => !result.ok && !result.skipped);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
