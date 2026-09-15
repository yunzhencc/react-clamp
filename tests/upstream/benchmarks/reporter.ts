import type { Reporter, TestRunEndReason } from 'vitest/node'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { summarizePairedSamples } from '../../../scripts/upstream-benchmark-statistics.js'

const prefixes = [
  'TEXT_BENCHMARK',
  'RICH_BENCHMARK',
  'WRAP_BENCHMARK',
  'INVALIDATION_BENCHMARK',
  'UPDATE_WORK_RESULT',
  'PRETEXT_BENCH_RESULT',
  'PRETEXT_SCALE_BENCH_RESULT',
  'PRETEXT_PREPARE_BREAKDOWN',
  'PRETEXT_COLD_MOUNT_RESULT',
] as const
type Payloads = Partial<Record<(typeof prefixes)[number], unknown>>

function numericRunSeries(value: unknown, path = '', output = new Map<string, number[]>()): Map<string, number[]> {
  if (!value || typeof value !== 'object')
    return output
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const key = entry?.scenario ?? entry?.mode
        ?? (entry?.name ? `${entry.name}${entry.pattern ? `:${entry.pattern}` : ''}` : null)
        ?? (entry?.family ? `${entry.family}:${entry.measured}:${entry.affixed}:${entry.unique}` : index)
      numericRunSeries(entry, `${path}/${key}`, output)
    })
    return output
  }
  const object = value as Record<string, unknown>
  if (Array.isArray(object.runs) && object.runs.length >= 2) {
    if (object.runs.every(run => typeof run === 'number' && Number.isFinite(run))) {
      output.set(path, object.runs as number[])
    }
    else if (object.runs[0] && typeof object.runs[0] === 'object') {
      for (const metric of Object.keys(object.runs[0])) {
        const values = object.runs.map(run => run?.[metric])
        if (values.every(number => typeof number === 'number' && Number.isFinite(number))) {
          output.set(`${path}/${metric}`, values)
        }
      }
    }
  }
  for (const [key, entry] of Object.entries(object)) {
    if (key !== 'runs')
      numericRunSeries(entry, `${path}/${key}`, output)
  }
  return output
}

export default class UpstreamBenchmarkReporter implements Reporter {
  private payloads: Payloads = {}

  onUserConsoleLog(log: { content: string }): void {
    for (const prefix of prefixes) {
      const marker = `${prefix} `
      const index = log.content.indexOf(marker)
      if (index !== -1)
        this.payloads[prefix] = JSON.parse(log.content.slice(index + marker.length).trim())
    }
  }

  onTestRunEnd(_modules: unknown, _errors: unknown, reason: TestRunEndReason): void {
    const baselinePath = process.env.UPSTREAM_BENCHMARK_BASELINE
    const comparisons: Record<string, ReturnType<typeof summarizePairedSamples>> = {}
    if (baselinePath) {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
      const before = numericRunSeries(baseline.payloads)
      const after = numericRunSeries(this.payloads)
      for (const [key, values] of after) {
        const previous = before.get(key)
        if (previous && previous.length === values.length) {
          comparisons[key] = summarizePairedSamples(previous, values)
        }
      }
    }
    const destination = resolve(process.env.UPSTREAM_BENCHMARK_OUTPUT ?? '.upstream-results/benchmark-metrics.json')
    const counts = Object.fromEntries(prefixes.map((prefix) => {
      const payload = this.payloads[prefix] as { scenarios?: unknown[], results?: unknown[], paths?: object } | unknown[] | undefined
      const count = Array.isArray(payload)
        ? payload.length
        : payload?.scenarios?.length ?? payload?.results?.length ?? Object.keys(payload?.paths ?? {}).length
      return [prefix, count]
    }))
    const observedWorkloads = Object.values(counts).reduce((sum, count) => sum + count, 0)
    const smoke = process.env.UPSTREAM_BENCHMARK_SMOKE === '1'
    const expectedRuns: Record<string, number> = {
      TEXT_BENCHMARK: smoke ? 1 : 5,
      RICH_BENCHMARK: smoke ? 1 : 4,
      WRAP_BENCHMARK: smoke ? 1 : 5,
      INVALIDATION_BENCHMARK: smoke ? 1 : 5,
    }
    const repetitionChecks = Object.entries(expectedRuns).map(([prefix, expected]) => {
      const payload = this.payloads[prefix as keyof Payloads] as { scenarios?: { summary: { runs: unknown[] } }[] } | undefined
      return payload?.scenarios?.every(({ summary }) => summary.runs.length === expected) ?? false
    })
    const scales = this.payloads.PRETEXT_SCALE_BENCH_RESULT as { runs: unknown[] }[] | undefined
    const preparation = this.payloads.PRETEXT_PREPARE_BREAKDOWN as { paths: Record<string, { runs: unknown[] }> } | undefined
    repetitionChecks.push(scales?.every(({ runs }) => runs.length === (smoke ? 1 : 3)) ?? false)
    repetitionChecks.push(preparation ? Object.values(preparation.paths).every(({ runs }) => runs.length === (smoke ? 1 : 5)) : false)
    const repetitionCountsVerified = repetitionChecks.every(Boolean)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, `${JSON.stringify({
      upstreamSha: '9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84',
      subject: 'react-clamp',
      environment: { node: process.version, platform: process.platform, arch: process.arch },
      mode: process.env.UPSTREAM_BENCHMARK_SMOKE === '1' ? 'smoke' : 'full',
      status: reason,
      payloads: this.payloads,
      baseline: baselinePath ?? null,
      comparisons,
      expectedWorkloads: 114,
      observedWorkloads,
      workloadCounts: counts,
      repetitionCountsVerified,
      matrixComplete: reason === 'passed' && observedWorkloads === 114 && repetitionCountsVerified,
      comparisonNote: 'Paired statistics compare matching ordered repeated runs with a supplied baseline; smoke has one run and cannot support confidence intervals.',
    }, null, 2)}\n`)
    process.stdout.write(`Upstream benchmark report: ${destination}\n`)
    if (reason === 'passed' && observedWorkloads === 114 && !repetitionCountsVerified) {
      throw new Error('Benchmark repetition counts do not match the selected full/smoke mode.')
    }
  }
}
