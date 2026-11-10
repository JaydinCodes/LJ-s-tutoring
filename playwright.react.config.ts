import { defineConfig } from '@playwright/test';

const port = Number(process.env.REACT_E2E_PORT ?? 5174);
const webBaseUrl = process.env.REACT_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
// Cloud and locked-down CI runners can provide a managed Chromium without the
// Playwright download cache. Opt in explicitly so ordinary CI still uses the
// version installed by `playwright install`.
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const video = process.env.PLAYWRIGHT_NO_VIDEO === 'true' ? 'off' : 'retain-on-failure';

export default defineConfig({
  testDir: './tests/e2e-react',
  // The Golden Demo uses the real local Supabase fixture and is covered by
  // playwright.supabase.config.ts. Keep the mock-only smoke suite isolated.
  testIgnore: 'golden-demo-journey.spec.ts',
  timeout: 60_000,
  fullyParallel: true,
  // Vite compiles lazy route chunks on demand. Letting Playwright use half of
  // a high-core-count workstation can starve that first compilation and leave
  // otherwise healthy pages in the route skeleton until the test timeout. Two
  // workers keeps useful parallelism without turning browser QA into a local
  // CPU-contention test.
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  // The visual-QA suite captures evidence on successful journeys as well as
  // failures. Retain those files so CI can publish the review artefact.
  preserveOutput: 'always',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/react', open: 'never' }],
  ],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: `npx vite --config vite.app.config.ts --host 127.0.0.1 --port ${port}`,
    url: webBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_E2E_AUTH_MOCK: 'true',
      VITE_E2E_AUTH_PASSWORD: process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23',
      VITE_PO_DEV_ADMIN_MFA_BYPASS: 'true',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'e2e-local-anon-placeholder',
    },
  },
});
