const { execFileSync } = require('node:child_process');

const supabaseCli = require.resolve('supabase/dist/supabase.js');
const playwrightCli = require.resolve('@playwright/test/cli');
const fixtureTitle = 'Local Supabase Algebra Check';
const fixtureClassName = 'Local Supabase Calculus Class';
const password = 'ProjectOdysseus!23';
const users = {
  admin: { email: 'admin.supabase-e2e@projectodysseus.test', fullName: 'Local Supabase Admin' },
  student: { email: 'student.supabase-e2e@projectodysseus.test', fullName: 'Local Supabase Learner' },
  tutor: { email: 'tutor.supabase-e2e@projectodysseus.test', fullName: 'Local Supabase Tutor' },
};

function localStatus() {
  const raw = execFileSync(process.execPath, [supabaseCli, 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(raw);
}

function assertLoopback(name, value) {
  const parsed = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error(`${name} must target local Supabase; received ${parsed.origin}`);
  }
}

function makeRequester(status) {
  return async function request(path, { body, method = 'GET', prefer } = {}) {
    const headers = {
      apikey: status.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (prefer) {
      headers.Prefer = prefer;
    }
    const response = await fetch(`${status.API_URL}${path}`, {
      method,
      headers,
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

async function removePreviousFixtures(request) {
  await request(`/rest/v1/assignments?title=eq.${encodeURIComponent(fixtureTitle)}`, { method: 'DELETE' });

  const fixtureEmails = new Set(Object.values(users).map((user) => user.email));
  for (let page = 1; ; page += 1) {
    const data = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const listedUsers = data?.users || [];
    for (const user of listedUsers) {
      if (user.email && fixtureEmails.has(user.email)) {
        await request(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' });
      }
    }
    if (listedUsers.length < 100) {
      break;
    }
  }
}

async function createAuthAndProfiles(request) {
  const profiles = {};
  for (const [role, fixture] of Object.entries(users)) {
    const authUser = await request('/auth/v1/admin/users', {
      method: 'POST',
      body: {
        email: fixture.email,
        password,
        email_confirm: true,
        app_metadata: { onboarding_role: role },
        user_metadata: { full_name: fixture.fullName },
      },
    });
    const [profile] = await request('/rest/v1/profiles?select=*', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        auth_user_id: authUser.id,
        full_name: fixture.fullName,
        email: fixture.email,
        role,
      },
    });
    profiles[role] = profile;
  }
  return profiles;
}

async function seedAcademicJourney(request, profiles) {
  const [directOrganization] = await request('/rest/v1/organizations?select=id&type=eq.direct&limit=1');
  if (!directOrganization?.id) {
    throw new Error('The committed migration chain did not seed the direct organization.');
  }

  const [student] = await request('/rest/v1/students?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      profile_id: profiles.student.id,
      grade: 'Grade 12',
      school: 'Local Supabase School',
      status: 'active',
      organization_id: directOrganization.id,
    },
  });

  const [tutor] = await request('/rest/v1/tutors?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      profile_id: profiles.tutor.id,
      subjects: ['Mathematics'],
      grades: ['Grade 12'],
      hourly_rate: 350,
      status: 'active',
    },
  });

  await request('/rest/v1/organization_members', {
    method: 'POST',
    body: {
      organization_id: directOrganization.id,
      profile_id: profiles.tutor.id,
      org_role: 'tutor',
      status: 'active',
    },
  });

  const [subject] = await request('/rest/v1/subjects?on_conflict=name%2Cgrade%2Ccurriculum&select=*', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { name: 'Mathematics', grade: 'Grade 12', curriculum: 'CAPS' },
  });

  await request('/rest/v1/tutor_student_allocations', {
    method: 'POST',
    body: {
      tutor_id: tutor.id,
      student_id: student.id,
      subject_id: subject.id,
      status: 'active',
      focus_notes: 'Local Supabase authorization journey',
    },
  });

  const [classRecord] = await request('/rest/v1/classes?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      name: fixtureClassName,
      tutor_id: tutor.id,
      subject_id: subject.id,
      grade: 'Grade 12',
      location: 'Local test room',
      day_of_week: 'Monday',
      start_time: '15:00',
      end_time: '16:00',
      status: 'active',
    },
  });

  await request('/rest/v1/class_enrollments', {
    method: 'POST',
    body: {
      class_id: classRecord.id,
      student_id: student.id,
      status: 'active',
    },
  });

  const [assignment] = await request('/rest/v1/assignments?select=id', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      title: fixtureTitle,
      description: 'Seeded only in the disposable local Supabase test stack.',
      subject_id: subject.id,
      grade: 'Grade 12',
      due_date: '2099-12-31T12:00:00.000Z',
      created_by: profiles.tutor.id,
      organization_id: directOrganization.id,
      status: 'published',
    },
  });

  return { assignmentId: assignment.id };
}

async function main() {
  const status = localStatus();
  assertLoopback('Supabase API URL', status.API_URL);
  assertLoopback('Supabase database URL', status.DB_URL);
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase status did not provide anon and service-role keys.');
  }

  const request = makeRequester(status);
  await removePreviousFixtures(request);
  const profiles = await createAuthAndProfiles(request);
  const seededJourney = await seedAcademicJourney(request, profiles);

  const env = {
    ...process.env,
    E2E_SUPABASE_RUNTIME: 'true',
    E2E_SUPABASE_ASSIGNMENT_ID: seededJourney.assignmentId,
    VITE_E2E_AUTH_MOCK: 'false',
    VITE_E2E_AUTH_PASSWORD: password,
    VITE_PO_DEV_ADMIN_MFA_BYPASS: 'false',
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
  };
  execFileSync(process.execPath, [playwrightCli, 'test', '--config', 'playwright.supabase.config.ts'], {
    env,
    stdio: 'inherit',
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
