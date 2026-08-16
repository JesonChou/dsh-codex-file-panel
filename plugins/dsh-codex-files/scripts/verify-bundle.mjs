/**
 * Post-build bundle gate: every require() word in the browser bundle must
 * resolve in the shell's frozen module table (the platform seed words plus
 * dsh-client-* plugin graph rows). A single miss — like the 'module'
 * builtin rolldown injects for CJS dependencies — bricks the boot: the UI
 * stays on its loading page. The 'module' word is allowed only when the
 * banner shim is present (see tsdown.config.ts).
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

const SEED_WORDS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
])

const SHIMMED_WORDS = new Set(['module', 'url'])

const requires = [...bundle.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
const bad = requires.filter(word =>
  !SHIMMED_WORDS.has(word)
  && !SEED_WORDS.has(word)
  && !word.startsWith('@deepseek-ai/dsh-client-'))

if (bad.length > 0) {
  console.error(`bundle-gate: require() words missing from the module table: ${bad.join(', ')}`)
  process.exit(1)
}

for (const word of SHIMMED_WORDS) {
  if (requires.includes(word) && !new RegExp(`id === ["']${word}["']`).test(bundle)) {
    console.error(`bundle-gate: require("${word}") present without the banner shim`)
    process.exit(1)
  }
}

// Execute the bundle factory like the browser loader would: capture the
// __ModuleLoader__.load call, then run the factory with a fake module table
// (top-level code only touches require() results opaquely). A throw here is
// exactly the load failure that bricks the UI on its loading page.
let factory
const load = (record) => { factory = record.factory }
new Function('window', bundle)({ __ModuleLoader__: { load } })
if (typeof factory !== 'function') {
  console.error('bundle-gate: bundle did not register a factory')
  process.exit(1)
}
const fakeRequire = (id) => {
  if (id === 'react' || id === 'react/jsx-runtime' || id === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error(`bundle-gate: unexpected require("${id}")`)
}
const exportsOut = factory(fakeRequire)
if (exportsOut === undefined || typeof exportsOut.apply !== 'function') {
  console.error('bundle-gate: factory did not return the plugin exports (apply missing)')
  process.exit(1)
}

console.log(`bundle-gate: ok (${requires.length} require words, all resolvable; factory executes cleanly)`)
