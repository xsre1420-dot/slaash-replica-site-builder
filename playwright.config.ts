import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173/health.json',
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: 'https://placeholder-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key-for-ci-build-only',
          VITE_APP_ENV: 'production',
        },
      }
    : undefined,
});
