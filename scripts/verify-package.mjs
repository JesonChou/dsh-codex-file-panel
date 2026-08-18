import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const patch = readFileSync(new URL('cordis.patch.yml', root), 'utf8')

const fail = (message) => {
  console.error(`package-gate: ${message}`)
  process.exit(1)
}

const expectedName = 'dsh-codex-file-panel'

if (pkg.name !== expectedName) fail(`package name must be ${expectedName}`)
if (pkg.private === true) fail('publishable bundle must not be private')
if (pkg.license !== 'MIT') fail('package license must match LICENSE')
if (pkg.main !== './lib/index.js') fail('main must point to ./lib/index.js')
if (pkg.types !== './lib/index.d.ts') fail('types must point to ./lib/index.d.ts')
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch is missing or invalid')
if (pkg.dsh?.client?.platform !== 'web') fail('dsh.client.platform must be web')
if (pkg.scripts?.prepare !== 'tsdown') fail('git installs require the self-contained prepare build')

const published = new Set(pkg.files ?? [])
for (const required of ['lib', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
  if (!published.has(required)) fail(`package files omits ${required}`)
}
for (const forbidden of ['src', 'tests', 'node_modules', 'dsh-dev']) {
  if (published.has(forbidden)) fail(`package files must not publish ${forbidden}`)
}

for (const output of ['lib/index.js', 'lib/index.d.ts', 'lib/client.js']) {
  if (!existsSync(new URL(output, root))) fail(`missing build output ${output}`)
}

if (!new RegExp(`id:\\s*${expectedName}(?:\\s|$)`, 'm').test(patch)) {
  fail('cordis patch id does not match package name')
}
if (!new RegExp(`name:\\s*['"]?${expectedName}['"]?(?:\\s|$)`, 'm').test(patch)) {
  fail('cordis patch module name does not match package name')
}

const dependencySpecs = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
  ...pkg.peerDependencies,
}
for (const [name, spec] of Object.entries(dependencySpecs)) {
  if (/^(?:file|link|workspace):/.test(spec)) {
    fail(`${name} uses non-portable dependency specifier ${spec}`)
  }
}

console.log(`package-gate: ok (${pkg.name}@${pkg.version}; ${fileURLToPath(root)})`)
