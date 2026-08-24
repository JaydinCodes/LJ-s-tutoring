import { expect, test, type Page } from '@playwright/test';

type PortalRole = 'admin' | 'student' | 'tutor';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';
const users: Record<PortalRole, { email: string; dashboard: string; primaryTestId?: string }> = {
  admin: { email: 'admin.e2e@projectodysseus.test', dashboard: '/dashboard/admin' },
  student: { email: 'student.e2e@projectodysseus.test', dashboard: '/dashboard/student', primaryTestId: 'student-primary-action' },
  tutor: { email: 'tutor.e2e@projectodysseus.test', dashboard: '/dashboard/tutor', primaryTestId: 'tutor-primary-action' },
};

test.describe.configure({ mode: 'serial' });

async function loginAs(page: Page, role: PortalRole) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(users[role].email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${users[role].dashboard.replaceAll('/', '\\/')}\\/?$`));
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
] as const) {
  for (const role of Object.keys(users) as PortalRole[]) {
    test(`${role} ${viewport.name} shell keeps navigation and actions usable`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, role);
      await expect(page.getByTestId(`${role}-desktop-sidebar`)).toBeHidden();
      const mobileNav = page.getByTestId(`${role}-mobile-navigation`);
      await expect(mobileNav).toBeVisible({ timeout: 15_000 });
      await expect(mobileNav.getByRole('button', { name: 'More' })).toBeVisible();
      if (users[role].primaryTestId) await expect(page.getByTestId(users[role].primaryTestId!)).toBeVisible();
      await expectNoHorizontalPageOverflow(page);
      await mobileNav.getByRole('button', { name: 'More' }).click();
      const dialog = page.getByRole('dialog', { name: 'More' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close More navigation' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }
}

for (const viewport of [
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const) {
  test(`admin ${viewport.name} navigation is viewport-safe`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loginAs(page, 'admin');
    await expect(page.getByTestId('admin-desktop-sidebar')).toBeVisible();
    const nav = page.getByTestId('admin-desktop-navigation');
    const dimensions = await nav.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY }));
    expect(dimensions.clientHeight).toBeLessThanOrEqual(viewport.height);
    expect(dimensions.overflowY).toBe('auto');
    expect(dimensions.scrollHeight).toBeGreaterThanOrEqual(dimensions.clientHeight);
    await expectNoHorizontalPageOverflow(page);
  });
}

test('saved dark theme is restored after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, 'student');
  await page.goto('/dashboard/student/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
});

test('student desktop identity and sparse-data density match the concept treatment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAs(page, 'student');
  const identity = page.getByRole('link', { name: 'Open student settings' });
  await expect(identity).toBeVisible();
  await expect(identity).toContainText('Student E2E');
  await expect(identity).toContainText('Grade 11');
  await expect(page.getByText('Suggested practice', { exact: true })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
});

test('after screenshots cover the redesigned student, tutor, and admin portals', async ({ page }) => {
  for (const role of Object.keys(users) as PortalRole[]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, role);
    if (users[role].primaryTestId) {
      await expect(page.getByTestId(users[role].primaryTestId!)).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByText('Active learners', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    }
    await page.screenshot({ fullPage: true, path: `artifacts/dashboard-redesign/after-${role}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    if (users[role].primaryTestId) {
      await expect(page.getByTestId(users[role].primaryTestId!)).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByText('Active learners', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    }
    await page.screenshot({ fullPage: true, path: `artifacts/dashboard-redesign/after-${role}-desktop.png` });
    await page.evaluate(() => window.localStorage.removeItem('project-odysseus:e2e-auth'));
  }
});
