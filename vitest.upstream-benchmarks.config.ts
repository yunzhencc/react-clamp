import process from 'node:process'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { browserLogFilter } from './scripts/upstream-browser-log-filter.ts'
import UpstreamBenchmarkReporter from './tests/upstream/benchmarks/reporter.ts'

export default defineConfig({
  cacheDir: 'node_modules/.vite/upstream-benchmarks',
  plugins: [browserLogFilter],
  define: {
    __UPSTREAM_BENCHMARK_SMOKE__: JSON.stringify(process.env.UPSTREAM_BENCHMARK_SMOKE === '1'),
  },
  test: {
    reporters: ['default', 'json', new UpstreamBenchmarkReporter()],
    outputFile: { json: '.upstream-results/benchmarks.json' },
    include: ['tests/upstream/benchmarks/**/*.browser.benchmark.ts'],
    fileParallelism: false,
    // Real React commits across the unchanged large wrap matrix need more time.
    testTimeout: process.env.UPSTREAM_BENCHMARK_SMOKE === '1' ? 180_000 : 600_000,
    hookTimeout: 30_000,
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
