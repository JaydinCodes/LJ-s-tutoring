import { expect, test, type Page } from '@playwright/test';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

async function loginAsStudent(page: Page) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill('student.e2e@projectodysseus.test');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
}

async function capture(page: Page, name: string) {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ fullPage: true, path: `artifacts/careers-phase-3/${name}.png` });
}

test('desktop Careers journey supports discovery, detail, pathway and saved careers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers');
  await expect(page.getByRole('heading', { level: 1, name: 'Careers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Let’s explore your future together.' })).toBeVisible();
  await capture(page, 'desktop-home');

  await page.getByRole('button', { name: /Discover with Odie/ }).click();
  await expect(page).toHaveURL(/view=compass/);
  await expect(page.getByRole('heading', { name: 'Odie’s Career Compass' })).toBeVisible();
  await page.getByRole('button', { name: 'Solving problems' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /See career ideas/ }).click();
  await expect(page.getByRole('heading', { name: 'Your career ideas' })).toBeVisible();
  await capture(page, 'desktop-compass');

  await page.getByRole('button', { name: /Explore career/ }).first().click();
  await expect(page).toHaveURL(/view=career/);
  const careerTitle = await page.locator('h2').first().textContent();
  await expect(page.getByRole('button', { name: 'Explore my pathway' })).toBeVisible();
  await capture(page, 'desktop-career-detail');
  await page.getByRole('button', { name: /Save career/ }).click();
  await expect(page.getByRole('button', { name: /Saved career/ })).toBeVisible();
  await page.getByRole('button', { name: 'Explore my pathway' }).click();
  await expect(page.getByText('Programme eligibility', { exact: true })).toBeVisible();
  await expect(page.getByText('Missing results', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not currently eligible', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: careerTitle ?? '' })).toBeVisible();
  await capture(page, 'desktop-pathway');

  await page.getByRole('button', { name: 'Career overview' }).click();
  await page.getByRole('button', { name: 'Explore careers' }).click();
  await page.getByRole('button', { name: 'Careers home' }).click();
  await expect(page.getByRole('heading', { name: 'Your saved careers' })).toBeVisible();
  await expect(page.getByText(careerTitle ?? '', { exact: true }).first()).toBeVisible();
  await page.goto('/dashboard/student/careers?view=worlds');
  await expect(page.getByRole('heading', { name: 'Explore career worlds' })).toBeVisible();
  await capture(page, 'desktop-career-worlds');
});

test('mobile Careers screens are intentional, keyboard reachable and overflow-free', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);
  const screens = [
    ['home', '/dashboard/student/careers', 'Let’s explore your future together.'],
    ['compass', '/dashboard/student/careers?view=compass', 'Odie’s Career Compass'],
    ['career-worlds', '/dashboard/student/careers?view=worlds', 'Explore career worlds'],
    ['career-detail', '/dashboard/student/careers?view=career&career=software-developer', 'Software Developer'],
    ['pathway', '/dashboard/student/careers?view=pathway&career=software-developer', 'Software Developer'],
  ] as const;
  for (const [name, url, heading] of screens) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
    await capture(page, `mobile-${name}`);
  }

  await page.goto('/dashboard/student/careers?view=worlds');
  const search = page.getByLabel('Search careers');
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).not.toBeFocused();
  await expect(page.getByTestId('student-mobile-navigation')).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  for (const [, url, heading] of screens) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);
  }
});
