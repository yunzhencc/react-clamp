import antfu from "@antfu/eslint-config";

export default antfu({
  type: "lib",
  react: true,
  stylistic: false,
  formatters: false,
  markdown: false,
  // Preserve the existing metadata layout and the single-package pnpm setup.
  jsonc: false,
  yaml: false,
  // Upstream fixtures are pinned verbatim; their own type/runtime checks apply.
  ignores: ["tests/upstream/**", "docs/**", "dist/**", "demo-dist/**", ".upstream-results/**", "test-results/**", "playwright-report/**"],
}, {
  name: "react-clamp/existing-code-conventions",
  rules: {
    "perfectionist/sort-imports": "off",
    "perfectionist/sort-named-imports": "off",
    "perfectionist/sort-exports": "off",
    "perfectionist/sort-named-exports": "off",
    "import/consistent-type-specifier-style": "off",
    "ts/consistent-type-definitions": "off",
    "ts/explicit-function-return-type": "off",
    "ts/method-signature-style": "off",
    "one-var": "off",
    "prefer-template": "off",
    "prefer-arrow-callback": "off",
    "node/prefer-global/process": "off",
    "react/naming-convention-ref-name": "off",
    "e18e/prefer-timer-args": "off",
    "unicorn/escape-case": "off",
    "unicorn/new-for-builtins": "off",
    "unicorn/number-literal-case": "off",
    "unicorn/prefer-number-properties": "off",
    "regexp/no-useless-non-capturing-group": "off",
    "regexp/prefer-d": "off",
    "ts/no-use-before-define": ["error", { functions: false }],
    // React 18 remains supported; the library is not compiled with React Compiler.
    "react/no-forward-ref": "off",
    "react/no-children-to-array": "off",
    "react-refresh/only-export-components": "off",
  },
}, {
  name: "react-clamp/layout-components",
  files: ["src/Clamp.tsx", "src/WrapClamp.tsx", "demo/**/*.tsx"],
  rules: {
    // Layout measurements must publish state before paint. rootTag returns a
    // host tag name, not a newly defined component function.
    "react/set-state-in-effect": "off",
    "react/static-components": "off",
    // WrapClamp preserves the position of primitive children without item keys.
    "react/no-array-index-key": "off",
  },
}, {
  name: "react-clamp/upstream-algorithms",
  files: ["src/engine/**"],
  rules: {
    // These loops advance an index/iterator in a compound guard.
    "no-unmodified-loop-condition": "off",
    // A deferred fit callback closes over state initialized before invocation.
    "ts/no-use-before-define": "off",
  },
}, {
  name: "react-clamp/test-fixtures",
  files: ["tests/**"],
  rules: {
    // Tests intentionally consume built artifacts and keep the Node SSR runner.
    "antfu/no-import-dist": "off",
    "test/no-import-node-test": "off",
    "react/no-array-index-key": "off",
    "regexp/no-super-linear-backtracking": "off",
  },
});
