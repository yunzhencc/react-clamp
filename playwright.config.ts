import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 3,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: ["chromium", "firefox", "webkit"].map((browserName) => ({
    name: browserName,
    use: {
      browserName: browserName as "chromium" | "firefox" | "webkit",
      ...(browserName === "chromium" && process.env.CLAMP_CHROMIUM_PATH
        ? { launchOptions: { executablePath: process.env.CLAMP_CHROMIUM_PATH } }
        : {}),
    },
  })),
  webServer: {
    command: "pnpm run dev --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
