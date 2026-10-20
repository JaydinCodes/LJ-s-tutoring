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

test('career exploration enters a shareable Future Plan without a forced wizard', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers');

  await expect(page.getByRole('heading', { level: 1, name: 'Careers' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Let’s explore your future together.' })).toBeVisible();
  await page.getByRole('button', { name: /Browse careers/ }).click();
  await page.getByLabel('Search careers').fill('Software Developer');
  await page.getByRole('button', { name: 'Open Software Developer' }).click();
  await page.getByRole('button', { name: 'Open My Future Plan' }).click();
  await expect(page).toHaveURL(/view=pathway.*career=software-developer/);
  await expect(page.getByText('My Future Pathway', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('tab', { name: /1\. Career overview/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /3\. Study routes/ })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  await page.goBack();
  await expect(page).toHaveURL(/view=career.*career=software-developer/);
  await expect(page.getByRole('button', { name: 'Open My Future Plan' })).toBeVisible();
});

test('missing learner results remain missing—not ineligible—and Odie waits for submit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');

  await expect(page.getByRole('heading', { name: 'Software Developer' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: /4\. Entry requirements/ }).click();
  await expect(page.getByText('Not ready', { exact: true })).toBeVisible();
  await expect(page.getByText('Missing results', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not currently eligible', { exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: /1\. Career overview/ }).click();
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

  await page.getByRole('tab', { name: /4\. Entry requirements/ }).click();
  await expect(page.locator('#pathway-overview-panel')).toBeHidden();
  await expect(page.locator('#pathway-requirements-panel')).toBeVisible();
  const details = page.getByText('View programme details', { exact: true }).first();
  await details.click();
  await expect(page.getByText(/Last updated date: unavailable\./).first()).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('tablet layout keeps comparison content and bottom navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.getByTestId('student-desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();
  await page.getByRole('tab', { name: /4\. Entry requirements/ }).click();
  await expect(page.getByText('Could I meet the requirements?', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#pathway-requirements-panel').getByText('Eduvos', { exact: true })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('Pathway Builder captures desktop, mobile and dark-mode evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?career=software-developer');
  await page.getByRole('tab', { name: /4\. Entry requirements/ }).click();
  await expect(page.getByText('Could I meet the requirements?', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ fullPage: true, path: 'artifacts/pathway-builder/after-desktop.png' });

  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.goto('/dashboard/student/careers?career=software-developer');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('tab', { name: /4\. Entry requirements/ }).click();
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
