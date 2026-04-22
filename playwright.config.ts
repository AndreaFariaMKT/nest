import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke suite. Assumes Supabase local is already running
 * (`npx supabase start`) and that `supabase/seed.sql` seeded the
 * dev owner at dev@nest.local / devpassword.
 *
 * Playwright boots its own Next dev server on port 3101 so it never
 * conflicts with Claude Preview (3100) or a manual `npm run dev` (3000).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
