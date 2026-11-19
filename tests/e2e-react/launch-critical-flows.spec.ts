import { expect, test, type Page } from '@playwright/test';

type SmokeRole = 'admin' | 'ngo_partner' | 'parent' | 'student' | 'tutor';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

const users: Record<SmokeRole, { email: string; dashboard: string; heading: string | RegExp }> = {
  admin: {
    email: 'admin.e2e@projectodysseus.test',
    dashboard: '/dashboard/admin',
    heading: /Good (morning|afternoon|evening), Admin/,
  },
  ngo_partner: {
    email: 'ngo.e2e@projectodysseus.test',
    dashboard: '/dashboard/ngo/reports',
    heading: 'Cohort impact',
  },
  parent: {
    email: 'parent.e2e@projectodysseus.test',
    dashboard: '/dashboard/parent/reports',
    heading: 'My child',
  },
  student: {
    email: 'student.e2e@projectodysseus.test',
    dashboard: '/dashboard/student',
    heading: /Good (morning|afternoon|evening), Student/,
  },
  tutor: {
    email: 'tutor.e2e@projectodysseus.test',
    dashboard: '/dashboard/tutor',
    heading: /Good (morning|afternoon|evening), Tutor/,
  },
};

async function loginAs(page: Page, role: SmokeRole) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(users[role].email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(users[role].dashboard.replace(/\//g, '\\/')));
}

test.use({ viewport: { width: 390, height: 900 } });

for (const width of [390, 1440]) {
  test(`admin batch release previews and gates reviewed content at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(() => window.localStorage.setItem('project-odysseus:e2e-auth', JSON.stringify({ role: 'admin', email: 'admin.e2e@projectodysseus.test' })));
    const applied: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/**', async (route) => {
      const name = route.request().url().split('/').at(-1);
      let payload: unknown = [];
      if (name === 'get_learning_content_catalog') payload = { items: [], skills: [], misconceptions: [] };
      if (name === 'get_learning_activity_content_catalog') payload = { activities: [] };
      if (name === 'release_grade9_term1_content') {
        const request = route.request().postDataJSON() as Record<string, unknown>;
        if (request.p_apply) applied.push(request);
        payload = { applied: request.p_apply, fingerprint: request.p_include_formal ? 'formal-pack' : 'practice-pack', lessons: 19, practice_questions: 76, activities: 19, formal_questions: request.p_include_formal ? 258 : 0, formal_forms: request.p_include_formal ? 17 : 0, forms_published: 0 };
      }
      await route.fulfill({ json: payload });
    });
    await page.goto('/dashboard/admin/learning-content');
    const section = page.getByRole('region', { name: 'Grade 9 Term 1 publication' });
    const publish = section.getByRole('button', { name: 'Publish reviewed pack', exact: true });
    await expect(publish).toBeDisabled();
    await section.getByLabel('Instructional academic review reference').fill('Reviewed instructional pack fixture');
    await section.getByRole('button', { name: 'Preview release', exact: true }).click();
    await expect(section.getByLabel('Publication preview')).toContainText('76');
    await expect(publish).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`batch-release-${width}.png`) });
    const bounds = await section.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
    page.once('dialog', (dialog) => void dialog.accept());
    await publish.click();
    await expect(section.getByRole('status')).toContainText('Published 19 lessons, 76 practice questions and 19 activities');
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ p_include_formal: false, p_expected_fingerprint: 'practice-pack' });
    await section.getByLabel('Include formal assessments').check();
    await section.getByRole('button', { name: 'Preview release', exact: true }).click();
    await expect(section.getByLabel('Publication preview')).toContainText('258');
    await expect(publish).toBeDisabled();
    await section.getByLabel('Comprehensive formal academic sign-off reference').fill('Independent formal review fixture');
    await expect(publish).toBeDisabled();
    await section.getByRole('button', { name: 'Preview release', exact: true }).click();
    await expect(publish).toBeEnabled();
  });
}

test('public homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Project Odysseus/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tutoring that understands more than the mark/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ask about tutoring/i }).first()).toBeVisible();
});

test('public tutor bios fit on small screens and the carousel stays put', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');

  const selector = page.getByRole('button', { name: 'Show Aaliyah Parker' });
  await selector.click();
  await expect(page.getByRole('link', { name: 'Ask about tutoring support on WhatsApp' })).toHaveCount(0);
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Aaliyah Parker' }) });
  const toggle = card.getByRole('button', { name: 'Read tutor bio' });
  await toggle.click();
  const bio = card.getByText(/Aaliyah helps learners see the logic/);
  await expect(bio).toBeVisible();
  const bounds = await bio.evaluate((element) => {
    const text = element.getBoundingClientRect();
    const cardBounds = element.closest('article')!.getBoundingClientRect();
    return { top: text.top, bottom: text.bottom, cardTop: cardBounds.top, cardBottom: cardBounds.bottom };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.cardTop);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.cardBottom);
  await page.clock.fastForward(10_000);
  await expect(selector).toHaveAttribute('aria-pressed', 'true');
  await expect(bio).toBeVisible();
  await page.getByRole('button', { name: 'Show Jaydin Morrison' }).click();
  await expect(page.getByRole('button', { name: 'Show Jaydin Morrison' })).toHaveAttribute('aria-pressed', 'true');
});

test('public mobile contact button clears the enquiry form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const floatingContact = page.getByRole('link', { name: 'Ask about tutoring support on WhatsApp' });
  await expect(floatingContact).toBeVisible();
  await page.locator('#enquiry').scrollIntoViewIfNeeded();
  await expect(floatingContact).toHaveCount(0);
  await expect(page.getByLabel('Your name')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(floatingContact).toBeVisible();
});

for (const role of Object.keys(users) as SmokeRole[]) {
  test(`${role} can log in and access the correct dashboard`, async ({ page }) => {
    await loginAs(page, role);
    await expect(page.getByRole('heading', { name: users[role].heading }).first()).toBeVisible();
  });
}

test('unauthorized role is blocked from another role dashboard', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/dashboard/admin');
  await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible();
  await expect(page.getByText(/requires admin access/i)).toBeVisible();
});

test('student can view and upload assignment work', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/dashboard/student/assignments');
  await expect(page.getByRole('heading', { level: 1, name: 'Assignments' })).toBeVisible();
  await page.getByRole('table').getByRole('link', { name: 'Quadratic Functions Launch Smoke' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Assignment Details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Quadratic Functions Launch Smoke/i }).first()).toBeVisible();
  await page.getByLabel('Submission note').fill('E2E smoke upload answer.');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'launch-smoke.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 launch smoke'),
  });
  await page.getByRole('button', { name: /Upload submission/i }).click();
  await expect(page.getByText(/Submission saved|Submission uploaded/i).first()).toBeVisible();
});

test('student safely retries one submission after an ambiguous saved response', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/dashboard/student/assignments');
  await page.getByRole('table').getByRole('link', { name: 'Quadratic Functions Launch Smoke' }).click();

  await page.getByLabel('Submission note').fill('Keep this exact payload across the retry.');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'retry-once.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 retry once'),
  });
  const confirmation = page.getByText('I understand this will update my existing submission.');
  if (await confirmation.isVisible()) {
    await confirmation.click();
  }

  const submit = page.getByRole('button', { name: /Upload submission|Update submission/i });
  await submit.click();
  await expect(page.getByText(/Connection interrupted after the submission was saved/i).first()).toBeVisible();

  await submit.click();
  await expect(page.getByText(/Submission saved|Submission uploaded|Resubmission saved/i).first()).toBeVisible();
});

test('tutor can review and mark a submitted assignment', async ({ page }) => {
  await loginAs(page, 'tutor');
  await page.goto('/dashboard/tutor/submissions');
  await expect(page.getByRole('heading', { name: 'Submission review queue' })).toBeVisible();
  await expect(page.getByText('Quadratic Functions Launch Smoke').first()).toBeVisible();
  await page.getByLabel('Marks awarded').first().fill('82');
  await page.getByLabel('Feedback').first().fill('Strong launch smoke review.');
  await page.getByLabel('Release marks to learner').first().check();
  await page.getByLabel('Release feedback and rubric to learner').first().check();
  await page.getByRole('button', { name: /Save review/i }).first().click();
  await expect(page.getByText('Submission review saved.').first()).toBeVisible();
});

test('admin can review a markbook row and release results', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/dashboard/admin/results');
  await expect(page.getByRole('heading', { name: 'Admin Markbook' }).first()).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Quadratic Functions Launch Smoke' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByLabel('Marks awarded').fill('86');
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Admin release smoke feedback.');
  await page.getByLabel('Release marks to learner').check();
  await page.getByLabel('Release feedback and rubric to learner').check();
  await page.getByRole('button', { name: /Save mark/i }).click();
  await expect(page.getByText('No submission selected')).toBeVisible();
});

test('parent can view permitted learner reports', async ({ page }) => {
  await loginAs(page, 'parent');
  await expect(page.getByRole('heading', { name: 'My child' })).toBeVisible();
  await expect(page.getByText('Student E2E').first()).toBeVisible();
  await expect(page.getByText('Quadratic Functions Launch Smoke').first()).toBeVisible();
});

test('NGO partner can view permitted cohort reports', async ({ page }) => {
  await loginAs(page, 'ngo_partner');
  await expect(page.getByRole('heading', { name: 'Cohort impact' })).toBeVisible();
  await expect(page.getByText('ProVision Launch Partner').first()).toBeVisible();
  await expect(page.getByText('Learners').first()).toBeVisible();
});

test('logout clears session and protected routes require login again', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await loginAs(page, 'student');
  await page.getByRole('button', { name: /Sign out/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/login/);

  await page.goto('/dashboard/student');
  await expect(page).toHaveURL(/\/dashboard\/login/);
  await expect(page.getByRole('heading', { name: 'Dashboard access' })).toBeVisible();
});
