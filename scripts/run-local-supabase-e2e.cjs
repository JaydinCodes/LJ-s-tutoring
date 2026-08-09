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
  parent: { email: 'parent.supabase-e2e@projectodysseus.test', fullName: 'Local Supabase Parent' },
  ngo_partner: { email: 'ngo.supabase-e2e@projectodysseus.test', fullName: 'Local Supabase NGO Partner' },
  ngo_learner: { email: 'ngo-learner.supabase-e2e@projectodysseus.test', fullName: 'Local NGO Learner' },
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

function inFilter(ids) {
  return `in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;
}

async function selectIds(request, table, filter) {
  const rows = await request(`/rest/v1/${table}?select=id&${filter}`);
  return rows.map((row) => row.id);
}

async function deleteByIds(request, table, column, ids) {
  if (ids.length) {
    await request(`/rest/v1/${table}?${column}=${inFilter(ids)}`, { method: 'DELETE' });
  }
}

async function removePreviousFixtures(request) {
  const fixtureEmails = new Set(Object.values(users).map((user) => user.email));
  const profileEmailFilter = [...fixtureEmails].map((email) => encodeURIComponent(email)).join(',');
  const profileIds = await selectIds(request, 'profiles', `email=${inFilter([...fixtureEmails])}`);
  const studentIds = await selectIds(request, 'students', `profile_id=${inFilter(profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])}`);
  const tutorIds = await selectIds(request, 'tutors', `profile_id=${inFilter(profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])}`);
  const guardianIds = [...new Set([
    ...await selectIds(request, 'guardians', `profile_id=${inFilter(profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])}`),
    ...await selectIds(request, 'guardians', `email=eq.${encodeURIComponent(users.parent.email)}`),
  ])];
  const assignmentIds = await selectIds(request, 'assignments', `title=eq.${encodeURIComponent(fixtureTitle)}`);
  const classIds = await selectIds(request, 'classes', `name=eq.${encodeURIComponent(fixtureClassName)}`);

  // Delete the fixture graph from leaves to owners. Several foreign keys use
  // SET NULL, so deleting a profile first leaves uniquely constrained orphan
  // records (such as guardians) that break a later E2E run.
  await Promise.all([
    deleteByIds(request, 'assignment_submissions', 'assignment_id', assignmentIds),
    deleteByIds(request, 'assignment_submissions', 'student_id', studentIds),
    deleteByIds(request, 'class_enrollments', 'class_id', classIds),
    deleteByIds(request, 'class_enrollments', 'student_id', studentIds),
    deleteByIds(request, 'student_guardians', 'student_id', studentIds),
    deleteByIds(request, 'student_guardians', 'guardian_id', guardianIds),
    deleteByIds(request, 'tutor_student_allocations', 'student_id', studentIds),
    deleteByIds(request, 'tutor_student_allocations', 'tutor_id', tutorIds),
  ]);
  await Promise.all([
    deleteByIds(request, 'assignments', 'id', assignmentIds),
    deleteByIds(request, 'classes', 'id', classIds),
    deleteByIds(request, 'organization_members', 'profile_id', profileIds),
  ]);
  await Promise.all([
    deleteByIds(request, 'students', 'id', studentIds),
    deleteByIds(request, 'tutors', 'id', tutorIds),
    deleteByIds(request, 'guardians', 'id', guardianIds),
  ]);
  await request(`/rest/v1/ngo_partners?contact_email=eq.${encodeURIComponent(users.ngo_partner.email)}`, { method: 'DELETE' });
  await request(`/rest/v1/profiles?email=in.(${profileEmailFilter})`, { method: 'DELETE' });

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
    const profileRole = role === 'ngo_learner' ? 'student' : role;
    const authUser = await request('/auth/v1/admin/users', {
      method: 'POST',
      body: {
        email: fixture.email,
        password,
        email_confirm: true,
        app_metadata: { onboarding_role: profileRole },
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
        role: profileRole,
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

  const [guardian] = await request('/rest/v1/guardians?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      profile_id: profiles.parent.id,
      full_name: users.parent.fullName,
      email: users.parent.email,
      status: 'active',
    },
  });
  await request('/rest/v1/student_guardians', {
    method: 'POST',
    body: {
      student_id: student.id,
      guardian_id: guardian.id,
      relationship_type: 'parent',
      is_primary: true,
      can_receive_reports: true,
      status: 'active',
    },
  });

  const [ngoPartner] = await request('/rest/v1/ngo_partners?select=*', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      name: 'Local Supabase NGO Cohort',
      contact_person: users.ngo_partner.fullName,
      contact_email: users.ngo_partner.email,
    },
  });
  await request(`/rest/v1/organizations?on_conflict=id`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: {
      id: ngoPartner.id,
      name: ngoPartner.name,
      type: 'ngo',
      status: 'active',
    },
  });
  await request('/rest/v1/organization_members', {
    method: 'POST',
    body: {
      organization_id: ngoPartner.id,
      profile_id: profiles.ngo_partner.id,
      org_role: 'partner_viewer',
      status: 'active',
    },
  });
  await request('/rest/v1/students', {
    method: 'POST',
    body: {
      profile_id: profiles.ngo_learner.id,
      grade: 'Grade 11',
      school: 'Local NGO School',
      ngo_partner_id: ngoPartner.id,
      organization_id: ngoPartner.id,
      status: 'active',
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

  return { assignmentId: assignment.id, studentId: student.id };
}

function asRow(value) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function verifyConcurrentAiJobClaim(request, seededJourney) {
  const submissionId = crypto.randomUUID();
  await request('/rest/v1/assignment_submissions', {
    method: 'POST',
    body: {
      id: submissionId,
      assignment_id: seededJourney.assignmentId,
      student_id: seededJourney.studentId,
      text_answer: 'Local runtime AI claim concurrency probe.',
      status: 'submitted',
      ai_grading_status: 'pending',
    },
  });

  const claims = await Promise.all([
    request('/rest/v1/rpc/claim_ai_grading_job', { method: 'POST', body: { p_submission_id: submissionId } }),
    request('/rest/v1/rpc/claim_ai_grading_job', { method: 'POST', body: { p_submission_id: submissionId } }),
  ]);
  const winners = claims.map(asRow).filter((row) => row?.id === submissionId);
  if (winners.length !== 1 || !winners[0].ai_job_claim_token) {
    throw new Error('Concurrent AI job claims must produce exactly one leased winner.');
  }

  const firstToken = winners[0].ai_job_claim_token;
  const failed = asRow(await request('/rest/v1/rpc/fail_ai_grading_job', {
    method: 'POST',
    body: {
      p_submission_id: submissionId,
      p_claim_token: firstToken,
      p_error: 'intentional local runtime retry probe',
      p_retry_after_minutes: 1,
    },
  }));
  if (failed !== true) throw new Error('The winning AI claim must be able to schedule a retry.');

  await request(`/rest/v1/assignment_submissions?id=eq.${submissionId}`, {
    method: 'PATCH',
    body: { ai_job_available_at: new Date(Date.now() - 1_000).toISOString() },
  });
  const retry = asRow(await request('/rest/v1/rpc/claim_ai_grading_job', {
    method: 'POST',
    body: { p_submission_id: submissionId },
  }));
  if (retry?.id !== submissionId || retry.ai_job_attempts !== 2 || retry.ai_job_claim_token === firstToken) {
    throw new Error('AI retry must issue a new lease token and increment the attempt count.');
  }
  // Keep the browser academic-loop fixture singular; this probe exists only to
  // assert the worker's concurrent lease semantics before Playwright starts.
  await request(`/rest/v1/assignment_submissions?id=eq.${submissionId}`, { method: 'DELETE' });
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
  await verifyConcurrentAiJobClaim(request, seededJourney);

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
