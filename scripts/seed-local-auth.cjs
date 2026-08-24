const { execFileSync } = require('node:child_process');

const password = 'ProjectOdysseus!23';
const users = [
  { email: 'admin@example.com', fullName: 'Local Admin', role: 'admin' },
  { email: 'student@example.com', fullName: 'Local Student', role: 'student' },
  { email: 'tutor@example.com', fullName: 'Local Tutor', role: 'tutor' },
];

function getLocalStatus() {
  const status = JSON.parse(execFileSync(process.execPath, [
    require.resolve('supabase/dist/supabase.js'),
    'status',
    '-o',
    'json',
  ], { encoding: 'utf8' }));

  const apiUrl = new URL(status.API_URL);
  if (!['127.0.0.1', 'localhost', '::1'].includes(apiUrl.hostname)) {
    throw new Error(`Refusing to seed a non-local Supabase URL: ${apiUrl.origin}`);
  }

  return status;
}

function makeRequester(status) {
  const headers = {
    apikey: status.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
  };

  return async function request(path, { body, method = 'GET', prefer } = {}) {
    const requestHeaders = { ...headers };
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    if (prefer) requestHeaders.Prefer = prefer;

    const response = await fetch(`${status.API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail = data?.message || data?.msg || data?.error_description || text || response.statusText;
      throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
    }

    return data;
  };
}

async function main() {
  const status = getLocalStatus();
  const request = makeRequester(status);
  const authUsers = await request('/auth/v1/admin/users?per_page=100');
  const authByEmail = new Map((authUsers.users || []).map((user) => [user.email?.toLowerCase(), user]));

  for (const fixture of users) {
    const existing = authByEmail.get(fixture.email);
    const authUser = existing
      ? await request(`/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        body: {
          password,
          email_confirm: true,
          user_metadata: { full_name: fixture.fullName },
        },
      })
      : await request('/auth/v1/admin/users', {
        method: 'POST',
        body: {
          email: fixture.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fixture.fullName },
        },
      });

    const [profile] = await request('/rest/v1/profiles?on_conflict=auth_user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        auth_user_id: authUser.id,
        full_name: fixture.fullName,
        email: fixture.email,
        role: fixture.role,
      },
    });

    if (fixture.role === 'student') {
      const [organization] = await request('/rest/v1/organizations?select=id&type=eq.direct&limit=1');
      if (!organization?.id) throw new Error('No direct organization exists in the local database. Run npm run supabase:reset first.');

      await request('/rest/v1/students?on_conflict=profile_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          profile_id: profile.id,
          grade: 'Grade 12',
          school: 'Local Demo School',
          status: 'active',
          organization_id: organization.id,
        },
      });
    }

    if (fixture.role === 'tutor') {
      await request('/rest/v1/tutors?on_conflict=profile_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          profile_id: profile.id,
          subjects: ['Mathematics'],
          grades: ['Grade 12'],
          status: 'active',
          approval_status: 'approved',
        },
      });
    }
  }

  console.log('Seeded local dashboard users:');
  for (const fixture of users) console.log(`  ${fixture.email} / ${password}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
