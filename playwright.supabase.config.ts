import { defineConfig } from '@playwright/test';

const port = Number(process.env.REACT_SUPABASE_E2E_PORT ?? 5175);
const webBaseUrl = `http://127.0.0.1:${port}`;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Local Supabase URL and anon key are required for runtime browser journeys.');
}
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(supabaseUrl).hostname)) {
  throw new Error('Runtime browser journeys refuse to target a non-local Supabase project.');
}

export default defineConfig({
  testDir: './tests/e2e-react',
  testMatch: 'supabase-role-journeys.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  // The suite creates/verifies a real TOTP factor, so a retry must start from a
  // fresh database reset rather than reusing mutated Auth state in one run.
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/supabase', open: 'never' }],
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
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_E2E_AUTH_MOCK: 'false',
      VITE_PO_DEV_ADMIN_MFA_BYPASS: 'false',
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
    },
  },
});
