const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.cjs',
  forbidOnly: !!process.env.CI,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'PC', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'スマホ', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: { command: 'node scripts/serve.cjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 15000 }
});
