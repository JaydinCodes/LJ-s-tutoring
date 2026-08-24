import { expect, test, type Page } from '@playwright/test';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';
test.describe.configure({ mode: 'serial' });

async function loginAsStudent(page: Page) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill('student.e2e@projectodysseus.test');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
}

test('career selection enters a shareable Pathway Builder without a forced wizard', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers');

  await expect(page.getByRole('heading', { level: 1, name: 'Pathway Builder' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Choose a career idea to build' })).toBeVisible();
  await page.getByRole('button', { name: 'Build pathway' }).first().click();
  await expect(page).toHaveURL(/career=/);
  await expect(page.getByText('Your pathway', { exact: true })).toBeVisible();
  await expect(page.getByText('Career goal', { exact: true })).toBeVisible();
  await expect(page.getByText('Study routes', { exact: true })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  await page.goBack();
  await expect(page).not.toHaveURL(/career=/);
  await expect(page.getByRole('heading', { name: 'Choose a career idea to build' })).toBeVisible();
});

test('missing learner results remain missing—not ineligible—and Odie waits for submit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');

  await expect(page.getByRole('heading', { name: 'Software Developer' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Not ready', { exact: true })).toBeVisible();
  await expect(page.getByText('Missing results', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not currently eligible', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Ask Odie' }).click();
  const dialog = page.getByRole('dialog', { name: 'Odie career assistant' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Message')).toHaveValue(/Software Developer/);
  await expect(dialog.getByText('Nothing is sent automatically.')).toBeVisible();
  await expect(dialog.locator('.bg-academy-navy')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('mobile programme cards disclose details, keep the action visible, and never overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');

  await expect(page.getByTestId('student-desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();
  const primary = page.getByTestId('pathway-primary-action');
  await expect(primary).toBeVisible({ timeout: 15_000 });
  const actionBox = await primary.boundingBox();
  expect(actionBox).not.toBeNull();
  expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(844);
  await expectNoHorizontalPageOverflow(page);

  const details = page.getByRole('button', { name: 'View details' }).first();
  const panelId = await details.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await details.click();
  await expect(page.locator(`[aria-controls="${panelId}"]`)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await expect(page.locator(`#${panelId}`).getByText('Last-updated date: unavailable.')).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('tablet layout keeps comparison content and bottom navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.getByTestId('student-desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();
  await expect(page.getByText('Programme eligibility', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Eduvos', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('Pathway Builder captures desktop, mobile and dark-mode evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.getByText('Programme eligibility', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ fullPage: true, path: 'artifacts/pathway-builder/after-desktop.png' });

  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expectNoHorizontalPageOverflow(page);
  await page.screenshot({ fullPage: true, path: 'artifacts/pathway-builder/after-desktop-dark.png' });

  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.getByRole('heading', { name: 'Software Developer' })).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalPageOverflow(page);
  await page.screenshot({ fullPage: true, path: 'artifacts/pathway-builder/after-mobile.png' });
});
