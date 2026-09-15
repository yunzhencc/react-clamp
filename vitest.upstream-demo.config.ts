import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: 'node_modules/.vite/upstream-demo',
  publicDir: 'demo/public',
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@chenglou/pretext',
      'overlayscrollbars',
    ],
  },
  test: {
    include: ['tests/upstream/demo/**/*.browser.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      ui: false,
      screenshotFailures: false,
      viewport: { width: 1280, height: 900 },
      instances: [{ browser: 'chromium' }],
    },
  },
})
