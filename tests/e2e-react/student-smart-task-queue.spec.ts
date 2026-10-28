import { expect, test, type Page } from '@playwright/test';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

async function loginAsStudent(page: Page) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill('student.e2e@projectodysseus.test');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
  await page.goto('/dashboard/student/assignments');
  await expect(page.getByRole('heading', { level: 1, name: 'Assignments' })).toBeVisible({ timeout: 15_000 });
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
}

const table = (page: Page) => page.getByRole('table');

test('desktop LMS shows a six-column assignment table and navigates through its title', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);

  const list = table(page);
  await expect(list).toBeVisible();
  for (const name of ['Assignment Title', 'Status', 'Posted', 'Due Date', 'Submitted Date', 'Grade']) {
    await expect(list.getByRole('columnheader', { name })).toBeVisible();
  }
  await expect(list.getByRole('link', { name: 'Algebra diagnostic corrections' })).toBeVisible();
  await expect(page.getByText('Next up', { exact: true })).toHaveCount(0);
  await expect(page.locator('aside[aria-label^="Details for"]')).toHaveCount(0);

  await list.getByRole('link', { name: 'Algebra diagnostic corrections' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/assignments\/e2e-assignment-returned/);
  await expect(page.getByRole('heading', { name: 'Assignment Details', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Algebra diagnostic corrections/ })).toBeVisible();
  await expect(page.getByText('Questions 3 and 5 need corrected substitution steps.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to assignment list' }).click();
  await expect(list).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('LMS dropdown filters submitted and released work, and search finds titles', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsStudent(page);
  const view = page.getByRole('combobox', { name: 'View assignments' });

  await view.selectOption('submitted');
  await expect(table(page).getByRole('link', { name: 'Geometry proof set' })).toBeVisible();
  await expect(table(page).getByRole('link', { name: 'English evidence paragraph' })).toHaveCount(0);

  await view.selectOption('graded');
  await expect(table(page).getByRole('link', { name: 'Photosynthesis lab review' })).toBeVisible();
  await expect(table(page).getByText('88%')).toBeVisible();
  await expect(table(page).getByRole('link', { name: 'Geometry proof set' })).toHaveCount(0);

  await view.selectOption('all');
  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('English evidence');
  await expect(table(page).getByRole('link', { name: 'English evidence paragraph' })).toBeVisible();
  await expect(table(page).getByRole('link', { name: 'Photosynthesis lab review' })).toHaveCount(0);
});

test('mobile retains a horizontally scrollable table and opens an assignment detail page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);
  await expect(page.getByTestId('student-desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();
  await expect(table(page)).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  await table(page).getByRole('link', { name: 'Algebra diagnostic corrections' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/assignments\/e2e-assignment-returned/);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignment Details' })).toBeVisible();
  await expect(page.getByText('Submitted Attachments', { exact: true })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('empty and submitted-only datasets keep the table and remove the side preview', async ({ page }) => {
  await loginAsStudent(page);
  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'empty'));
  await page.reload();
  await expect(table(page)).toBeVisible();
  await expect(table(page).getByText('No assignments yet. Published assignments will appear here.')).toBeVisible();
  await expect(page.locator('aside[aria-label^="Details for"]')).toHaveCount(0);

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'submitted-only'));
  await page.reload();
  await expect(table(page).getByRole('link', { name: 'Geometry proof set' })).toBeVisible();
  await page.getByRole('combobox', { name: 'View assignments' }).selectOption('submitted');
  await expect(table(page).getByRole('link', { name: 'Geometry proof set' })).toBeVisible();
  await expect(page.locator('aside[aria-label^="Details for"]')).toHaveCount(0);
});

test('released-only and null-date records have explicit LMS table cells', async ({ page }) => {
  await loginAsStudent(page);
  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'marked-only'));
  await page.reload();
  await expect(table(page).getByRole('link', { name: 'Photosynthesis lab review' })).toBeVisible();
  await expect(table(page).getByText('88%')).toBeVisible();

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'null-due'));
  await page.reload();
  const row = table(page).getByRole('row').filter({ hasText: 'Ancient Greece source reflection' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(3)).toHaveText('—');
});

test('loading resolves to the LMS table and repository errors remain actionable', async ({ page }) => {
  await loginAsStudent(page);
  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'loading'));
  await page.reload();
  await expect(table(page)).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'error'));
  await page.reload();
  await expect(page.getByText('Assignments unavailable')).toBeVisible();
  await expect(page.getByText('The task queue could not be loaded.')).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('LMS table stays readable in dark mode on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.goto('/dashboard/student/assignments');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(table(page)).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.goto('/dashboard/student/assignments');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(table(page)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(table(page)).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});
