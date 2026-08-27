import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws on import unless the bundler resolves its
      // `react-server` condition — which is exactly the guard we want in the
      // app, and exactly what stops a unit test importing a server module.
      // Point it at the package's own no-op entry rather than loosening the
      // resolver globally, so the build-time boundary stays real.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Unit tests only. E2E lives in tests/e2e/ via Playwright.
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules", ".next"],
    environment: "node",
    reporters: "default",

    coverage: {
      provider: "v8",
      // Only `src/lib`. The rules live there — the state machines, the date
      // arithmetic, the refusals — and that is what a number here should be
      // measuring. Counting pages and components would move the figure with
      // every layout change and tell nobody anything about whether the
      // domain is covered.
      include: ["src/lib/**"],

      // The I/O boundary, excluded because it cannot be unit tested rather
      // than because it is inconvenient: these are Supabase client factories
      // and thin session/DB reads with no branch to exercise. Left in, they
      // sit at 0% and drag the figure down for no signal — which is how a
      // coverage number stops meaning anything.
      exclude: [
        "src/lib/supabase/**",
        "src/lib/auth.ts",
        "src/lib/client-portal.ts",
        "src/lib/notifications.ts",
        "src/lib/people.ts",
        "src/lib/roles-server.ts",
        "src/lib/tenant-server.ts",
      ],

      reporter: ["text-summary", "lcov"],

      // ROADMAP §4.2's stated target. Actual at the time of writing is
      // comfortably above it (80% statements, 73% branches), and the gap is
      // deliberate: a threshold pinned to today's exact figure fails CI on
      // honest refactors, which teaches people to raise the threshold rather
      // than to write tests.
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
