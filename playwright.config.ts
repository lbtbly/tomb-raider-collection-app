import { defineConfig, devices } from "@playwright/test";

// The evidence harness for the core verdict loop (F1, F2, F3, F4, C15).
//
// The base URL is a parameter, never a literal in a spec: F1, F2 and F3 all
// read "on the live URL", and the same run has to be repeatable against the
// deployment the day it exists. Point VITRINE_BASE_URL at it and nothing in
// tests/e2e changes.
const BASE_URL = process.env.VITRINE_BASE_URL ?? "http://localhost:3000";

// A local base URL means this machine owns the server, so the harness starts
// one (or reuses the one already listening). A remote base URL means the
// deployment owns it and Playwright must not try to boot anything.
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE_URL);

// `npm run dev` by default because it needs no build step and the two other
// builders are editing source right now. Set VITRINE_WEB_SERVER_CMD to
// "npm run build && npm run start" for the production-build run, which is the
// only run whose F2 and F3 evidence counts: a service worker that behaves
// only under next dev proves nothing.
const WEB_SERVER_CMD = process.env.VITRINE_WEB_SERVER_CMD ?? "npm run dev";

export default defineConfig({
  testDir: "./tests/e2e",
  // Timing is the measurement. Parallel workers would have the runs compete
  // for the same CPU and the same dev server, so F1's median would measure
  // contention instead of the app.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    // 390 px is the width F4 captures at and the width the design was drawn
    // for, so every screen the harness touches is measured at it.
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    isMobile: false,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "off",
  },
  projects: [{ name: "chromium" }],
  webServer: IS_LOCAL
    ? {
        command: WEB_SERVER_CMD,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
