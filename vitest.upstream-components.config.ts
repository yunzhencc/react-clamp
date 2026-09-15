import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { browserLogFilter } from './scripts/upstream-browser-log-filter.ts'

export default defineConfig({
  cacheDir: 'node_modules/.vite/upstream-components',
  plugins: [browserLogFilter],
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', '@chenglou/pretext', 'overlayscrollbars'],
  },
  test: {
    include: ['tests/upstream/components/**/*.browser.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    browser: { enabled: true, provider: playwright(), headless: true, viewport: { width: 1280, height: 900 }, instances: [{ browser: 'chromium' }] },
  },
})
