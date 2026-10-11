const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const supabaseCli = require.resolve('supabase/dist/supabase.js');
const viteCli = path.join(path.dirname(require.resolve('vite')), 'bin', 'vite.js');
const outputDirectory = path.join(process.cwd(), 'docs', 'pitch', 'screenshots');
const port = 5180;
const baseUrl = `http://127.0.0.1:${port}`;
const activityPath = '/dashboard/student/learning/activity/ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE';
const viewport = { width: 1440, height: 900 };

function localStatus() {
  const status = JSON.parse(execFileSync(process.execPath, [supabaseCli, 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }));
  const host = new URL(status.API_URL).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing to capture against a non-local Supabase URL: ${status.API_URL}`);
  }
  return status;
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited before the capture run (code ${server.exitCode}).`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Wait for Vite to bind its local socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the local Vite server.');
}

async function answer(page, value, confidence) {
  await page.getByLabel('Your answer').fill(value);
  await page.locator('label', { hasText: confidence }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
}

async function capture(page, filename) {
  const dimensions = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  if (dimensions.contentWidth > dimensions.viewportWidth) {
    throw new Error(`Refusing to capture ${filename}: page overflows the ${dimensions.viewportWidth}px viewport.`);
  }
  await page.screenshot({ path: path.join(outputDirectory, filename), fullPage: false });
}

async function main() {
  const status = localStatus();
  const server = spawn(process.execPath, [viteCli, '--config', 'vite.app.config.ts', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_E2E_AUTH_MOCK: 'false',
      VITE_PO_DEV_ADMIN_MFA_BYPASS: 'false',
      VITE_SUPABASE_URL: status.API_URL,
      VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
    },
    stdio: 'ignore',
  });

  const failures = [];
  try {
    await waitForServer(server);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport });
      page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(`console: ${message.text()}`);
      });
      page.on('response', (response) => {
        if (response.url().startsWith(status.API_URL) && response.status() >= 400) {
          failures.push(`Supabase ${response.status()}: ${new URL(response.url()).pathname}`);
        }
      });

      await page.goto(`${baseUrl}/dashboard/login`, { waitUntil: 'networkidle' });
      await page.getByLabel('Email').fill('lethabo.mokoena@example.com');
      await page.getByLabel('Password').fill('ProjectOdysseus!23');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(/\/dashboard\/student\/?$/);
      await page.getByText('Lethabo Mokoena', { exact: true }).waitFor();

      await capture(page, '01-dashboard.png');
      await capture(page, '07-school-result-vs-progress.png');

      const demoCta = page.getByLabel('Needs attention').getByRole('link');
      await demoCta.click();
      await page.waitForURL(new RegExp(`${activityPath}$`));
      await answer(page, '(x - 4)(x + 4)', 'A little sure');
      await page.getByRole('button', { name: 'Continue to next step' }).click();

      await page.getByText(/Factorise:\s*x.*25\./).waitFor();
      await capture(page, '02-targeted-activity.png');
      await answer(page, '(x - 5)^2', 'Very sure');
      await page.getByRole('button', { name: 'Try again with this insight' }).waitFor();
      await capture(page, '03-misconception-feedback.png');

      await page.getByRole('button', { name: 'Try again with this insight' }).click();
      await answer(page, '(x - 5)(x + 5)', 'Very sure');
      await page.getByRole('button', { name: 'Continue to next step' }).waitFor();
      await capture(page, '04-correct-retry.png');
      await page.getByRole('button', { name: 'Continue to next step' }).click();

      await answer(page, '(y - 7)(y + 7)', 'Quite sure');
      await page.getByRole('button', { name: 'Continue to next step' }).click();
      await answer(page, '(2x - 3)(2x + 3)', 'Quite sure');
      await page.getByRole('button', { name: 'Continue to next step' }).click();
      await page.getByRole('heading', { name: 'Activity complete' }).waitFor();
      await capture(page, '05-activity-complete.png');

      await page.getByRole('link', { name: 'View updated progress' }).click();
      const dotsProgress = page.getByRole('article').filter({ hasText: /Difference of two squares/i });
      await dotsProgress.waitFor();
      if (await dotsProgress.getByText('Strong understanding', { exact: true }).count()) {
        throw new Error('Golden Demo incorrectly labels Difference of Two Squares as Strong understanding after one retry.');
      }
      await capture(page, '06-learning-progress.png');
    } finally {
      await browser.close();
    }

    if (failures.length) throw new Error(`Unexpected runtime failures during capture:\n${failures.join('\n')}`);
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
