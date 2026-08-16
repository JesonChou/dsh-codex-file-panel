/**
 * Bundle smoke: load the BUILT browser bundle exactly like the shell's
 * module loader would (factory + module table of real react/jsx-runtime),
 * then run the client apply against a minimal cordis context. This is the
 * regression net for the "UI stuck on the loading page" failure: any
 * unresolvable require or top-level crash surfaces here, not in the user's
 * shell. Requires `pnpm run build` first (the check pipeline builds before
 * testing).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as JsxRuntime from 'react/jsx-runtime'

interface BundleModule {
  name: string
  inject: string[]
  apply: (ctx: unknown) => void
}

function loadBundle(): BundleModule {
  // vitest serves modules over http, so import.meta.url is not a file URL;
  // the runner's cwd is the package root, where lib/client.js lives.
  const bundle = readFileSync(resolve(process.cwd(), 'lib/client.js'), 'utf8')
  let factory: ((requireFn: (id: string) => unknown) => BundleModule) | undefined
  new Function('window', bundle)({
    __ModuleLoader__: {
      load: (record: { factory: typeof factory }) => { factory = record.factory },
    },
  })
  if (factory === undefined) throw new Error('bundle did not register a factory')
  const table = new Map<string, unknown>([
    ['react', React],
    ['react-dom', ReactDOM],
    ['react/jsx-runtime', JsxRuntime],
    ['@deepseek-ai/dsh-client-ui-primitives', {}],
  ])
  return factory((id) => {
    const value = table.get(id)
    if (value === undefined) throw new Error(`bundle smoke: module table miss for "${id}"`)
    return value
  })
}

describe('bundle smoke', () => {
  it('registers a factory and exports the plugin face', () => {
    const mod = loadBundle()
    expect(mod.name).toBe('dsh-codex-files')
    expect(mod.apply).toBeTypeOf('function')
    expect(Array.isArray(mod.inject)).toBe(true)
  })

  it('applies against a minimal cordis context without throwing', () => {
    const mod = loadBundle()
    const registered: string[] = []
    const ctx = {
      effect: () => () => {},
      locale: { register: () => () => {} },
      slots: {
        inject: (name: string) => { registered.push(name); return () => {} },
      },
      layout: { openDetails: vi.fn(), closeDetails: vi.fn(), toggleSidebar: vi.fn() },
      workspaces: { openPath: vi.fn() },
      sessions: {},
    }
    expect(() => mod.apply(ctx)).not.toThrow()
    // Both slot registrations go through slots.inject; the details column
    // entry is the one that must exist for the panel to mount.
    expect(registered).toContain('details')
    expect(registered).toContain('conversation.session.header.utilities')
  })
})
