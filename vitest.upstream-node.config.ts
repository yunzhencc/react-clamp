import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/upstream/node/node-setup.ts'],
    include: ['tests/upstream/node/**/*.test.ts'],
  },
})
