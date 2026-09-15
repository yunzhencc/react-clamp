import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    react: true,
    pnpm: true,
  },
  {
    files: ['tests/*.test.{ts,tsx}'],
    rules: {
      // These suites run with node --test, independently of the Vitest suites.
      'test/no-import-node-test': 'off',
    },
  },
  {
    files: ['tests/browser/**/*.spec.ts'],
    rules: {
      // Browser regressions deliberately exercise the published build.
      'antfu/no-import-dist': 'off',
    },
  },
  {
    files: ['tests/browser/**/*.tsx', 'tests/upstream/react-adapter.ts'],
    rules: {
      // Test entrypoints mount fixtures directly and do not use Fast Refresh.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['tests/upstream/react-adapter.ts'],
    rules: {
      // The adapter must commit fixture updates before layout assertions.
      'react/dom-no-flush-sync': 'off',
    },
  },
)
