#!/usr/bin/env node
/** Offline upstream census. Usage: node scripts/upstream-inventory.mjs <upstream-git-root> [--write] */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const pinnedCommit = '9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(projectRoot, 'docs/upstream-test-inventory.json');
const args = process.argv.slice(2);
assert(args[0] && !args[0].startsWith('-'), 'Supply the local upstream Git root; no network access is performed.');
assert(args.slice(1).every((arg) => arg === '--write'), 'Only --write is supported after the upstream root.');
const upstreamRoot = resolve(args[0]);
assert.equal(execFileSync('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pinnedCommit, 'Upstream HEAD must match the pinned commit.');
const testsRoot = join(upstreamRoot, 'packages/vue-clamp/tests');
const pending = () => ({ status: 'pending', localTests: [], evidence: [], note: 'No behavior-level correspondence has been verified by this census.' });
const filesUnder = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)]).sort();
const unwrap = (node) => {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node))) node = node.expression;
  return node;
};

function inspect(path) {
  const bytes = readFileSync(path);
  const name = relative(testsRoot, path);
  const category = name.endsWith('.benchmark.ts') ? 'browser-benchmark'
    : name.endsWith('.test.ts') ? name === 'demo-page.browser.test.ts' ? 'website-browser-test'
      : /(?:template-ref|wrap-render)-source/.test(name) ? 'vue-source-contract-test'
      : name.endsWith('.browser.test.ts') ? 'library-browser-test' : 'node-test'
    : ['type-surface.ts', 'wrap-slot-types.vue'].includes(name) ? 'type-contract'
    : name === 'env.d.ts' ? 'test-environment-types'
    : name.endsWith('.ts') ? 'test-utility' : 'test-fixture';
  const result = { path: `packages/vue-clamp/tests/${name}`, sha256: createHash('sha256').update(bytes).digest('hex'), category, declarations: [], correspondence: pending() };
  if (!name.endsWith('.ts')) return result;
  const source = ts.createSourceFile(name, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const endLine = (node) => source.getLineAndCharacterOfPosition(node.end).line + 1;
  const text = (node) => node?.getText(source) ?? null;
  const definitions = new Map();
  const collect = (node) => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) definitions.set(node.name.text, node.initializer); ts.forEachChild(node, collect); };
  collect(source);
  // Resolve array cardinality only when proven by syntax. Never execute upstream code.
  function arrayElements(node, seen = new Set()) {
    node = unwrap(node);
    if (!node) return null;
    if (ts.isIdentifier(node)) {
      if (seen.has(node.text)) return null;
      return arrayElements(definitions.get(node.text), new Set([...seen, node.text]));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression;
      if (ts.isIdentifier(receiver) && receiver.text === 'Object' && ['entries', 'keys', 'values'].includes(method)) {
        const object = unwrap(node.arguments[0]);
        if (object && ts.isObjectLiteralExpression(object) && object.properties.every((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))) {
          return object.properties.map((property) => method === 'keys' ? text(property.name) : method === 'values' ? text(property.initializer ?? property.name) : `[${JSON.stringify(text(property.name))}, ${text(property.initializer ?? property.name)}]`);
        }
      }
      if (['map', 'flatMap'].includes(method)) {
        const inputs = arrayElements(receiver, seen);
        const callback = node.arguments[0];
        if (inputs && callback && ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) {
          const outputs = method === 'flatMap' ? arrayElements(callback.body, seen) : [text(callback.body)];
          if (outputs) return inputs.flatMap((input) => outputs.map((entry) => `binding ${text(callback.parameters[0]?.name)} = ${input}: ${entry}`));
        }
      }
    }
    if (!ts.isArrayLiteralExpression(node)) return null;
    const elements = [];
    for (const item of node.elements) {
      if (ts.isSpreadElement(item)) { const values = arrayElements(item.expression, seen); if (!values) return null; elements.push(...values); }
      else elements.push(text(item));
    }
    return elements;
  }
  function callInfo(node) {
    if (!ts.isCallExpression(node)) return null;
    let expr = node.expression;
    let table = null;
    let parameterization = null;
    if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && ['each', 'for'].includes(expr.expression.name.text)) {
      table = expr.arguments[0]; parameterization = expr.expression.name.text; expr = expr.expression.expression;
    }
    const modifiers = [];
    while (ts.isPropertyAccessExpression(expr)) { modifiers.unshift(expr.name.text); expr = expr.expression; }
    if (!ts.isIdentifier(expr) || !['it', 'test', 'describe', 'suite', 'bench'].includes(expr.text)) return null;
    // The builder it.each(table) is not itself a declaration.
    if (modifiers.includes('each') || modifiers.includes('for')) return null;
    return { kind: expr.text, modifiers, parameterization, table };
  }
  function walk(node, suites = [], loops = []) {
    const info = callInfo(node);
    if (info && node.arguments.length) {
      const title = node.arguments[0];
      const nameTemplate = ts.isStringLiteralLike(title) ? title.text : text(title);
      const tableRows = info.table ? arrayElements(info.table) : null;
      const parameterized = info.parameterization ? { method: info.parameterization, expression: text(info.table), rows: tableRows, staticRowCount: tableRows?.length ?? null } : null;
      const scope = { nameTemplate, nameExpression: text(title), sourceLine: line(node), parameterized };
      if (['describe', 'suite'].includes(info.kind)) {
        for (const arg of node.arguments.slice(1)) walk(arg, [...suites, scope], loops);
      } else {
        const multiplicities = [...suites.map((suite) => suite.parameterized ? suite.parameterized.staticRowCount : 1), ...loops.map((loop) => loop.staticIterations), parameterized ? parameterized.staticRowCount : 1];
        result.declarations.push({ id: `${name}:${line(node)}`, kind: info.kind, sourceLine: line(node), sourceEndLine: endLine(node), nameTemplate, nameExpression: text(title), fullNameTemplate: [...suites.map((suite) => suite.nameTemplate), nameTemplate].join(' > '), suites, modifiers: info.modifiers, parameterized, declarationLoops: loops, staticallyExpandedCaseCount: multiplicities.includes(null) ? null : multiplicities.reduce((a, b) => a * b, 1), correspondence: pending() });
      }
      return;
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isForStatement(node)) {
      const expression = ts.isForStatement(node) ? node.condition : node.expression;
      const values = ts.isForOfStatement(node) ? arrayElements(node.expression) : null;
      const loop = { sourceLine: line(node), initializer: text(node.initializer), expression: text(expression), incrementor: ts.isForStatement(node) ? text(node.incrementor) : null, staticIterations: values?.length ?? null, values };
      walk(node.statement, suites, [...loops, loop]); return;
    }
    ts.forEachChild(node, (child) => walk(child, suites, loops));
  }
  walk(source);
  result.imports = source.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text);
  if (category === 'browser-benchmark') {
    result.benchmarkSource = { namedScenarios: [], numericConfiguration: {}, metricTypes: [] };
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && ['name', 'scenario'].includes(text(node.name)) && ts.isStringLiteralLike(node.initializer)) result.benchmarkSource.namedScenarios.push({ name: node.initializer.text, sourceLine: line(node) });
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isNumericLiteral(node.initializer)) result.benchmarkSource.numericConfiguration[node.name.text] = Number(node.initializer.text);
      if (ts.isTypeAliasDeclaration(node) && /Metrics|Run/.test(node.name.text)) result.benchmarkSource.metricTypes.push({ name: node.name.text, sourceLine: line(node), source: text(node) });
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return result;
}

