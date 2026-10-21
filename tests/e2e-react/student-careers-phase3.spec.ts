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

async function captureViewport(page: Page, name: string) {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `artifacts/careers-phase-3/${name}.png` });
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
  await expect(page.getByRole('button', { name: 'Open My Future Plan' })).toBeVisible();
  await capture(page, 'desktop-career-detail');
  await page.getByRole('button', { name: /Save career/ }).click();
  await expect(page.getByRole('button', { name: /Saved career/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open My Future Plan' }).click();
  await page.getByRole('tab', { name: /Entry requirements/ }).click();
  await expect(page.getByText('Could I meet the requirements?', { exact: true })).toBeVisible();
  await expect(page.getByText('Missing results', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not currently eligible', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: careerTitle ?? '' })).toBeVisible();
  await capture(page, 'desktop-pathway');

  await page.getByRole('tab', { name: /Career overview/ }).click();
  await page.getByRole('button', { name: 'Ask Odie' }).click();
  const desktopOdie = page.getByRole('dialog', { name: 'Odie career assistant' });
  await expect(desktopOdie).toBeVisible();
  const desktopPanel = await desktopOdie.boundingBox();
  expect(desktopPanel?.x).toBeGreaterThan(700);
  expect(desktopPanel?.width).toBeLessThanOrEqual(640);
  await captureViewport(page, 'desktop-viewport-odie-assistant');
  await desktopOdie.getByRole('button', { name: 'Close Odie' }).click();

  await page.goBack();
  await expect(page).toHaveURL(/view=career/);
  await page.goForward();
  await expect(page).toHaveURL(/view=pathway/);

  await page.getByRole('button', { name: 'Career overview', exact: true }).click();
  await page.getByRole('button', { name: 'Explore careers' }).click();
  await page.getByRole('button', { name: 'Careers home' }).click();
  await expect(page.getByRole('heading', { name: 'Your saved careers' })).toBeVisible();
  await expect(page.getByText(careerTitle ?? '', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your saved careers' })).toBeVisible();
  await expect(page.getByText(careerTitle ?? '', { exact: true }).first()).toBeVisible();
  await page.goto('/dashboard/student/careers?view=worlds');
  await expect(page.getByRole('heading', { name: 'Explore career worlds' })).toBeVisible();
  await capture(page, 'desktop-career-worlds');
});

test('Compass skip preserves answers and Odie suggestions remain editable drafts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsStudent(page);
  await page.goto('/dashboard/student/careers?view=compass');
  await page.getByRole('button', { name: 'Solving problems' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Skip this question' }).click();
  await expect(page.getByRole('heading', { name: 'Your career ideas' })).toBeVisible();

  await page.goto('/dashboard/student/careers');
  await expect(page.getByText('Solving problems', { exact: true })).toBeVisible();
  const suggestion = page.getByRole('button', { name: 'What does a software developer actually do?' });
  await suggestion.click();
  const dialog = page.getByRole('dialog', { name: 'Odie career assistant' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Message')).toHaveValue('What does a software developer actually do?');
  await expect(dialog.getByTestId('odie-career-transcript')).not.toContainText('What does a software developer actually do?');

  const mobilePanel = await dialog.boundingBox();
  expect(mobilePanel?.x).toBe(0);
  expect(mobilePanel?.width).toBe(390);
  await captureViewport(page, 'mobile-viewport-odie-assistant');
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
    await captureViewport(page, `mobile-viewport-${name}`);
    await capture(page, `mobile-${name}`);
  }

  await page.goto('/dashboard/student/careers');
  await expect(page.getByRole('button', { name: /Discover with Odie/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browse careers' })).toBeVisible();
  const worldsHeadingBox = await page.getByRole('heading', { name: 'Explore career worlds' }).boundingBox();
  expect(worldsHeadingBox?.y).toBeLessThan(844);

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

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dashboard/student/careers?view=pathway&career=software-developer');
  const panels = page.getByRole('tabpanel');
  await expect(panels).toHaveCount(1);
  const primaryAction = page.getByTestId('pathway-primary-action');
  const primaryActionLabel = await primaryAction.textContent();
  await primaryAction.click();
  const recommendedTab = page.getByRole('tab', { name: primaryActionLabel?.includes('Review entry requirements') ? /Entry requirements/ : /Subjects that matter/ });
  await expect(recommendedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeFocused();

  const overviewTab = page.getByRole('tab', { name: /Career overview/ });
  await overviewTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Subjects that matter/ })).toHaveAttribute('aria-selected', 'true');
  const subjectsPanel = page.getByRole('tabpanel');
  await expect(subjectsPanel).toContainText('Minimum marks vary by programme.');
  await expect(subjectsPanel).not.toContainText(/\d+% minimum/);
  await page.getByRole('tab', { name: /Study routes/ }).click();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Study routes' })).toBeVisible();
});
