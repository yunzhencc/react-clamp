import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const groups = ['node', 'engine', 'components', 'demo', 'types', 'benchmarks'];
export const sha256 = value => createHash('sha256').update(value).digest('hex');
function walk(path) {
  if (!existsSync(path)) return [];
  return statSync(path).isDirectory() ? readdirSync(path).flatMap(name => walk(join(path, name))) : [path];
}
export function inputs(group) {
  if (!groups.includes(group)) throw new Error(`Unknown upstream suite: ${group}`);
  const scope = group === 'types' ? 'demo' : group;
  const paths = ['src', 'scripts/run-upstream-suite.mjs', 'scripts/upstream-inputs.mjs', `tests/upstream/${scope}`, 'tests/upstream/browser.ts', 'tests/upstream/react-adapter.ts', 'tests/upstream/fixture-types.ts', 'tsconfig.json', `vitest.upstream-${scope}.config.ts`, 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsdown.config.ts', 'scripts/upstream-benchmark-statistics.ts', 'scripts/upstream-browser-log-filter.ts'];
  if (group === 'demo') paths.push('demo');
  const files = [...new Set(paths.flatMap(path => walk(join(root, path))))].filter(path => !path.endsWith('/mapping.json')).sort();
  const hashes = Object.fromEntries(files.map(path => [relative(root, path), sha256(readFileSync(path))]));
  for (const name of ['react', 'react-dom', 'vitest', 'typescript', '@playwright/test']) {
    const path = join(root, 'node_modules', name, 'package.json');
    hashes[`node_modules/${name}/package.json`] = sha256(readFileSync(path));
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  hashes['package.json#dependencies'] = sha256(JSON.stringify([pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.engines]));
  return { group, hashes, digest: sha256(JSON.stringify(hashes)), latestInputMtimeMs: Math.max(0, ...files.map(path => statSync(path).mtimeMs)) };
}

export function configuredBrowsers(group) {
  if (group === 'node' || group === 'types') return [];
  const config = readFileSync(join(root, `vitest.upstream-${group}.config.ts`), 'utf8');
  return [...config.matchAll(/\bbrowser:\s*["'](chromium|firefox|webkit)["']/g)].map(match => match[1]);
}
