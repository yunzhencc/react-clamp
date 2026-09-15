declare const __UPSTREAM_BENCHMARK_SMOKE__: boolean | "true" | "false";
// Vitest's browser define injection can deliver a JSON-literal string. In
// particular, the string "false" must never enable smoke repetitions.
export const benchmarkSmoke = String(__UPSTREAM_BENCHMARK_SMOKE__) === "true";
