import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", pretext: "src/pretext.tsx" },
  format: "esm",
  target: "es2022",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  dts: true,
  sourcemap: true,
  clean: true,
  deps: { neverBundle: [/^react(?:-dom)?(?:\/|$)/, "@chenglou/pretext"] },
  banner: { js: '"use client";' },
  publint: true,
});
