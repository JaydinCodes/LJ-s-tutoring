import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const { buildBank } = require('../../scripts/grade9-term1-assessment-content.cjs') as { buildBank: () => Array<{ prompt: string; correctOption: 'A' | 'B' | 'C' | 'D' }> };
const { buildPracticeQuestions } = require('../../scripts/grade9-term1-learning-content.cjs') as { buildPracticeQuestions: () => Array<{ prompt: string; options: Record<'A' | 'B' | 'C' | 'D', string>; correctOption: 'A' | 'B' | 'C' | 'D' }> };

const password = 'ProjectOdysseus!23';
const assessmentAnswer = new Map(buildBank().map((question) => [question.prompt, question.correctOption]));
const practiceAnswer = new Map(buildPracticeQuestions().map((question) => [question.prompt, question.options[question.correctOption]]));
const emails = {
  newLearner: process.env.E2E_GRADE9_NEW_EMAIL ?? '', weak: process.env.E2E_GRADE9_WEAK_EMAIL ?? '', bridge: process.env.E2E_GRADE9_BRIDGE_EMAIL ?? '',
  strong: process.env.E2E_GRADE9_STRONG_EMAIL ?? '', endline: process.env.E2E_GRADE9_ENDLINE_EMAIL ?? '', failed: process.env.E2E_GRADE9_FAILED_EMAIL ?? '',
  persistence: process.env.E2E_GRADE9_PERSISTENCE_EMAIL ?? '', security: process.env.E2E_GRADE9_SECURITY_EMAIL ?? '', peer: process.env.E2E_GRADE9_PEER_EMAIL ?? '',
};

test.skip(process.env.E2E_GRADE9_REAL_JOURNEY !== 'true', 'requires the disposable local Supabase Grade 9 fixture');

