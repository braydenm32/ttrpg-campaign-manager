import { defineConfig, devices } from '@playwright/test'
import { PORT, type Device } from './tests/lib/server'

/**
 * Browser tests (see tests/README.md). They run against the real production build: `vite build`,
 * then `vite preview` on port 4175, in Chromium at two sizes, a laptop and a phone.
 *
 *   npm test                      run everything
 *   npm test -- -u                run everything and rewrite tests/baseline.json (today's known problems)
 *   npm run test:ui               the same tests in Playwright's window, to watch them run
 */
const phone = devices['iPhone 13']

export default defineConfig<{ device: Device }>({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each worker loads the example world once, so a few workers is the sweet spot.
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalTeardown: './tests/teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    // Only for a machine where Chromium is installed by hand: PW_CHROMIUM=1 (or its path) uses that one.
    // Left unset (as on GitHub), Playwright uses the browser `npx playwright install` put in place.
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM === '1' ? '/opt/pw-browsers/chromium' : process.env.PW_CHROMIUM }
      : {},
  },
  projects: [
    {
      name: 'laptop',
      use: { device: 'laptop', viewport: { width: 1366, height: 860 } },
    },
    {
      name: 'phone',
      // The phone runs the screens, search and frame tests; the rest don't depend on the screen size.
      testMatch: /(screens|search|frame)\.spec\.ts/,
      use: {
        device: 'phone',
        viewport: { width: 390, height: 844 },
        userAgent: phone.userAgent,
        deviceScaleFactor: phone.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