const files = filesUnder(testsRoot).map(inspect);
const pinnedPaths = execFileSync('git', ['-C', upstreamRoot, 'ls-tree', '-r', '--name-only', pinnedCommit, '--', 'packages/vue-clamp/tests'], { encoding: 'utf8' }).trim().split('\n').sort();
assert.deepEqual(files.map((file) => file.path).sort(), pinnedPaths, 'The test fixture file list differs from the pinned Git tree.');
execFileSync('git', ['-C', upstreamRoot, 'diff', '--exit-code', pinnedCommit, '--', 'packages/vue-clamp/tests'], { stdio: 'pipe' });
const testFiles = files.filter((file) => file.path.endsWith('.test.ts'));
const declarations = testFiles.flatMap((file) => file.declarations);
const benchmarkFiles = files.filter((file) => file.category === 'browser-benchmark');
const counts = Object.fromEntries([...new Set(files.map((file) => file.category))].sort().map((category) => [category, files.filter((file) => file.category === category).length]));
const benchmarkAnalysis = [
  { file: 'text.browser.benchmark.ts', scenarioCount: 17, breakdown: '12 direct (line/inline × continuous/jitter/jumps × cold/warm), 5 component (line continuous/jumps, line word fallback continuous, inline continuous/jumps)', warmupRuns: 1, measuredRuns: 5, requirements: ['Identical text, boundaries, line limits and width sequences', 'Direct core and component paths separately', 'Bounding rect, client rect and scroll width reads; elapsed time, medians and raw runs'] },
  { file: 'rich.browser.benchmark.ts', scenarioCount: 12, breakdown: '10 direct (fit/continuous/jitter/jumps/dense jumps × cold/warm), 2 component (continuous/jumps)', warmupRuns: 1, measuredRuns: 4, requirements: ['Preserve HTML structure and 40-row dense workload', 'Bounding rect/client rect reads, replaceChildren and clone/image clone calls', 'Identical width sequences, raw runs and summary distribution'] },
  { file: 'wrap.browser.benchmark.ts', scenarioCount: 27, breakdown: '27 named width sweep, churn, no-affix, before/after-affix and mixed line/height workloads', warmupRuns: 1, measuredRuns: 5, requirements: ['Preserve every mount variant and width/burst sequence', 'Frame convergence, root/content geometry reads and rendered state checks', 'Report raw runs and medians; do not substitute one generic resize workload'] },
  { file: 'pretext.browser.benchmark.ts', scenarioCount: 46, breakdown: '39 resize comparisons (13 text/ellipsis scenarios × 3 width patterns) + 2 scheduling-at-scale + 3 preparation paths + 2 cold-mount modes; four test declarations', requirements: ['Resize: 5 repetitions; browser/core/Pretext order alternates; coreCycles=200', 'Exact output only for scenarios marked exact; all outputs must be safe grapheme/boundary prefixes, no longer than browser optimum, and fit', 'Scale: 200 instances, 3 repetitions, smooth/jumps; assert observer callback/entry counts', 'Preparation: 1000 texts × 5 repetitions, separate pretext/boundaries/wrapper paths', 'Cold mount: repeated/unique text, 200 instances × 5 repetitions'] },
  { file: 'update.browser.benchmark.ts', scenarioCount: 10, breakdown: 'line: 3 combinations; rich: 5 combinations; wrap: 2 combinations of measured/native, affixed/unaffixed and repeated/unique sources', requirements: ['48 instances, 6 updates for each applicable phase', 'Separate cold mount, unrelated attributes, source updates, captured slot updates', 'Measure rects/rectLists/styles/parses/item-slot/affix-slot work; elapsed time includes intentional frames and is not CPU time'] },
  { file: 'invalidation.browser.benchmark.ts', scenarioCount: 2, breakdown: 'active and expanded', warmupRuns: 1, measuredRuns: 5, requirements: ['400 instances and 12 no-op updates', 'Measure mount/resize/font-event/no-op/unmount cost', 'Count bounding rects, ResizeObserver instances/callbacks and font listeners added/removed'] },
];
const inventory = {
  schemaVersion: 1,
  upstream: { repository: 'https://github.com/Justineo/vue-clamp', commit: pinnedCommit, testDirectory: 'packages/vue-clamp/tests' },
  methodology: { parser: 'TypeScript AST; upstream code is never executed', declarationCount: 'One it/test/bench call site; it.each is one declaration. Suite and declaration loop multiplicities are tracked separately.', expandedCaseCount: 'Static array, Object.entries and fixed map/flatMap cardinality only; unresolved expressions are null, never guessed. Loop iterations inside a test body are assertions/workloads, not registered test cases.', correspondence: 'Every mapping starts pending. Matching names or aggregate pass counts do not establish equivalent inputs/assertions/behavior.', benchmarkScenarioCount: 'Reported workload records, including preparation paths; not test declaration counts or browser-multiplied execution counts.' },
  summary: { totalFiles: files.length, categoryCounts: counts, testFiles: testFiles.length, testDeclarations: declarations.length, parameterizedTestDeclarations: declarations.filter((item) => item.parameterized).length, loopGeneratedTestDeclarations: declarations.filter((item) => item.declarationLoops.length).length, staticExpandedTestCases: declarations.some((item) => item.staticallyExpandedCaseCount === null) ? null : declarations.reduce((sum, item) => sum + item.staticallyExpandedCaseCount, 0), knownStaticExpandedTestCases: declarations.reduce((sum, item) => sum + (item.staticallyExpandedCaseCount ?? 0), 0), unresolvedExpansionDeclarations: declarations.filter((item) => item.staticallyExpandedCaseCount === null).map((item) => item.id), benchmarkFiles: benchmarkFiles.length, benchmarkTestDeclarations: benchmarkFiles.flatMap((file) => file.declarations).length },
  adaptations: [
    { files: ['template-ref-source.test.ts', 'wrap-render-source.test.ts'], requirement: 'Vue compiler/SFC source contracts require explicit React architectural equivalents (direct stable DOM refs and render ownership); cannot be copied as Vue source string assertions or marked covered by a matching test name.' },
    { files: ['demo-page.browser.test.ts'], requirement: 'Website behavior imports Vue demo pages and uses their controls/selectors; port the corresponding React demo interactions or explicitly record every missing demo behavior.' },
    { files: ['type-surface.ts', 'wrap-slot-types.vue'], requirement: 'Port generic item/slot/affix/exposed-ref and package-export type contracts to React props/render callbacks and refs, retaining expected-error rejection cases.' },
    { files: ['benchmark-statistics.test.ts', 'browser-log-filter.test.ts'], requirement: 'Tooling contracts for benchmark statistics and log filtering are separate from component feature parity.' },
    { files: ['browser.ts', 'search-model.ts', 'env.d.ts', 'fixtures/narrow.ttf', 'fixtures/README.md'], requirement: 'Preserve helper oracles, environment types, deterministic font fixture and its licensing; helper files are not standalone tests.' },
  ],
  benchmarkAnalysis,
  files,
};
assert.equal(testFiles.length, 39);
assert.equal(benchmarkFiles.length, 6);
// --write refreshes source census while preserving manually reviewed correspondence.
if (args.includes('--write')) {
  let existing;
  try { existing = JSON.parse(readFileSync(output, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const file of inventory.files) {
    const previous = existing?.files?.find((entry) => entry.path === file.path && entry.sha256 === file.sha256);
    if (!previous) continue;
    file.correspondence = previous.correspondence;
    for (const entry of file.declarations) { const old = previous.declarations.find((item) => item.id === entry.id); if (old) entry.correspondence = old.correspondence; }
  }
  writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
} else {
  const stripCorrespondence = (value) => Array.isArray(value) ? value.map(stripCorrespondence) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'correspondence').map(([key, entry]) => [key, stripCorrespondence(entry)])) : value;
  assert.deepEqual(stripCorrespondence(JSON.parse(readFileSync(output, 'utf8'))), stripCorrespondence(inventory), 'Pinned upstream source census changed. Review differences before regenerating with --write.');
}
console.log(JSON.stringify({ mode: args.includes('--write') ? 'written' : 'verified', output, ...inventory.summary }, null, 2));
