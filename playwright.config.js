// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each worker runs a full browser. More than ~3 at once overloaded this
  // laptop (12 threads) and caused spurious timeouts in scroll/animation tests.
  // Override any time with: npx playwright test --workers=6
  workers: process.env.CI ? '50%' : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Responsive viewports are covered inside responsive.spec.js so every
  // breakpoint runs in one place. Other specs run on desktop + a phone.
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      testIgnore: /responsive\.spec\.js/, // already covers mobile widths explicitly
    },
  ],
  webServer: {
    command: `node scripts/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
