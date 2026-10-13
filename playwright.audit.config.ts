import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5176';

export default defineConfig({
  testDir: './tests/audit',
  fullyParallel: true,
  workers: 3,
  timeout: 45000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/audit', open: 'never' }],
  ],
  outputDir: 'test-results/audit',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --config vite.app.config.ts --host 127.0.0.1 --port 5176 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_E2E_AUTH_MOCK: 'true',
      VITE_PO_DEV_ADMIN_MFA_BYPASS: 'true',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'e2e-local-anon-placeholder',
    },
  },
});
