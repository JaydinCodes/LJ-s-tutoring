import { expect, test, type Page } from '@playwright/test';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

async function loginAsStudent(page: Page) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill('student.e2e@projectodysseus.test');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
  await page.goto('/dashboard/student/assignments');
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible({ timeout: 15_000 });
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
}

test('desktop Smart Task Queue prioritizes learner action and supports deep-linked selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);

  await expect(page.getByText('Next up', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algebra diagnostic corrections' }).first()).toBeVisible();
  await expect(page.getByTestId('task-primary-action')).toHaveText(/Review corrections/);
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();

  const previews = page.getByRole('button', { name: /^Preview / });
  await expect(previews.first()).toHaveAccessibleName('Preview Algebra diagnostic corrections');
  await expect(page.getByRole('complementary', { name: 'Details for Algebra diagnostic corrections' })).toBeVisible();
  await previews.filter({ hasText: 'English evidence paragraph' }).click();
  await expect(page).toHaveURL(/task=e2e-assignment-overdue/);
  await expect(page.getByRole('complementary', { name: 'Details for English evidence paragraph' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('complementary', { name: 'Details for Algebra diagnostic corrections' })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('accessible queue filters isolate submitted and released work', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsStudent(page);

  const due = page.getByRole('tab', { name: /Due/i });
  const submitted = page.getByRole('tab', { name: /Submitted/i });
  const marked = page.getByRole('tab', { name: /Marked/i });
  await expect(due).toHaveAttribute('aria-selected', 'true');

  await submitted.click();
  await expect(submitted).toHaveAttribute('aria-selected', 'true');
  await expect(due).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('heading', { name: 'Waiting for feedback' })).toBeVisible();
  await expect(page.getByText('Geometry proof set').first()).toBeVisible();
  await expect(page.getByText('Overdue — action needed')).toHaveCount(0);

  await marked.click();
  await expect(marked).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Recently marked' })).toBeVisible();
  await expect(page.getByText('Photosynthesis lab review').first()).toBeVisible();
  await expect(page.getByText('88%')).toBeVisible();
});

test('mobile queue stacks, keeps the primary action visible, and opens full-page details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);

  await expect(page.getByTestId('student-desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();
  const primaryAction = page.getByTestId('task-primary-action');
  await expect(primaryAction).toBeVisible();
  const actionBox = await primaryAction.boundingBox();
  expect(actionBox).not.toBeNull();
  expect((actionBox?.y || 0) + (actionBox?.height || 0)).toBeLessThanOrEqual(844);
  await expectNoHorizontalPageOverflow(page);

  await page.getByRole('link', { name: /Open Algebra diagnostic corrections/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/assignments\/e2e-assignment-returned/);
  await expect(page.getByRole('heading', { level: 1, name: 'Assignment Detail' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algebra diagnostic corrections' })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('contextual empty and submitted-only states omit an empty detail panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'empty'));
  await page.reload();
  await expect(page.getByText('No assignments yet')).toBeVisible();
  await expect(page.locator('aside[aria-label^="Details for"]')).toHaveCount(0);

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'submitted-only'));
  await page.reload();
  await expect(page.getByRole('heading', { name: "You're caught up" })).toBeVisible();
  await expect(page.locator('aside[aria-label^="Details for"]')).toHaveCount(0);
  await page.getByRole('tab', { name: /Submitted/i }).click();
  await expect(page.getByText('Geometry proof set').first()).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Details for Geometry proof set' })).toBeVisible();
});

test('released-only and null-date states remain explicit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsStudent(page);

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'marked-only'));
  await page.reload();
  await expect(page.getByRole('heading', { name: "You're caught up" })).toBeVisible();
  await page.getByRole('tab', { name: /Marked/i }).click();
  await expect(page.getByText('Photosynthesis lab review').first()).toBeVisible();
  await expect(page.getByText('88%')).toBeVisible();

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'null-due'));
  await page.reload();
  await expect(page.getByText('Ancient Greece source reflection').first()).toBeVisible();
  await expect(page.getByText('No due date').first()).toBeVisible();
});

test('loading and repository error states use the shared design language', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'loading'));
  await page.reload();
  await expect(page.getByLabel('Loading task queue')).toBeVisible();
  await expect(page.getByTestId('task-primary-action')).toBeVisible();

  await page.evaluate(() => window.localStorage.setItem('project-odysseus:e2e-task-queue-state', 'error'));
  await page.reload();
  await expect(page.getByText('Tasks unavailable')).toBeVisible();
  await expect(page.getByText('The task queue could not be loaded.')).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('Smart Task Queue remains readable in dark mode and captures desktop/mobile evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.goto('/dashboard/student/assignments');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expectNoHorizontalPageOverflow(page);
  await page.waitForTimeout(500);
  await page.screenshot({ fullPage: true, path: 'artifacts/smart-task-queue/after-desktop-dark.png' });

  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.goto('/dashboard/student/assignments');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.waitForTimeout(500);
  await page.screenshot({ fullPage: true, path: 'artifacts/smart-task-queue/after-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expectNoHorizontalPageOverflow(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/smart-task-queue/after-mobile.png' });
});
