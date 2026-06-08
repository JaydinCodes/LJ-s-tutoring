import { defineConfig } from '@playwright/test';

const port = Number(process.env.REACT_E2E_PORT ?? 5174);
const webBaseUrl = process.env.REACT_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e-react',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/react', open: 'never' }],
  ],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
