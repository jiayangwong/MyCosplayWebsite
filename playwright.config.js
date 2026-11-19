// Playwright config: serves the repo root as a static site and runs tests/ at desktop and phone sizes.
const { defineConfig, devices } = require('@playwright/test');

// Google Fonts are never needed by the tests, and a slow fonts.googleapis.com / fonts.gstatic.com load
// stalls 'load' / 'networkidle' and made tests flaky under full-suite load (BUG-2). This Chromium flag makes
// both hosts fail DNS at once, for every test in every project, so no spec has to block them itself.
// page.route mocks (e.g. tests/github-mock.js for api.github.com) run before DNS and are not affected.
const BLOCK_GOOGLE_FONTS = '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  // Cap parallel browsers: too many workers on WSL starve the static server and the browsers.
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { args: [BLOCK_GOOGLE_FONTS] },
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
