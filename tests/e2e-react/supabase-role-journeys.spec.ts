import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';

const password = 'ProjectOdysseus!23';
const assignmentId = process.env.E2E_SUPABASE_ASSIGNMENT_ID;

test.skip(process.env.E2E_SUPABASE_RUNTIME !== 'true', 'requires the disposable local Supabase stack');

async function signIn(page: import('@playwright/test').Page, email: string, destination: RegExp) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(destination);
}

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = value.toUpperCase().replace(/=+$/g, '').split('').map((character) => {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Supabase returned an invalid TOTP secret.');
    return index.toString(2).padStart(5, '0');
  }).join('');
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

function observeRuntimeFailures(page: import('@playwright/test').Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    // frame-ancestors is deliberately sent as an HTTP header, so Chromium
    // warns about the duplicate meta directive. The grading call can also be
    // absent in local role-only runs when no third-party Gemini key is set.
    // A generic browser 404 has no request URL on the console event. Supabase
    // responses are recorded below with their concrete path, which keeps this
    // journey focused on real application/API failures rather than dev-server
    // resource noise.
    if (
      message.type() === 'error' &&
      !text.includes("Content Security Policy directive 'frame-ancestors'") &&
      !text.includes('TypeError: Failed to fetch') &&
      !text.includes('Failed to load resource: the server responded with a status of 404')
    ) {
      failures.push(`console: ${text}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().includes(':54321/') && response.status() >= 400) {
      failures.push(`supabase ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });
  return failures;
}

function expectNoUnexpectedRuntimeFailures(failures: string[]) {
  // Local role journeys do not inject a third-party Gemini credential. The
  // application must keep the submitted work durable and human-reviewable in
  // that state; any other failing Supabase request remains a test failure.
  const expectedLocalAiFailures = new Set([
    'supabase 501: /functions/v1/grade-submission',
    'console: Failed to load resource: the server responded with a status of 501 (Not Implemented)',
  ]);
  expect(failures.filter((failure) => !expectedLocalAiFailures.has(failure))).toEqual([]);
}

test('student authenticates through local Supabase, reads seeded work, and is denied admin access', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  await signIn(page, 'student.supabase-e2e@projectodysseus.test', /\/dashboard\/student\/?$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  await page.goto('/dashboard/student/assignments');
  await expect(page.getByRole('heading', { name: 'Assignments', exact: true })).toBeVisible();
  await expect(page.getByText('Local Supabase Algebra Check').first()).toBeVisible();

  await page.getByRole('link', { name: 'Open Local Supabase Algebra Check' }).click();
  await expect(page.getByRole('heading', { name: 'Assignment Detail', exact: true })).toBeVisible();
  await page.getByLabel('Submission note').fill('Real local Supabase academic-loop evidence.');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'local-supabase-evidence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Upload submission' }).click();
  await expect(page.getByText('Submission saved.', { exact: true })).toBeVisible();

  await page.goto('/dashboard/student/reports');
  await expect(page.getByRole('heading', { name: 'Resources', exact: true })).toBeVisible();
  await expect(page.getByText('Local Supabase Calculus Class', { exact: true })).toBeVisible();

  await page.goto('/dashboard/admin');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});

test('tutor authenticates through local Supabase and sees only the seeded allocation', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  await signIn(page, 'tutor.supabase-e2e@projectodysseus.test', /\/dashboard\/tutor\/?$/);
  await expect(page.getByRole('heading', { name: 'Tutor Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('table').filter({ hasText: 'Local Supabase Learner' })).toBeVisible();
  await expect(page.getByText('Local Supabase Algebra Check').first()).toBeVisible();

  await page.goto('/dashboard/tutor/classes');
  await expect(page.getByRole('heading', { name: 'Tutor Classes', exact: true })).toBeVisible();
  await expect(page.getByRole('table').filter({ hasText: 'Local Supabase Calculus Class' })).toBeVisible();

  await page.goto('/dashboard/tutor/submissions');
  await expect(page.getByRole('heading', { name: 'Tutor Submissions', exact: true })).toBeVisible();
  const review = page.getByRole('article').filter({ hasText: 'Local Supabase Algebra Check' });
  await expect(review).toBeVisible();
  await review.getByLabel('Marks awarded').fill('84');
  await review.getByRole('textbox', { name: 'Feedback', exact: true }).fill('Strong local Supabase review.');
  await review.getByLabel('Release marks to learner').check();
  await review.getByLabel('Release feedback and rubric to learner').check();
  await review.getByRole('button', { name: 'Save review' }).click();
  await expect(review.getByText('Submission review saved.', { exact: true })).toBeVisible();
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});

test('a fresh student session sees the tutor-released result and feedback', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  expect(assignmentId).toBeTruthy();
  await signIn(page, 'student.supabase-e2e@projectodysseus.test', /\/dashboard\/student\/?$/);

  await page.goto('/dashboard/student/results');
  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible();
  await expect(page.getByText('84% average', { exact: true })).toBeVisible();

  await page.goto(`/dashboard/student/assignments/${assignmentId}`);
  await expect(page.getByText('Mark: 84%', { exact: true })).toBeVisible();
  await expect(page.getByText('Strong local Supabase review.', { exact: true })).toBeVisible();
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});

test('parent authenticates through local Supabase and sees only linked released results', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  await signIn(page, 'parent.supabase-e2e@projectodysseus.test', /\/dashboard\/parent\/reports\/?$/);
  await expect(page.getByRole('heading', { name: 'My child', exact: true })).toBeVisible();
  await expect(page.getByText('Local Supabase Learner', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').filter({ hasText: 'Local Supabase Algebra Check' })).toBeVisible();
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});

test('NGO partner authenticates through local Supabase and sees a cohort aggregate without learner names', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  await signIn(page, 'ngo.supabase-e2e@projectodysseus.test', /\/dashboard\/ngo\/reports\/?$/);
  await expect(page.getByRole('heading', { name: 'Cohort impact', exact: true })).toBeVisible();
  await expect(page.getByRole('table').filter({ hasText: 'Local Supabase NGO Cohort' })).toBeVisible();
  await expect(page.getByText('Local NGO Learner', { exact: true })).toHaveCount(0);
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});

test('admin authenticates through local Supabase and loads the protected operational view', async ({ page }) => {
  const runtimeFailures = observeRuntimeFailures(page);
  await signIn(page, 'admin.supabase-e2e@projectodysseus.test', /\/dashboard\/admin\/?$/);
  await expect(page.getByRole('heading', { name: 'MFA setup required' })).toBeVisible();
  await page.getByRole('button', { name: 'Start MFA setup' }).click();
  const secret = (await page.locator('code').first().textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel('Authenticator code').fill(currentTotp(secret!));
  await page.getByRole('button', { name: 'Verify and unlock admin' }).click();

  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('table').filter({ hasText: 'Local Supabase School' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review allocations' })).toBeVisible();
  expectNoUnexpectedRuntimeFailures(runtimeFailures);
});
