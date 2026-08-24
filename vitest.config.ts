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
  },
});
