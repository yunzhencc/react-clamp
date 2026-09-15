#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const [vitestInput = '.upstream-results/benchmarks.json', metricsInput = process.env.UPSTREAM_BENCHMARK_OUTPUT ?? '.upstream-results/benchmark-metrics.json', output = '.upstream-results/benchmark-summary.json'] = process.argv.slice(2)
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const runner = read(vitestInput)
const metrics = read(metricsInput)
assert.equal(runner.success, true, 'Benchmark process did not finish successfully')
assert.equal(runner.numPassedTests, 9)
assert.equal(runner.numFailedTests, 0)
assert.equal((runner.numPendingTests ?? 0) + (runner.numTodoTests ?? 0), 0)
assert.equal(metrics.mode, 'full')
assert.equal(metrics.status, 'passed')
assert.equal(metrics.matrixComplete, true)
assert.equal(metrics.repetitionCountsVerified, true)

const expected = {
  TEXT_BENCHMARK: 17,
  RICH_BENCHMARK: 12,
  WRAP_BENCHMARK: 27,
  INVALIDATION_BENCHMARK: 2,
  UPDATE_WORK_RESULT: 10,
  PRETEXT_BENCH_RESULT: 39,
  PRETEXT_SCALE_BENCH_RESULT: 2,
  PRETEXT_PREPARE_BREAKDOWN: 3,
  PRETEXT_COLD_MOUNT_RESULT: 2,
}
assert.deepEqual(metrics.workloadCounts, expected)
const payloads = metrics.payloads
for (const [key, runs] of Object.entries({ TEXT_BENCHMARK: 5, RICH_BENCHMARK: 4, WRAP_BENCHMARK: 5, INVALIDATION_BENCHMARK: 5 })) {
  assert.equal(payloads[key].scenarios.length, expected[key])
  for (const scenario of payloads[key].scenarios)
    assert.equal(scenario.summary.runs.length, runs, `${key} repetitions`)
}
for (const scenario of payloads.PRETEXT_SCALE_BENCH_RESULT) {
  assert.equal(scenario.runs.length, 3)
  const summary = scenario.summary
  assert.equal(summary.instances, 200)
  assert.equal(summary.entryCount, 200 * summary.changes)
  assert.equal(summary.callbackCount, summary.entryCount)
  assert.equal(summary.observerInstances, 200)
}
for (const scenario of Object.values(payloads.PRETEXT_PREPARE_BREAKDOWN.paths))
  assert.equal(scenario.runs.length, 5)
assert.equal(payloads.UPDATE_WORK_RESULT.instances, 48)
assert.equal(payloads.UPDATE_WORK_RESULT.updates, 6)

const cases = []
for (const group of Object.keys(expected)) {
  const payload = payloads[group]
  if (payload.scenarios) {
    for (const scenario of payload.scenarios) {
      const { runs, ...summary } = scenario.summary
      cases.push({ group, scenario: scenario.scenario ?? scenario.mode, measuredRuns: runs.length, metrics: summary })
    }
  }
  else
    if (group === 'UPDATE_WORK_RESULT') {
      for (const scenario of payload.results) {
        const { family, measured, affixed, unique, ...phases } = scenario
        cases.push({ group, scenario: [family, measured, affixed, unique].join(':'), metrics: phases })
      }
    }
    else
      if (group === 'PRETEXT_PREPARE_BREAKDOWN') {
        for (const [name, scenario] of Object.entries(payload.paths)) {
          cases.push({ group, scenario: name, measuredRuns: scenario.runs.length, metrics: { ms: scenario.ms, preparations: payload.count } })
        }
      }
      else {
        for (const scenario of payload) {
          if (group === 'PRETEXT_SCALE_BENCH_RESULT') {
            cases.push({ group, scenario: scenario.name, measuredRuns: scenario.runs.length, metrics: scenario.summary })
          }
          else
            if (group === 'PRETEXT_BENCH_RESULT') {
              const { name, pattern, ...summary } = scenario
              cases.push({ group, scenario: `${name}:${pattern}`, measuredRuns: 5, metrics: summary })
            }
            else {
              const { unique, ...summary } = scenario
              cases.push({ group, scenario: unique ? 'unique' : 'repeated', measuredRuns: 5, metrics: summary })
            }
        }
      }
}
assert.equal(cases.length, 114)

const report = {
  upstreamSha: metrics.upstreamSha,
  subject: 'react-clamp',
  mode: 'full',
  status: 'passed',
  matrixComplete: true,
  repetitionCountsVerified: true,
  fileCount: 6,
  testDeclarations: 9,
  expectedWorkloads: 114,
  observedWorkloads: 114,
  skippedWorkloads: 0,
  generatedAt: new Date().toISOString(),
  command: 'pnpm run test:upstream:benchmarks',
  metricsReport: { path: relative(root, resolve(root, metricsInput)) },
  environment: { ...metrics.environment, browser: 'chromium', viewport: { width: 1280, height: 900 } },
  boundaries: [
    'All upstream workload matrices, counters and correctness assertions are retained.',
    'React Profiler update commits replace Vue VNode updates; these are different underlying operations.',
    'This verifies workload coverage and behavior, not performance equivalence with Vue.',
    'No controlled paired baseline was supplied. Timing can be affected by concurrent machine activity.',
  ],
  groups: expected,
}
function round(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value))
    return Math.round(value * 10_000) / 10_000
  }
  if (Array.isArray(value))
    return value.map(round)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, round(entry)]))
  return value
}
const content = `${JSON.stringify(report, null, 2).slice(0, -2)},\n  "cases": [\n${
  cases.map(scenario => `    ${JSON.stringify(round(scenario))}`).join(',\n')}\n  ]\n}\n`
const destination = resolve(root, output)
mkdirSync(dirname(destination), { recursive: true })
writeFileSync(destination, content)
console.log(JSON.stringify({ output: relative(root, destination), cases: cases.length }))
