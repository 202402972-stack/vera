import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/platform-browser",
  outputDir: "./test-results/platform",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3300",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/platform-browser/server.js",
    url: "http://127.0.0.1:3300/api/health",
    reuseExistingServer: false,
  },
});
