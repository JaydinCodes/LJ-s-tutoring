const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildPracticeQuestions } = require('./grade9-term1-learning-content.cjs');

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
  grade9_new: { email: 'grade9-new.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 New Learner' },
  grade9_weak: { email: 'grade9-weak.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Guided Learner' },
  grade9_bridge: { email: 'grade9-bridge.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Bridge Learner' },
  grade9_strong: { email: 'grade9-strong.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Strong Learner' },
  grade9_endline: { email: 'grade9-endline.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Endline Learner' },
  grade9_failed: { email: 'grade9-failed.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Reassessment Learner' },
  grade9_persistence: { email: 'grade9-persistence.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Resume Learner' },
  grade9_security: { email: 'grade9-security.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Security Learner A' },
  grade9_peer: { email: 'grade9-peer.supabase-e2e@projectodysseus.test', fullName: 'Grade 9 Security Learner B' },
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
  return makeTokenRequester(status, status.SERVICE_ROLE_KEY, status.SERVICE_ROLE_KEY);
}

function makeTokenRequester(status, token, apiKey = status.ANON_KEY) {
  return async function request(path, { body, method = 'GET', prefer } = {}) {
    const headers = {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
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

async function signInForAccessToken(status, email) {
  const response = await fetch(`${status.API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: status.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Could not authenticate disposable fixture user ${email}.`);
  return data.access_token;
}

async function assertEdgeRuntimeAvailable(status) {
  const response = await fetch(`${status.API_URL}/functions/v1/evaluate-learning-attempt`, {
    method: 'OPTIONS',
  });
  if (response.status >= 500) {
    throw new Error(
      'The local Supabase Edge Functions runtime is unavailable. Run `npx supabase functions serve` in a separate terminal, then retry `npm run test:e2e:supabase`.',
    );
  }
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
  // The role journey can update the fixture assignment's title. Treat every
  // assignment owned by a known fixture profile as part of the disposable
  // fixture graph as well, so a completed run can be safely run again.
  const assignmentIds = [...new Set([
    ...await selectIds(request, 'assignments', `title=eq.${encodeURIComponent(fixtureTitle)}`),
    ...await selectIds(request, 'assignments', `created_by=${inFilter(profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])}`),
  ])];
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
    const profileRole = role === 'ngo_learner' || role.startsWith('grade9_') ? 'student' : role;
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

  // The production schema refuses active learner/class placement until the
  // tutor has a dated safeguarding verification. This disposable local fixture
  // models a verified record without storing a real document or person data.
  await request('/rest/v1/tutor_vetting_records', {
    method: 'POST',
    body: {
      tutor_id: tutor.id,
      status: 'approved',
      reviewed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      evidence_reference: 'local-e2e-safeguarding-fixture',
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

async function reviewThroughAdmin(adminRequest, rpc, idKey, id, status, note) {
  if (status === 'approved') return;
  if (status === 'draft' || status === 'rejected') {
    await adminRequest(`/rest/v1/rpc/${rpc}`, { method: 'POST', body: { [idKey]: id, p_action: 'submit_for_review', p_notes: note } });
  }
  await adminRequest(`/rest/v1/rpc/${rpc}`, { method: 'POST', body: { [idKey]: id, p_action: 'approve', p_notes: note } });
}

function nestedItemCode(row) {
  const item = Array.isArray(row.question_items) ? row.question_items[0] : row.question_items;
  return item?.item_code || null;
}

function nestedSkillCode(row) {
  const skill = Array.isArray(row.curriculum_skills) ? row.curriculum_skills[0] : row.curriculum_skills;
  return skill?.skill_code || null;
}

async function seedGrade9Term1Fixture(status, request, profiles) {
  const adminToken = await signInForAccessToken(status, users.admin.email);
  const adminRequest = makeTokenRequester(status, adminToken);
  const [directOrganization] = await request('/rest/v1/organizations?select=id&type=eq.direct&limit=1');
  if (!directOrganization?.id) throw new Error('The disposable fixture needs the seeded direct organization.');

  const grade9Roles = Object.keys(users).filter((role) => role.startsWith('grade9_'));
  const students = {};
  for (const role of grade9Roles) {
    const [student] = await request('/rest/v1/students?select=*', {
      method: 'POST', prefer: 'return=representation',
      body: { profile_id: profiles[role].id, grade: 'Grade 9', school: 'Disposable Grade 9 Pilot School', status: 'active', organization_id: directOrganization.id },
    });
    students[role] = student;
  }

  // A publication attempt before review must be rejected by the same RPC that
  // production administrators use. This verifies the validator is enforced,
  // not merely reported by a structural script.
  const definitions = await request('/rest/v1/learning_assessment_definitions?select=id,code,review_status,topic_mastery_policy_id,assessment_type,assessment_route');
  const grade9Definitions = definitions.filter((definition) => definition.code?.startsWith('G9-T1-'));
  const intentionallyInvalid = grade9Definitions.find((definition) => definition.review_status !== 'approved');
  let invalidPublicationRejected = false;
  if (intentionallyInvalid) {
    try {
      await adminRequest('/rest/v1/rpc/publish_learning_assessment_form', { method: 'POST', body: { p_assessment_definition_id: intentionallyInvalid.id } });
    } catch (error) {
      invalidPublicationRejected = /publication_invalid|must_be_approved|requires_approved/i.test(String(error));
      if (!invalidPublicationRejected) throw error;
    }
    if (!invalidPublicationRejected) throw new Error('An invalid formal assessment form was unexpectedly publishable.');
  }

  const instructionalCodes = new Set(buildPracticeQuestions().map((question) => question.code));
  const versionRows = await request('/rest/v1/question_versions?select=id,version_number,review_status,question_items(item_code)');
  const definitionLinks = await request('/rest/v1/learning_assessment_definition_questions?select=learning_assessment_definition_id,question_version_id');
  const definitionIds = new Set(grade9Definitions.map((definition) => definition.id));
  const formalVersionIds = new Set(definitionLinks.filter((link) => definitionIds.has(link.learning_assessment_definition_id)).map((link) => link.question_version_id));
  const versionsToApprove = versionRows.filter((version) => {
    const itemCode = nestedItemCode(version);
    return formalVersionIds.has(version.id) || (version.version_number === 3 && instructionalCodes.has(itemCode));
  });
  const draftQuestionVersion = versionRows.find((version) => version.version_number === 2 && instructionalCodes.has(nestedItemCode(version)) && version.review_status === 'draft');
  if (!draftQuestionVersion) throw new Error('A historical v2 draft question is required to verify draft learner isolation.');
  if (versionsToApprove.length < 328) throw new Error(`Grade 9 fixture expected formal plus v3 practice questions, found ${versionsToApprove.length}.`);
  for (const version of versionsToApprove) {
    await reviewThroughAdmin(adminRequest, 'review_question_version_action', 'p_question_version_id', version.id, version.review_status, 'Disposable Sprint 4 release-gate fixture review.');
  }

  const requiredSkillCodes = new Set(buildPracticeQuestions().map((question) => question.skillCode));
  const lessonRows = await request('/rest/v1/learning_skill_content?select=id,review_status,curriculum_skills(skill_code)');
  const lessons = lessonRows.filter((lesson) => requiredSkillCodes.has(nestedSkillCode(lesson)));
  if (lessons.length !== 19) throw new Error(`Grade 9 fixture expected 19 Sprint 4 lessons, found ${lessons.length}.`);
  for (const lesson of lessons) {
    await reviewThroughAdmin(adminRequest, 'review_learning_skill_content_action', 'p_content_id', lesson.id, lesson.review_status, 'Disposable Sprint 4 release-gate fixture review.');
  }

  const activities = (await request('/rest/v1/learning_activity_templates?select=id,code,review_status'))
    .filter((activity) => /^A\.G[89]\.S4\./.test(activity.code));
  if (activities.length !== 19) throw new Error(`Grade 9 fixture expected 19 Sprint 4 activities, found ${activities.length}.`);
  for (const activity of activities) {
    await reviewThroughAdmin(adminRequest, 'review_learning_activity_action', 'p_activity_id', activity.id, activity.review_status, 'Disposable Sprint 4 release-gate fixture review.');
  }

  const policies = (await request('/rest/v1/topic_mastery_policies?select=id,code,review_status'))
    .filter((policy) => policy.code?.startsWith('G9-T1-'));
  if (policies.length !== 4) throw new Error(`Grade 9 fixture expected four topic policies, found ${policies.length}.`);
  for (const policy of policies) {
    await reviewThroughAdmin(adminRequest, 'review_topic_mastery_policy_action', 'p_policy_id', policy.id, policy.review_status, 'Disposable Sprint 4 release-gate fixture review.');
  }

  for (const definition of grade9Definitions) {
    await reviewThroughAdmin(adminRequest, 'review_learning_assessment_action', 'p_assessment_id', definition.id, definition.review_status, 'Disposable Sprint 4 release-gate fixture review.');
    const validation = await adminRequest('/rest/v1/rpc/get_learning_assessment_publication_validation', { method: 'POST', body: { p_assessment_definition_id: definition.id } });
    if (!validation?.valid) throw new Error(`${definition.code} is not publication-valid: ${JSON.stringify(validation?.errors || [])}`);
  }

  const forms = await request('/rest/v1/learning_assessment_form_versions?select=id,learning_assessment_definition_id,review_status,retired_at');
  for (const definition of grade9Definitions) {
    const hasPublishedForm = forms.some((form) => form.learning_assessment_definition_id === definition.id && form.review_status === 'approved' && !form.retired_at);
    if (!hasPublishedForm) await adminRequest('/rest/v1/rpc/publish_learning_assessment_form', { method: 'POST', body: { p_assessment_definition_id: definition.id } });
  }

  const evidence = {
    fixture: 'sprint4-grade9-real-data',
    publication: {
      invalidFormRejected: invalidPublicationRejected || intentionallyInvalid === undefined,
      reviewedPracticeQuestionVersions: versionsToApprove.filter((version) => instructionalCodes.has(nestedItemCode(version))).length,
      reviewedFormalQuestionVersions: versionsToApprove.filter((version) => formalVersionIds.has(version.id)).length,
      reviewedLessons: lessons.length,
      reviewedActivities: activities.length,
      reviewedPolicies: policies.length,
      publishedForms: grade9Definitions.length,
    },
    students: Object.fromEntries(Object.entries(students).map(([role, student]) => [role, student.id])),
    draftQuestionVersionId: draftQuestionVersion.id,
  };
  const evidenceDir = path.join(process.cwd(), 'test-results', 'sprint4-grade9-real');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'fixture-publication-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

function grade9EvidenceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? grade9EvidenceFiles(target) : [target];
  });
}

function writeGrade9JourneySummary() {
  const scenarios = [
    ['A', 'A-new-learner.json'], ['B', 'B-weak-baseline.json'], ['C', 'C-grade8-bridge.json'], ['D', 'D-strong-baseline.json'],
    ['E', 'E-normal-endline.json'], ['F', 'F-failed-endline.json'], ['G', 'G-persistence.json'], ['H', 'H-security.json'],
  ];
  const root = path.join(process.cwd(), 'test-results');
  const discovered = new Set(grade9EvidenceFiles(root).map((file) => path.basename(file)));
  const summaryDir = path.join(root, 'sprint4-grade9-real');
  fs.mkdirSync(summaryDir, { recursive: true });
  fs.writeFileSync(path.join(summaryDir, 'journey-scenario-summary.json'), `${JSON.stringify({
    suite: 'Sprint 4 Grade 9 real learner journeys',
    generatedAt: new Date().toISOString(),
    scenarios: scenarios.map(([scenario, evidenceFile]) => ({
      scenario,
      status: discovered.has(evidenceFile) ? 'passed' : 'not-passed-or-blocked',
      evidenceFile,
      note: discovered.has(evidenceFile)
        ? 'Scenario completed and wrote authenticated runtime evidence.'
        : 'No passing scenario evidence was written; inspect the Playwright report and failure artifacts.',
    })),
  }, null, 2)}\n`);
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

  await assertEdgeRuntimeAvailable(status);

  const request = makeRequester(status);
  await removePreviousFixtures(request);
  const profiles = await createAuthAndProfiles(request);
  const seededJourney = await seedAcademicJourney(request, profiles);
  const grade9Fixture = await seedGrade9Term1Fixture(status, request, profiles);
  await verifyConcurrentAiJobClaim(request, seededJourney);
  // Keep the Golden Demo in the same real local-Supabase browser gate as the
  // role journeys. The reset script rejects non-local targets and invokes the
  // service-role-only reset RPC; no learner-facing reset path is introduced.
  execFileSync(process.execPath, [path.join(__dirname, 'reset-golden-demo.cjs')], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  const env = {
    ...process.env,
    E2E_SUPABASE_RUNTIME: 'true',
    E2E_SUPABASE_ASSIGNMENT_ID: seededJourney.assignmentId,
    E2E_GRADE9_REAL_JOURNEY: 'true',
    E2E_GRADE9_FIXTURE_EVIDENCE: JSON.stringify(grade9Fixture),
    E2E_GRADE9_NEW_EMAIL: users.grade9_new.email,
    E2E_GRADE9_WEAK_EMAIL: users.grade9_weak.email,
    E2E_GRADE9_BRIDGE_EMAIL: users.grade9_bridge.email,
    E2E_GRADE9_STRONG_EMAIL: users.grade9_strong.email,
    E2E_GRADE9_ENDLINE_EMAIL: users.grade9_endline.email,
    E2E_GRADE9_FAILED_EMAIL: users.grade9_failed.email,
    E2E_GRADE9_PERSISTENCE_EMAIL: users.grade9_persistence.email,
    E2E_GRADE9_SECURITY_EMAIL: users.grade9_security.email,
    E2E_GRADE9_PEER_EMAIL: users.grade9_peer.email,
    VITE_E2E_AUTH_MOCK: 'false',
    VITE_E2E_AUTH_PASSWORD: password,
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
  };
  const playwrightArgs = [playwrightCli, 'test', '--config', 'playwright.supabase.config.ts'];
  // A targeted runtime journey is useful when diagnosing one disposable local
  // role fixture without changing the canonical full-suite command.
  if (process.env.E2E_SUPABASE_GREP) {
    playwrightArgs.push('--grep', process.env.E2E_SUPABASE_GREP);
  }
  try {
    execFileSync(process.execPath, playwrightArgs, {
      env,
      stdio: 'inherit',
    });
  } finally {
    // This records only observed pass evidence. A missing per-scenario file is
    // deliberately reported as not passed/blocked, never as a synthetic pass.
    writeGrade9JourneySummary();
  }

  // A completed Golden Demo mutates the local learner's activity progress.
  // Reapply the service-role-only reset, then verify the next rehearsal starts
  // from the original learner-facing state in a fresh browser process.
  if (!process.env.E2E_SUPABASE_GREP) {
    execFileSync(process.execPath, [path.join(__dirname, 'reset-golden-demo.cjs')], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    execFileSync(process.execPath, [playwrightCli, 'test', '--config', 'playwright.supabase.config.ts', '--grep', 'Golden Demo reset restores Lethabo'], {
      env: {
        ...env,
        E2E_GOLDEN_DEMO_RESET_VERIFICATION: 'true',
      },
      stdio: 'inherit',
    });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
