import { expect, test, type Page } from '@playwright/test';
import { E2E_TEST_PASSWORD } from '../../src/lib/e2e/mockAuth';

const users = {
  student: 'student.e2e@projectodysseus.test',
  tutor: 'tutor.e2e@projectodysseus.test',
  admin: 'admin.e2e@projectodysseus.test',
  parent: 'parent.e2e@projectodysseus.test',
  ngo: 'ngo.e2e@projectodysseus.test',
} as const;

type Role = 'public' | keyof typeof users;

const routes: Record<Role, string[]> = {
  public: ['/', '/about', '/programs', '/privacy', '/terms', '/dashboard/login'],
  student: [
    '/dashboard/student', '/dashboard/student/assignments',
    '/dashboard/student/progress', '/dashboard/student/results',
    '/dashboard/student/careers', '/dashboard/student/reports',
    '/dashboard/student/community', '/dashboard/student/settings',
  ],
  tutor: [
    '/dashboard/tutor', '/dashboard/tutor/classes',
    '/dashboard/tutor/sessions', '/dashboard/tutor/submissions',
    '/dashboard/tutor/reports', '/dashboard/tutor/risk',
  ],
  admin: [
    '/dashboard/admin', '/dashboard/admin/users', '/dashboard/admin/students',
    '/dashboard/admin/tutors', '/dashboard/admin/allocations',
    '/dashboard/admin/classes', '/dashboard/admin/assignments',
    '/dashboard/admin/approvals', '/dashboard/admin/payments',
    '/dashboard/admin/payroll', '/dashboard/admin/reconciliation',
    '/dashboard/admin/reports', '/dashboard/admin/results',
    '/dashboard/admin/audit', '/dashboard/admin/privacy-requests',
    '/dashboard/admin/retention', '/dashboard/admin/ops-runbook',
  ],
  parent: ['/dashboard/parent/reports'],
  ngo: ['/dashboard/ngo/reports'],
};

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

async function signIn(page: Page, role: Exclude<Role, 'public'>) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(users[role]);
  await page.getByLabel('Password').fill(E2E_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/dashboard\/login\/?$/);
}

for (const viewport of viewports) {
  for (const role of Object.keys(routes) as Role[]) {
    for (const route of routes[role]) {
      test(`${viewport.name} / ${role} / ${route}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const browserErrors: string[] = [];
        const failedRequests: string[] = [];
        page.on('pageerror', error => browserErrors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error') browserErrors.push(message.text());
        });
        page.on('requestfailed', request => {
          if (new URL(request.url()).hostname === '127.0.0.1') {
            failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
          }
        });

        if (role !== 'public') await signIn(page, role);
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.locator('body').waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready.then(() => true));

        const geometry = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        const observation = {
          role, route, viewport, finalPath: new URL(page.url()).pathname,
          httpStatus: response?.status() ?? null,
          title: await page.title(),
          heading: (await page.locator('h1').first().textContent().catch(() => null))?.trim() ?? null,
          horizontalOverflowPx: Math.max(0, geometry.scrollWidth - geometry.width),
          browserErrors, failedRequests,
        };
        const screenshot = testInfo.outputPath('full-page.png');
        await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
        await testInfo.attach('full-page', { path: screenshot, contentType: 'image/png' });
        await testInfo.attach('observations', {
          body: Buffer.from(JSON.stringify(observation, null, 2)),
          contentType: 'application/json',
        });

        expect.soft(observation.httpStatus).toBeLessThan(400);
        expect.soft(observation.horizontalOverflowPx).toBeLessThanOrEqual(1);
        if (role !== 'public') {
          expect.soft(observation.finalPath).not.toBe('/dashboard/login');
        }
      });
    }
  }
}
