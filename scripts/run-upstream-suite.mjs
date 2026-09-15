#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { configuredBrowsers, groups, inputs, root } from './upstream-inputs.mjs'

const [group, ...extra] = process.argv.slice(2)
if (!groups.includes(group))
  throw new Error(`Usage: node scripts/run-upstream-suite.mjs ${groups.join('|')} [runner arguments]`)
const directory = join(root, '.upstream-results')
mkdirSync(directory, { recursive: true })
const output = join(directory, `${group}.json`)
if (existsSync(output))
  rmSync(output)
const before = inputs(group)
const startTime = Date.now()
const args = group === 'types'
  ? [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tests/upstream/demo/tsconfig.types.json', ...extra]
  : [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', `vitest.upstream-${group}.config.ts`, '--reporter=default', '--reporter=json', `--outputFile.json=${output}`, ...(group === 'benchmarks' ? ['--reporter=./tests/upstream/benchmarks/reporter.ts'] : []), ...extra]
const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env })
const after = inputs(group)
const report = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { kind: group === 'types' ? 'typecheck' : 'runner-failure', startTime, success: result.status === 0, testResults: [] }
report.reactClampVerification = { group, startTime, endTime: Date.now(), command: [process.execPath, ...args], exitCode: result.status, signal: result.signal, configuredBrowsers: configuredBrowsers(group), smoke: process.env.UPSTREAM_BENCHMARK_SMOKE === '1', runtime: { node: process.version, platform: process.platform, arch: process.arch, packages: Object.fromEntries(['react', 'react-dom', 'vitest', 'typescript', '@playwright/test'].map(name => [name, JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version])) }, before, after, inputsUnchangedDuringRun: before.digest === after.digest }
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Pinned upstream ${group} report: ${output}`)
process.exitCode = result.status === 0 && before.digest === after.digest ? 0 : result.status || 1