function writeEvidence(testInfo: TestInfo, scenario: string, evidence: Record<string, unknown>) {
  const destination = testInfo.outputPath(`sprint4-grade9-real/${scenario}.json`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify({ scenario, status: 'passed', role: 'student', ...evidence }, null, 2)}\n`);
}

async function capture(page: Page, testInfo: TestInfo, name: string, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth, `${name} must not overflow a ${width}px viewport`).toBeLessThanOrEqual(dimensions.viewport);
  const destination = testInfo.outputPath(`sprint4-grade9-real/${name}-${width}.png`);
  mkdirSync(dirname(destination), { recursive: true });
  await page.screenshot({ path: destination, fullPage: false });
}

async function signIn(page: Page, email: string) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
}

async function authenticatedClient(email: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('The real Grade 9 test requires local Supabase environment variables.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function assessmentTitle(topic: string, kind: string) {
  return new RegExp(`${topic}\\s+—\\s+${kind} Form A`, 'i');
}

async function startAssessment(page: Page, title: RegExp, introductionCapture?: { testInfo: TestInfo; name: string }) {
  await page.goto('/dashboard/student/learning');
  const card = page.getByRole('article').filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('link', { name: 'Read instructions' }).click();
  await expect(page.getByRole('button', { name: 'Start assessment' })).toBeVisible();
  if (introductionCapture) {
    await capture(page, introductionCapture.testInfo, introductionCapture.name, 390, 844);
  }
  await page.getByRole('button', { name: 'Start assessment' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/learning\/assessment\/session\//);
  return page.url().split('/').at(-1) ?? '';
}

async function completeAssessment(page: Page, mode: 'correct' | 'incorrect') {
  for (;;) {
    const choices = page.locator('fieldset[aria-label^="Answer choices"]');
    await expect(choices).toBeVisible();
    const prompt = (await choices.locator('xpath=preceding-sibling::p[1]').textContent())?.trim() ?? '';
    const correct = assessmentAnswer.get(prompt);
    expect(correct, `Test answer key must contain the persisted question prompt: ${prompt}`).toBeTruthy();
    const selected = mode === 'correct' ? correct! : (['A', 'B', 'C', 'D'] as const).find((option) => option !== correct)!;
    const saved = page.waitForResponse((response) => response.url().includes('/rest/v1/rpc/save_my_learning_assessment_answer') && response.ok());
    await choices.locator(`input[value="${selected}"]`).check();
    await saved;
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible()) {
      await next.click();
      continue;
    }
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Submit assessment' }).click();
    await expect(page.getByRole('heading', { name: 'Assessment submitted' })).toBeVisible({ timeout: 20_000 });
    return;
  }
}

async function completeActivity(page: Page, mode: 'correct' | 'incorrect', stopAfterFirst = false) {
  for (;;) {
    const prompt = (await page.locator('h2').last().textContent()) ?? '';
    const keyed = [...practiceAnswer.entries()].find(([text]) => prompt.includes(text));
    expect(keyed, `Test answer key must contain the persisted practice prompt: ${prompt}`).toBeTruthy();
    const correct = keyed![1];
    if (mode === 'correct') await page.getByLabel(correct, { exact: true }).check();
    else {
      const radios = page.locator('input[name="mcq-answer"]');
      const values = await radios.evaluateAll((inputs) => inputs.map((input) => input.value));
      const wrong = values.find((value) => value !== correct);
      await page.getByLabel(wrong!, { exact: true }).check();
    }
    await page.getByLabel('A little sure').check();
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    await expect(page.getByText(/Marks awarded:/)).toBeVisible();
    if (stopAfterFirst) return;
    if (mode === 'incorrect') return;
    await page.getByRole('button', { name: 'Continue to next step' }).click();
    if (await page.getByRole('heading', { name: 'Activity complete' }).isVisible()) return;
  }
}

async function activityState(email: string, activityCode: string) {
  const client = await authenticatedClient(email);
  const { data, error } = await client.rpc('get_my_learning_activity_state', { p_activity_code: activityCode });
  expect(error).toBeNull();
  return data as Array<{ attempt_id: string | null; attempt_status: string | null }>;
}

test('A — a new Grade 9 learner completes a real Integers baseline and receives a persisted recommendation', async ({ page }, testInfo) => {
  await signIn(page, emails.newLearner);
  await capture(page, testInfo, 'learning-dashboard', 390, 844);
  await page.goto('/dashboard/student/learning/topic/INTEGERS');
  await expect(page.getByRole('heading', { name: 'Integers' })).toBeVisible();
  await capture(page, testInfo, 'topic-roadmap', 390, 844);
  const sessionId = await startAssessment(page, assessmentTitle('Integers', 'topic baseline'), { testInfo, name: 'baseline-introduction' });
  await capture(page, testInfo, 'active-formal-assessment', 1440);
  await completeAssessment(page, 'incorrect');
  await expect(page.getByText(/targeted|practice|remediation/i).last()).toBeVisible();
  await capture(page, testInfo, 'baseline-result', 390, 844);
  const client = await authenticatedClient(emails.newLearner);
  const { data, error } = await client.rpc('get_my_learning_assessment_session', { p_session_id: sessionId });
  expect(error).toBeNull();
  expect((data as { status?: string }).status).toBe('submitted');
  writeEvidence(testInfo, 'A-new-learner', { authenticatedUser: emails.newLearner, persistedAssessmentSessionId: sessionId, observed: 'topic baseline submitted and server recommendation rendered' });
});

test('B — a weak learner reads the recommended Integers lesson and receives specific incorrect-answer feedback', async ({ page }, testInfo) => {
  await signIn(page, emails.weak);
  await startAssessment(page, assessmentTitle('Integers', 'topic baseline'));
  await completeAssessment(page, 'incorrect');
  await page.goto('/dashboard/student/learning/topic/INTEGERS');
  await expect(page.getByText('Integer operations and order')).toBeVisible();
  await expect(page.getByText('Worked example')).toBeVisible();
  await capture(page, testInfo, 'integers-lesson-worked-example', 360, 844);
  await page.getByRole('link', { name: 'Start short practice' }).first().click();
  await expect(page.getByText('Calculate −8 + 13.')).toBeVisible();
  await completeActivity(page, 'incorrect', true);
  await expect(page.getByText('Why this choice is not correct')).toBeVisible();
  await expect(page.getByText(/−21 combines the magnitudes/)).toBeVisible();
  await capture(page, testInfo, 'practice-incorrect-feedback', 360, 844);
  await page.getByRole('button', { name: 'Try again with this insight' }).click();
  await page.getByLabel('5', { exact: true }).check();
  await page.getByLabel('Quite sure').check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText('Marks awarded: 1 / 1')).toBeVisible();
  await capture(page, testInfo, 'practice-correct-feedback', 390, 844);
  const progress = await activityState(emails.weak, 'A.G9.S4.INTEGER-OPS');
  expect(progress.some((item) => item.attempt_id && item.attempt_status === 'evaluated')).toBeTruthy();
  writeEvidence(testInfo, 'B-weak-baseline', { authenticatedUser: emails.weak, persistedActivityAttempts: progress.filter((item) => item.attempt_id).length, observed: 'weak baseline, reviewed lesson, persisted guided-practice attempt and explicit selected-distractor feedback' });
});

test('C — Grade 8 bridge support preserves return context to the original Grade 9 topic', async ({ page }, testInfo) => {
  await signIn(page, emails.bridge);
  await page.goto('/dashboard/student/learning/topic/INTEGERS');
  await page.getByRole('button', { name: /Make this my current topic|This is my current topic/ }).click();

  // First create actual weak Grade 8 prerequisite evidence through the same
  // learner-facing activity and evaluator used in a real session.
  await page.goto('/dashboard/student/learning/bridge/G8-NUM-INTEGERS-OPERATIONS?returnTopic=INTEGERS');
  await page.getByRole('link', { name: 'Practise this foundation' }).click();
  await completeActivity(page, 'incorrect', true);
  const bridgeClient = await authenticatedClient(emails.bridge);
  const { data: bridgeMastery, error: bridgeMasteryError } = await bridgeClient.rpc('get_my_learning_mastery_summary');
  expect(bridgeMasteryError).toBeNull();
  expect(JSON.stringify(bridgeMastery)).toContain('G8-NUM-INTEGERS-OPERATIONS');
  expect(JSON.stringify(bridgeMastery)).toContain('emerging');

  // A new weak Grade 9 attempt then consults that persisted prerequisite
  // state and routes the recommendation to the Grade 8 bridge.
  await page.goto('/dashboard/student/learning/activity/A.G9.S4.INTEGER-OPS');
  await completeActivity(page, 'incorrect', true);
  await page.goto('/dashboard/student/learning');
  await expect(page.getByRole('link', { name: 'Open the bridge lesson' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the bridge lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Grade 8 foundation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to your Grade 9 topic' })).toHaveAttribute('href', '/dashboard/student/learning/topic/INTEGERS');
  await capture(page, testInfo, 'grade8-bridge', 390, 844);
  await page.getByRole('link', { name: 'Practise this foundation' }).click();
  await completeActivity(page, 'correct', true);
  const bridgeProgress = await activityState(emails.bridge, 'A.G8.S4.G8-INTEGERS');
  expect(bridgeProgress.filter((item) => item.attempt_id && item.attempt_status === 'evaluated')).toHaveLength(2);
  await page.goto('/dashboard/student/learning/bridge/G8-NUM-INTEGERS-OPERATIONS?returnTopic=INTEGERS');
  await page.getByRole('link', { name: 'Return to your Grade 9 topic' }).click();
  await expect(page).toHaveURL('/dashboard/student/learning/topic/INTEGERS');
  const { data: journey, error: journeyError } = await bridgeClient.rpc('get_my_grade9_term1_learning_journey');
  expect(journeyError).toBeNull();
  expect(JSON.stringify(journey)).toContain('PREREQUISITE_NOT_SECURE');
  expect(JSON.stringify(journey)).toContain('G8-NUM-INTEGERS-OPERATIONS');
  writeEvidence(testInfo, 'C-grade8-bridge', { authenticatedUser: emails.bridge, originalTopic: 'INTEGERS', persistedPrerequisiteState: 'emerging', observed: 'learner-generated prerequisite evidence produced the Grade 8 recommendation; the approved bridge opened through the learner route with return-topic context preserved' });
});

test('D — a strong baseline offers a mastery challenge; challenge evidence awards server-authoritative mastery', async ({ page }, testInfo) => {
  await signIn(page, emails.strong);
  await startAssessment(page, assessmentTitle('Integers', 'topic baseline'));
  await completeAssessment(page, 'correct');
  await page.goto('/dashboard/student/learning');
  const sessionId = await startAssessment(page, assessmentTitle('Integers', 'mastery challenge'));
  await completeAssessment(page, 'correct');
  await expect(page.getByText('mastered', { exact: false }).first()).toBeVisible();
  await capture(page, testInfo, 'mastery-achievement', 1440);
  const client = await authenticatedClient(emails.strong);
  const { data, error } = await client.rpc('get_my_learning_assessment_session', { p_session_id: sessionId });
  expect(error).toBeNull();
  expect(JSON.stringify(data)).toContain('mastered');
  await page.getByRole('link', { name: 'Return to Learning' }).click();
  await capture(page, testInfo, 'return-to-next-topic', 390, 844);
  writeEvidence(testInfo, 'D-strong-baseline', { authenticatedUser: emails.strong, persistedAssessmentSessionId: sessionId, observed: 'baseline alone did not end route; independent mastery challenge produced mastery' });
});

test('E — normal learning followed by an endline awards mastery without a compulsory challenge', async ({ page }, testInfo) => {
  await signIn(page, emails.endline);
  await page.goto('/dashboard/student/learning/activity/A.G9.S4.INTEGER-OPS');
  await completeActivity(page, 'correct');
  await capture(page, testInfo, 'completed-practice', 390, 844);
  await startAssessment(page, assessmentTitle('Integers', 'topic baseline'));
  await completeAssessment(page, 'incorrect');
  const endlineSession = await startAssessment(page, assessmentTitle('Integers', 'endline'));
  await completeAssessment(page, 'correct');
  await expect(page.getByText('mastered', { exact: false }).first()).toBeVisible();
  await capture(page, testInfo, 'endline-mastery-success', 1440);
  const client = await authenticatedClient(emails.endline);
  const { data } = await client.rpc('get_my_learning_assessment_session', { p_session_id: endlineSession });
  expect(JSON.stringify(data)).toContain('mastered');
  writeEvidence(testInfo, 'E-normal-endline', { authenticatedUser: emails.endline, persistedAssessmentSessionId: endlineSession, observed: 'completed guided practice and eligible endline; endline itself awarded mastery' });
});

test('F — failed endline blocks the original form and permits only authorized independent reassessment', async ({ page }, testInfo) => {
  await signIn(page, emails.failed);
  await startAssessment(page, assessmentTitle('Integers', 'topic baseline'));
  await completeAssessment(page, 'incorrect');
  const failedSession = await startAssessment(page, assessmentTitle('Integers', 'endline'));
  await completeAssessment(page, 'incorrect');
  await expect(page.getByText(/Build next|targeted|remediation/i).first()).toBeVisible();
  const student = await authenticatedClient(emails.failed);
  const { data: forms } = await student.rpc('get_my_available_learning_assessments');
  expect(JSON.stringify(forms)).not.toContain('Integers — endline Form A');
  const admin = await authenticatedClient('admin.supabase-e2e@projectodysseus.test');
  const { data: catalogue, error: catalogueError } = await admin.rpc('get_learning_assessment_management_catalog');
  expect(catalogueError).toBeNull();
  const reassessment = (catalogue as { definitions: Array<{ id: string; code: string }> }).definitions.find((definition) => definition.code === 'G9-T1-INTEGERS-MASTERY-ENDLINE-REASSESSMENT-B');
  expect(reassessment).toBeTruthy();
  const { error: authorizationError } = await admin.rpc('authorize_learning_assessment_reassessment', { p_prior_session_id: failedSession, p_reassessment_definition_id: reassessment!.id, p_reason: 'Disposable release-gate reassessment path.' });
  expect(authorizationError).toBeNull();
  await page.goto(`/dashboard/student/learning/assessment/${reassessment!.id}`);
  await expect(page.getByRole('button', { name: 'Start assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Start assessment' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/learning\/assessment\/session\//);
  const reassessmentSessionId = page.url().split('/').at(-1) ?? '';
  await completeAssessment(page, 'correct');
  const { data: reassessmentSession, error: reassessmentSessionError } = await student.rpc('get_my_learning_assessment_session', { p_session_id: reassessmentSessionId });
  expect(reassessmentSessionError).toBeNull();
  expect((reassessmentSession as { status?: string }).status).toBe('submitted');
  writeEvidence(testInfo, 'F-failed-endline', { authenticatedUser: emails.failed, persistedAssessmentSessionId: failedSession, persistedReassessmentSessionId: reassessmentSessionId, observed: 'failed critical evidence, original standard form unavailable, and the administrator-authorized independent reassessment was started and submitted' });
});

test('G — guided-practice state survives refresh and a fresh authenticated session', async ({ page }, testInfo) => {
  await signIn(page, emails.persistence);
  await page.goto('/dashboard/student/learning/activity/A.G9.S4.INTEGER-OPS');
  await completeActivity(page, 'correct', true);
  await page.getByRole('button', { name: 'Continue to next step' }).click();
  await expect(page.getByText('Calculate (−7) × 6.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Calculate (−7) × 6.')).toBeVisible();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await signIn(page, emails.persistence);
  await page.goto('/dashboard/student/learning/activity/A.G9.S4.INTEGER-OPS');
  await expect(page.getByText('Calculate (−7) × 6.')).toBeVisible();
  const progress = await activityState(emails.persistence, 'A.G9.S4.INTEGER-OPS');
  expect(progress.some((item) => item.attempt_id && item.attempt_status === 'evaluated')).toBeTruthy();
  writeEvidence(testInfo, 'G-persistence', { authenticatedUser: emails.persistence, persistedActivityAttempts: progress.filter((item) => item.attempt_id).length, observed: 'first saved response was durable after refresh, cleared browser state, and new authentication' });
});

test('H — RLS, answer release, draft isolation, and publication permissions hold for ordinary students', async ({ page }, testInfo) => {
  await signIn(page, emails.security);
  const a = await authenticatedClient(emails.security);
  const b = await authenticatedClient(emails.peer);
  const { data: peerAssessments } = await b.rpc('get_my_available_learning_assessments');
  const peerBaseline = (peerAssessments as Array<{ definitionId: string }>)[0];
  const { data: peerSession, error: peerStartError } = await b.rpc('start_my_learning_assessment', { p_assessment_definition_id: peerBaseline.definitionId, p_idempotency_key: crypto.randomUUID() });
  expect(peerStartError).toBeNull();
  const { data: crossStudentSession, error: crossStudentError } = await a.rpc('get_my_learning_assessment_session', { p_session_id: peerSession });
  expect(crossStudentError).toBeTruthy();
  expect(crossStudentSession).toBeNull();
  const fixture = JSON.parse(process.env.E2E_GRADE9_FIXTURE_EVIDENCE ?? '{}') as { draftQuestionVersionId?: string };
  const { data: draftDisplay, error: draftError } = await a.rpc('get_learning_question_display', { p_question_version_id: fixture.draftQuestionVersionId });
  expect(draftError).toBeNull();
  expect(draftDisplay).toEqual([]);
  const { error: publishError } = await a.rpc('publish_learning_assessment_form', { p_assessment_definition_id: peerBaseline.definitionId });
  expect(publishError).toBeTruthy();
  const { data: preSubmit } = await b.rpc('get_my_learning_assessment_session', { p_session_id: peerSession });
  expect(JSON.stringify(preSubmit)).not.toContain('correctOption');
  expect(JSON.stringify(preSubmit)).not.toContain('workedSolution');
  await capture(page, testInfo, 'security-student-dashboard', 390, 844);
  writeEvidence(testInfo, 'H-security', { authenticatedUser: emails.security, observed: 'cross-student session denied; draft question hidden; student publication denied; answer key and solutions absent before submission' });
});

test('real no-content and error states remain learner-safe against the disposable database', async ({ page }, testInfo) => {
  await signIn(page, emails.security);
  await page.goto('/dashboard/student/learning/topic/NOT-A-GRADE9-TOPIC');
  await expect(page.getByText('This topic is not ready yet')).toBeVisible();
  await capture(page, testInfo, 'no-content-state', 390, 844);
  await page.goto('/dashboard/student/learning/activity/NOT-AN-APPROVED-ACTIVITY');
  await expect(page.getByText('Activity could not be loaded')).toBeVisible();
  await capture(page, testInfo, 'activity-error-state', 390, 844);
  writeEvidence(testInfo, 'visual-no-content-and-error', { authenticatedUser: emails.security, observed: 'actual unavailable topic and activity routes showed bounded learner-safe states without mocked RPC responses' });
});
