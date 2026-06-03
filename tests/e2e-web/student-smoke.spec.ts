import { expect, test } from '@playwright/test';

type Role = 'ADMIN' | 'TUTOR' | 'STUDENT';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3101';

async function loginAs(page: import('@playwright/test').Page, role: Role, email: string) {
  const response = await page.request.post(`${apiBaseUrl}/test/login-as`, {
    data: { role, email },
  });
  expect(response.ok()).toBeTruthy();

  const cookies = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value.split(';', 1)[0])
    .map((pair) => {
      const idx = pair.indexOf('=');
      return idx >= 0 ? { name: pair.slice(0, idx), value: pair.slice(idx + 1) } : null;
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));

  await page.context().addCookies(cookies.map((entry) => ({
    name: entry.name,
    value: entry.value,
    domain: '127.0.0.1',
    path: '/',
  })));
}

test('student dashboard routes render without crashing and show empty learner states', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await loginAs(page, 'STUDENT', `student-smoke-${Date.now()}@test.local`);

  const routes = [
    { path: '/dashboard/student', heading: 'Student Dashboard', emptyText: 'No assignments due right now' },
    { path: '/dashboard/student/assignments', heading: 'Student Assignments', emptyText: 'No assignments need action' },
    { path: '/dashboard/student/progress', heading: 'Student Progress', emptyText: 'No topic mastery yet' },
    { path: '/dashboard/student/results', heading: 'Results Overview', emptyText: 'No released marks yet' },
    { path: '/dashboard/student/careers', heading: 'Career Discovery Cockpit', emptyText: 'Ask Odie' },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
    await expect(page.getByText(route.emptyText).first()).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
});

test('careers chat shows a graceful error when Odie streaming fails', async ({ page }) => {
  await loginAs(page, 'STUDENT', `student-careers-error-${Date.now()}@test.local`);
  await page.route('**/assistant/careers-chat/stream', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'groq_unavailable' }),
    });
  });

  await page.goto('/dashboard/student/careers');
  await expect(page.getByRole('heading', { name: 'Career Discovery Cockpit' })).toBeVisible();
  await page.getByLabel('Message').fill('What career fits maths and science?');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText(/I cannot connect to Odie right now/)).toBeVisible();
});
