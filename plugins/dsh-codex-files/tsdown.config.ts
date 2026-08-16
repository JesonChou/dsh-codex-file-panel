/**
 * tsdown preset for dsh-codex-files: an ESM node half with declarations
 * plus a browser half (lib/client.js) wrapped for the harness client-plugin
 * loader. All @deepseek-ai packages stay external — they are injected by the
 * profile's pnpm closure at mount time (node half) or shared through the
 * frozen module table (browser half); react/cordis also external, everything
 * else bundles inline.
 *
 * The client contract is CJS: the loader footer needs the top-level
 * `return`, and the banner/footer pair must define `module`/`exports`
 * itself (an `intro` gets folded by the bundler, a footer referencing
 * `module` without the banner definition throws ReferenceError at load time).
 */
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-codex-files'

export default [
  {
    // ── Node half (host side) ──
    entry: { index: 'src/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    outDir: 'lib',
    clean: true,
    dts: true,
    // Plain `.js`/`.d.ts` extensions (the Loader resolves the package main,
    // which names lib/index.js — an `.mjs` output would never be found).
    fixedExtension: false,
    // Official packages (@deepseek-ai/*) are injected by the profile's pnpm
    // closure at mount time — never bundled.
    external: [/@deepseek-ai\//, /^node-pty$/, /^ws$/],
  },
  {
    // ── Browser half (client side) ──
    name: `${PLUGIN_ID}/client`,
    entry: { client: 'src/client/index.tsx' },
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    outDir: 'lib',
    dts: false,
    clean: false,
    external: [/@deepseek-ai\/dsh-client-/, /^react($|\/)/, /^react-dom($|\/)/, 'cordis'],
    deps: {
      // pdfjs-dist is a runtime dependency for the host's asset route, but the
      // browser half must still inline it: the client module table has no
      // pdfjs-dist entry, and PDF rendering is bundled into lib/client.js.
      alwaysBundle: [/^pdfjs-dist(\/|$)/],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      // module/exports definitions belong in the banner (intro gets folded by
      // esbuild); the footer returns the exports to the module loader. The
      // wrapper also shims the Node 'module' builtin that rolldown injects
      // when bundling CJS dependencies (fflate): the frozen module table has
      // no such word, so the shim returns a stub instead of a load-time miss.
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (requireOriginal) => { var require = function(id) { if (id === 'module') { return { exports: {}, createRequire: function() { return function() { throw new Error('browser bundle: module not found: ' + arguments[0]) } } } } if (id === 'url') { return { pathToFileURL: function(p) { return new URL('file://' + String(p).replace(/\\\\/g, '/')) } } } if (id === '@napi-rs/canvas') { return { createCanvas: function() { throw new Error('@napi-rs/canvas is not available in the browser bundle') } } } return requireOriginal(id) }; var module = { exports: {} }; var exports = module.exports;`,
      footer: 'return exports; } });',
    },
  },
] satisfies UserConfig[]
