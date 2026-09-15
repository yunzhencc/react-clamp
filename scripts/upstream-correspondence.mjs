#!/usr/bin/env node
/** Verify local test correspondence against the pinned source census, without executing upstream code. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const upstream = resolve(process.argv[2] ?? '/private/tmp/vue-clamp-cost-review')
const write = process.argv.includes('--write')
const inventoryPath = 'docs/upstream-test-inventory.json'
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'))
const hash = text => createHash('sha256').update(text).digest('hex')
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text)
  const result = []
  let token
  for (token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan())
    result.push([token, scanner.getTokenText()])
  return JSON.stringify(result)
}
function inspect(path) {
  const raw = readFileSync(path, 'utf8')
  const source = ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true)
  const declarations = []
  const assertions = []
  const line = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  const text = node => node.getText(source)
  function rootCall(expr) {
    while (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr) || ts.isCallExpression(expr))
      expr = expr.expression
    return ts.isIdentifier(expr) ? expr.text : null
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const root = rootCall(node.expression)
      if (root === 'expect') {
        assertions.push({ line: line(node), expression: text(node), sha256: hash(tokens(text(node))) })
        return
      }
      if (root === 'it' || root === 'test' || root === 'bench') {
        const arg = node.arguments[0]
        const builder = ts.isPropertyAccessExpression(node.expression) && ['each', 'for'].includes(node.expression.name.text)
        if (arg && !builder) {
          const title = ts.isStringLiteralLike(arg) ? arg.text : text(arg)
          const each = ts.isCallExpression(node.expression) ? node.expression.arguments[0] : null
          declarations.push({ title, line: line(node), parameterTable: each ? text(each) : null, sha256: hash(tokens(text(node))) })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { sha256: hash(raw), declarations, assertions }
}
const components = []
for (const name of readdirSync('tests/upstream/components').filter(n => n.endsWith('.browser.test.ts')).sort()) {
  const original = `packages/vue-clamp/tests/${name}`
  const local = `tests/upstream/components/${name}`
  const a = inspect(join(upstream, original))
  const b = inspect(local)
  assert.equal(a.declarations.length, b.declarations.length, `${name}: test declarations dropped or added`)
  assert.deepEqual(a.declarations.map(x => [x.title, x.parameterTable && tokens(x.parameterTable)]), b.declarations.map(x => [x.title, x.parameterTable && tokens(x.parameterTable)]), `${name}: title or parameter table changed`)
  assert.equal(a.assertions.length, b.assertions.length, `${name}: assertion count changed`)
  const different = a.assertions.flatMap((x, i) => x.sha256 === b.assertions[i].sha256 ? [] : [{ upstream: x, local: b.assertions[i] }])
  assert.equal(different.length, 0, `${name}: assertions changed: ${JSON.stringify(different)}`)
  components.push({ original, local, upstreamSha256: a.sha256, localSha256: b.sha256, translation: 'Runner and imports target React; fixture ref/slot syntax is rendered by React. Type aliases use actual React public handles and callback contracts. Assertions and parameter tables retain upstream tokens.', status: 'ported-pending-final-runtime-verification', declarations: a.declarations.map((d, i) => ({ title: d.title, originalLine: d.line, localLine: b.declarations[i].line, parameterTable: d.parameterTable, originalTokenSha256: d.sha256, localTokenSha256: b.declarations[i].sha256, status: 'pending-final-runtime-verification' })), assertionCorrespondence: a.assertions.map((a, i) => ({ originalLine: a.line, localLine: b.assertions[i].line, tokenSha256: a.sha256 })), assertionsPreserved: true })
}
const mixed = components.find(file => file.original.endsWith('/mixed-batch.browser.test.ts'))
if (mixed)
  mixed.translation += ' Snapshot helper clones the tree and sorts attribute names lexically before serialization: React insertion order may vary, while all attribute names/values and DOM hierarchy are retained.'
const componentManifest = { upstreamCommit: inventory.upstream.commit, method: 'TypeScript AST declaration and assertion inventory; all assertion and parameter-table token sequences verified unchanged. Imports, type annotations and React fixture helper implementations are recorded separately.', files: components }
componentManifest.supportMappings = [{ original: 'packages/vue-clamp/tests/browser.ts', local: 'tests/upstream/browser.ts', translation: 'Real React fixture mounting and selector adaptation; countLines original restored.' }, { original: 'packages/vue-clamp/tests/env.d.ts', local: 'tests/upstream/fixture-types.ts', translation: 'Vue-only SFC/highlighter modules are replaced by real React fixture callback types and root strict TypeScript config.' }]
if (write)
  writeFileSync('tests/upstream/components/mapping.json', `${JSON.stringify(componentManifest, null, 2)}\n`)
console.log(JSON.stringify({ componentFiles: components.length, declarations: components.reduce((s, f) => s + f.declarations.length, 0), assertions: components.reduce((s, f) => s + f.assertionCorrespondence.length, 0) }))

const records = []
const add = (original, local, manifest, note, pairs = []) => records.push({ original, local, manifest, note, pairs })
for (const f of components)
  add(f.original, f.local, 'tests/upstream/components/mapping.json', f.translation, f.declarations.map(d => ({ originalLine: d.originalLine, localLine: d.localLine })))
const enginePath = 'tests/upstream/engine/mapping.json'
const engine = JSON.parse(readFileSync(enginePath, 'utf8'))
for (const f of engine.suiteMappings) {
  const original = inspect(join(upstream, f.original))
  const local = inspect(f.local)
  assert.equal(original.declarations.length, local.declarations.length, `${f.original}: declarations changed`)
  assert.deepEqual(original.assertions.map(x => x.sha256), local.assertions.map(x => x.sha256), `${f.original}: assertions changed`)
  add(f.original, f.local, enginePath, f.changes.join('; '), original.declarations.map((d, i) => ({ originalLine: d.line, localLine: local.declarations[i].line })))
}
for (const kind of ['node', 'benchmarks']) {
  const manifest = `tests/upstream/${kind}/mapping.json`
  const data = JSON.parse(readFileSync(manifest, 'utf8'))
  for (const f of data.files)
    add(f.upstreamFile, f.adaptedFile, manifest, f.translation, (f.tests ?? f.declarations ?? []).map(t => ({ originalLine: t.upstream.line, localLine: t.adapted.line })))
}
const demoPath = 'tests/upstream/demo/mapping.json'
const demo = JSON.parse(readFileSync(demoPath, 'utf8'))
add(demo.source, demo.localFile, demoPath, demo.frameworkAdaptations.join('; '), demo.cases.map(c => ({ originalLine: c.upstreamLine, localLine: c.localLine })))
for (const original of demo.typeContracts.source)
  add(`packages/vue-clamp/tests/${original}`, demo.typeContracts.localFile, demoPath, `${demo.typeContracts.adaptations.join('; ')}. Checked by strict TypeScript; public generic JSX acceptance/rejection cases retained. Pending semantic differences: ${demo.typeContracts.pending.join('; ')}`)
add('packages/vue-clamp/tests/browser.ts', 'tests/upstream/browser.ts', 'tests/upstream/components/mapping.json', 'Shared browser oracles retained; selectors and fixture mounting target real React nodes. countLines matches upstream.')
add('packages/vue-clamp/tests/search-model.ts', 'tests/upstream/engine/search-model.ts', enginePath, 'Original independent search model with engine import rewrite.')
add('packages/vue-clamp/tests/fixtures/narrow.ttf', 'tests/upstream/engine/fixtures/narrow.ttf', enginePath, 'Byte-identical deterministic upstream font fixture.')
add('packages/vue-clamp/tests/fixtures/README.md', 'tests/upstream/engine/fixtures/README.md', enginePath, 'Byte-identical font provenance and license notice.')
add('packages/vue-clamp/tests/env.d.ts', 'tests/upstream/fixture-types.ts', 'tests/upstream/components/mapping.json', 'Vue SFC/highlighter ambient modules are framework-specific and unused by React. React fixture callback contracts are explicit; CSS/React JSX and actual test modules are checked by root TypeScript config.')
const unresolved = []
for (const file of inventory.files) {
  assert.equal(hash(readFileSync(join(upstream, file.path))), file.sha256, `${file.path}: pinned original hash differs`)
  const mapped = records.filter(r => r.original === file.path)
  if (!mapped.length) {
    unresolved.push(file.path)
    continue
  }
  const locals = mapped.map(r => ({ path: r.local, sha256: hash(readFileSync(r.local)), mappingManifest: r.manifest }))
  file.correspondence = { status: file.category === 'test-fixture' ? 'copied-verified' : file.category === 'type-contract' ? 'adapted-typechecked-with-listed-differences' : 'ported-pending-final-runtime-verification', localTests: locals, evidence: mapped.map(r => r.manifest), note: mapped.map(r => r.note).join('\n') }
  for (const declaration of file.declarations) {
    const matching = mapped.flatMap(r => r.pairs.filter(p => p.originalLine === declaration.sourceLine).map(p => ({ ...p, record: r })))
    if (!matching.length) {
      unresolved.push(declaration.id)
      continue
    }
    declaration.correspondence = { status: 'ported-pending-final-runtime-verification', localTests: matching.map(p => ({ path: p.record.local, line: p.localLine, sha256: hash(readFileSync(p.record.local)) })), evidence: matching.map(p => p.record.manifest), note: 'Original test declaration maps to the explicit local source location. Final runtime result must be recorded separately; counts alone are not behavioral proof.' }
  }
}
assert.deepEqual(unresolved, [], 'Unmapped upstream files/declarations remain')
if (write)
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
console.log(JSON.stringify({ mappedFiles: inventory.files.length, mappedDeclarations: inventory.files.reduce((sum, f) => sum + f.declarations.length, 0), runtimeStatus: 'pending final verification; existing per-suite reports remain in referenced manifests' }))
