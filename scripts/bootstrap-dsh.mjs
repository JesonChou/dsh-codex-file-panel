#!/usr/bin/env node
/**
 * Regenerate the local dsh type mirror used by plugins/dsh-codex-files.
 *
 * `@deepseek-ai/*` packages are not all published, so the plugin links a
 * local copy under `plugins/dsh-codex-files/dsh-dev/ai`. This script rebuilds
 * that copy from a dsh source checkout (default: the sibling
 * `../deepseek-harness`), copying each package's built `lib` and a package.json
 * whose `workspace:` dependency specs are rewritten to semver ranges.
 *
 * Usage:
 *   node scripts/bootstrap-dsh.mjs [--dsh <checkout>] [--dry-run]
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_ROOT = join(REPO_ROOT, 'plugins', 'dsh-codex-files')
const MIRROR_ROOT = join(PLUGIN_ROOT, 'dsh-dev', 'ai')

const USAGE = `bootstrap-dsh: regenerate plugins/dsh-codex-files/dsh-dev/ai

  --dsh <path>   dsh source checkout (default: ../deepseek-harness)
  --dry-run      print planned copies without writing
`

function parseArgs(argv) {
  let dsh = null
  let dryRun = false
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--dsh') {
      dsh = argv[++index]
      if (dsh === undefined) throw new Error('--dsh requires a path')
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(USAGE)
      process.exit(0)
    } else {
      throw new Error(`unknown argument: ${arg}\n\n${USAGE}`)
    }
  }
  return { dsh, dryRun }
}

/** List package.json directories under `base`, descending `levels` subdirs. */
async function listPackageDirs(base, levels) {
  let current = [base]
  for (let depth = 0; depth < levels; depth++) {
    const next = []
    for (const dir of current) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) next.push(join(dir, entry.name))
      }
    }
    current = next
  }
  return current.filter(dir => existsSync(join(dir, 'package.json')))
}

/** Read one package manifest. */
async function readManifest(dir) {
  return JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
}

/**
 * Replace every `workspace:` dependency protocol with a range derived from
 * the referenced package's version. Linked packages are installed as-is, but
 * pnpm still parses their manifests; leaving `workspace:` outside a workspace
 * makes the profile install fail.
 */
function rewriteWorkspaceSpecs(manifest, versions) {
  const fields = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']
  for (const field of fields) {
    const deps = manifest[field]
    if (typeof deps !== 'object' || deps === null) continue
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue
      const version = versions.get(name)
      if (version === undefined) {
        deps[name] = '*'
        continue
      }
      const suffix = spec.slice('workspace:'.length)
      deps[name] = suffix === '*' ? version : suffix === '~' ? `~${version}` : `^${version}`
    }
  }
  return manifest
}

/** Collect every @deepseek-ai package from the checkout's workspace members. */
async function collectPackages(dshRoot) {
  const roots = [
    { base: join(dshRoot, 'vendor'), levels: 1 },
    { base: join(dshRoot, 'packages'), levels: 2 },
    { base: join(dshRoot, 'native', 'landlock-run', 'packages'), levels: 1 },
  ]
  const packages = []
  for (const { base, levels } of roots) {
    for (const dir of await listPackageDirs(base, levels)) {
      const manifest = await readManifest(dir)
      if (typeof manifest.name === 'string' && manifest.name.startsWith('@deepseek-ai/')) {
        packages.push({ dir, manifest })
      }
    }
  }
  return packages
}

async function main() {
  const { dsh, dryRun } = parseArgs(process.argv.slice(2))
  const dshRoot = resolve(REPO_ROOT, dsh ?? join('..', 'deepseek-harness'))

  const packages = await collectPackages(dshRoot)
  if (packages.length === 0) {
    throw new Error(`no @deepseek-ai packages found under ${dshRoot}`)
  }

  const versions = new Map(packages.map(({ manifest }) => [manifest.name, manifest.version]))

  if (!dryRun) {
    await rm(MIRROR_ROOT, { recursive: true, force: true })
    await mkdir(MIRROR_ROOT, { recursive: true })
  }

  for (const { dir, manifest } of packages) {
    const unscoped = manifest.name.slice('@deepseek-ai/'.length)
    const lib = join(dir, 'lib')
    if (!existsSync(lib)) {
      process.stderr.write(`skip ${manifest.name}: no built lib\n`)
      continue
    }
    const dest = join(MIRROR_ROOT, unscoped)
    const rewritten = rewriteWorkspaceSpecs(manifest, versions)
    const lines = [
      JSON.stringify(rewritten, null, 2),
      '',
    ].join('\n')

    if (dryRun) {
      process.stdout.write(`${manifest.name}\t${dir}\n`)
      continue
    }
    await mkdir(dest, { recursive: true })
    await writeFile(join(dest, 'package.json'), lines)
    await cp(lib, join(dest, 'lib'), { recursive: true })
  }

  process.stdout.write(
    dryRun
      ? `${packages.length} packages would be copied\n`
      : `bootstrapped ${packages.length} packages into ${MIRROR_ROOT}\n`,
  )
}

await main()
