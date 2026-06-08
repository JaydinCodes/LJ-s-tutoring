import { expect, test, type Page } from '@playwright/test';

type SmokeRole = 'admin' | 'ngo_partner' | 'parent' | 'student' | 'tutor';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

const users: Record<SmokeRole, { email: string; dashboard: string; heading: string | RegExp }> = {
  admin: {
    email: 'admin.e2e@projectodysseus.test',
    dashboard: '/dashboard/admin',
    heading: 'Admin Dashboard',
  },
  ngo_partner: {
    email: 'ngo.e2e@projectodysseus.test',
    dashboard: '/dashboard/ngo/reports',
    heading: 'NGO Cohort Reports',
  },
  parent: {
    email: 'parent.e2e@projectodysseus.test',
    dashboard: '/dashboard/parent/reports',
    heading: 'Guardian Reports',
  },
  student: {
    email: 'student.e2e@projectodysseus.test',
    dashboard: '/dashboard/student',
    heading: 'Today',
  },
  tutor: {
    email: 'tutor.e2e@projectodysseus.test',
    dashboard: '/dashboard/tutor',
    heading: 'Tutor Dashboard',
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

test('public homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /PO Project Odysseus/i })).toBeVisible();
  await expect(page.getByText(/Targeted CAPS support/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /View programs/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Assignments' }).first()).toBeVisible();
  await page.getByRole('link', { name: /Open Quadratic Functions Launch Smoke/i }).first().click();

  await expect(page.getByRole('heading', { name: 'Assignment Detail' }).first()).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Guardian Reports' })).toBeVisible();
  await expect(page.getByText('Student E2E').first()).toBeVisible();
  await expect(page.getByText('Quadratic Functions Launch Smoke').first()).toBeVisible();
});

test('NGO partner can view permitted cohort reports', async ({ page }) => {
  await loginAs(page, 'ngo_partner');
  await expect(page.getByRole('heading', { name: 'NGO Cohort Reports' })).toBeVisible();
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
