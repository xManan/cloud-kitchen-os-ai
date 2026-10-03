import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    port,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // Scripted LLM so the full agent loop runs without an API key.
    env: { MOCK_LLM: "1" },
  },
});
