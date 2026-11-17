import { expect, test, type Page, type TestInfo } from '@playwright/test';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? '';
const activityPath = '/dashboard/student/learning/activity/ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE';

async function signIn(page: Page) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill('lethabo.mokoena@example.com');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/student\/?$/);
  await expect(page.getByText('Lethabo Mokoena', { exact: true })).toBeVisible();
}

async function confirmNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `page content exceeds the ${dimensions.viewport}px viewport`).toBeLessThanOrEqual(dimensions.viewport);
}

async function answer(page: Page, value: string, confidence: string) {
  await page.getByLabel('Your answer').fill(value);
  await page.locator('label', { hasText: confidence }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
}

async function capturePitchScreen(page: Page, testInfo: TestInfo, name: string) {
  await confirmNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`golden-${name}.png`), fullPage: false });
}

test('Golden Demo learner completes the real DOTS journey', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await signIn(page);

  await expect(page.getByLabel('Needs attention')).toContainText(/Difference of two squares/i);
  const demoCta = page.getByLabel('Needs attention').getByRole('link');
  await expect(demoCta).toHaveAttribute('href', activityPath);
  await demoCta.click();
  await expect(page).toHaveURL(new RegExp(`${activityPath}$`));
  await expect(page.getByText(/Factorise:\s*x.*16\./)).toBeVisible();
  await capturePitchScreen(page, testInfo, 'question-1440');

  await answer(page, '(x - 4)(x + 4)', 'A little sure');
  await expect(page.getByRole('heading', { name: 'Answer correct' })).toBeVisible();
  await capturePitchScreen(page, testInfo, 'correct-feedback-1440');
  await page.getByRole('button', { name: 'Continue to next step' }).click();

  await page.setViewportSize({ width: 1366, height: 960 });
  await expect(page.getByText(/Factorise:\s*x.*25\./)).toBeVisible();
  await capturePitchScreen(page, testInfo, 'question-1366');
  await answer(page, '(x - 5)^2', 'Very sure');
  await expect(page.getByRole('button', { name: 'Try again with this insight' })).toBeVisible();
  await expect(page.locator('.learning-feedback-reason').first()).toBeVisible();
  await expect(page.getByText('DOTS_AS_SQUARE_OF_DIFFERENCE', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 960 });
  await capturePitchScreen(page, testInfo, 'misconception-1024');

  await page.getByRole('button', { name: 'Try again with this insight' }).click();
  await page.setViewportSize({ width: 768, height: 960 });
  await capturePitchScreen(page, testInfo, 'retry-768');
  await answer(page, '(x - 5)(x + 5)', 'Very sure');
  await expect(page.getByRole('button', { name: 'Continue to next step' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 960 });
  await capturePitchScreen(page, testInfo, 'correct-feedback-390');
  await page.getByRole('button', { name: 'Continue to next step' }).click();

  await expect(page.getByText(/Factorise:\s*y.*49\./)).toBeVisible();
  await answer(page, '(y - 7)(y + 7)', 'Quite sure');
  await page.getByRole('button', { name: 'Continue to next step' }).click();

  await expect(page.getByText(/Factorise:\s*4x.*9\./)).toBeVisible();
  await answer(page, '(2x - 3)(2x + 3)', 'Quite sure');
  await page.getByRole('button', { name: 'Continue to next step' }).click();

  await expect(page.getByTestId('activity-state')).toHaveAttribute('data-state', 'complete');
  await expect(page.getByText(/Your answers and feedback are saved/)).toBeVisible();
  await capturePitchScreen(page, testInfo, 'completion-390');
  await page.getByRole('link', { name: /Continue learning|Return to topic/ }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/student\/learning(?:\/topic\/.*)?$/);

  await page.goto('/dashboard/student');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Lethabo/ })).toBeVisible();

  for (const width of [1440, 1366, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/dashboard/student');
    await expect(page.getByLabel('Needs attention')).toBeVisible();
    await confirmNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`golden-dashboard-${width}.png`), fullPage: false });
  }
});

test('Golden Demo reset restores Lethabo to Question 1, Starting, and the original recommendation', async ({ page }) => {
  test.skip(
    process.env.E2E_GOLDEN_DEMO_RESET_VERIFICATION !== 'true',
    'requires the runtime harness to reset the completed Golden Demo fixture first',
  );

  await page.setViewportSize({ width: 1440, height: 960 });
  await signIn(page);

  const recommendation = page.getByLabel('Needs attention');
  await expect(recommendation).toContainText(/Difference of two squares/i);
  await expect(recommendation.getByRole('link')).toHaveAttribute('href', activityPath);

  await page.goto('/dashboard/student/progress');
  const dotsProgress = page.getByRole('article').filter({ hasText: /Difference of two squares/i });
  await expect(dotsProgress).toBeVisible();
  await expect(dotsProgress.locator('span').filter({ hasText: /^Starting$/ })).toBeVisible();

  await page.goto(activityPath);
  // A reset must clear persisted answers, not merely change a visual label.
  await expect(page.getByText('Question 1 of 4', { exact: true })).toBeVisible();
  const progress = page.getByRole('progressbar');
  await expect(progress).toHaveJSProperty('value', 0);
  await expect(progress).toHaveAttribute('max', '4');
  await expect(page.getByText(/Factorise:\s*x.*16\./)).toBeVisible();
});
