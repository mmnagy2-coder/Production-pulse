import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for Production Pulse API end-to-end tests.
 *
 * Tests hit the API server directly (no browser UI) so they are not blocked
 * by the sign-in wall. The API server boots in NODE_ENV=test mode which
 * enables the X-Test-User-Id header bypass in requireAuth.ts.
 *
 * Requires DATABASE_URL to point at a database you don't mind writing to.
 */

const TEST_PORT = 4099;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1, // serial — tests share a DB; isolation is handled per-test via unique projects
  reporter: [["list"], ["json", { outputFile: "tests/results.json" }]],

  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    extraHTTPHeaders: {
      // Test-mode auth bypass — accepted only when NODE_ENV=test
      "x-test-user-id": "test-student-user-1",
      "content-type": "application/json",
    },
  },

  webServer: {
    // We can't use `dev` here because it hard-codes `export NODE_ENV=development`.
    // Instead: build first (NODE_ENV=test is safe at build time), then start.
    command: `cd artifacts/api-server && pnpm run build && PORT=${TEST_PORT} NODE_ENV=test node --enable-source-maps ./dist/index.mjs`,
    url: `http://localhost:${TEST_PORT}/api/healthz`,
    reuseExistingServer: false,
    timeout: 90_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
