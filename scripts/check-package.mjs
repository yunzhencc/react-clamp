import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

// Inspect the complete root import graph, including generated shared chunks.
const visited = new Set()
function inspect(file) {
  if (visited.has(file))
    return
  visited.add(file)
  const source = readFileSync(file, 'utf8')
  assert.match(source, /^['"]use client['"];/u, `${file}: missing client directive`)
  const { importedFiles } = ts.preProcessFile(source, true, true)
  for (const { fileName } of importedFiles) {
    assert.notEqual(fileName, '@chenglou/pretext', 'Root entry must not load the prediction engine')
    if (fileName.startsWith('.'))
      inspect(resolve(dirname(file), fileName))
  }
}
inspect(resolve('dist/index.js'))
const root = await import('../dist/index.js')
for (const name of ['LineClamp', 'InlineClamp', 'RichLineClamp', 'WrapClamp']) {
  assert.ok(root[name], `Missing root export: ${name}`)
}
const pretext = await import('../dist/pretext.js')
assert.ok(pretext.LineClamp, 'Missing prediction entry')
assert.match(readFileSync('dist/pretext.js', 'utf8'), /^['"]use client['"];/u)
console.log(`Package entry checks passed (${visited.size} root modules).`)
