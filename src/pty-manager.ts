/**
 * Small in-memory PTY registry for the Codex-style terminal pane. One
 * node-pty process per `${sessionId}:${tabId}` key; the process survives a
 * WebSocket reconnect for a short grace period so refreshing the page or
 * switching tabs keeps the same shell.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import * as nodePty from 'node-pty'

/** Kept transcript bytes, enough for a useful reconnect replay without unbounded memory. */
const TRANSCRIPT_LIMIT = 1 << 20

export interface TerminalHandle {
  key: string
  sessionId: string
  tabId: string
  cwd: string
  pty: nodePty.IPty
  transcript: string
  exited: boolean
}

/**
 * Restore the executable bit pnpm may strip from node-pty's spawn helper.
 * Idempotent; Windows has no such helper and skips this entirely.
 */
export function ensureSpawnHelper(): void {
  if (process.platform === 'win32') return
  try {
    const require = createRequire(import.meta.url)
    const entry = require.resolve('node-pty')
    const packageRoot = dirname(dirname(entry))
    for (const helper of [
      join(packageRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
      join(packageRoot, 'build', 'Release', 'spawn-helper'),
    ]) {
      if (existsSync(helper)) require('node:fs').chmodSync(helper, 0o755)
    }
  } catch {
    // Resolution or chmod failure surfaces as the terminal's spawn error.
  }
}

/** Resolve the interactive shell for this platform. */
export function defaultShell(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.DSH_SIDEBAR_SHELL
  if (explicit !== undefined && explicit.trim() !== '') return explicit.trim()
  if (process.platform !== 'win32') {
    const shell = env.SHELL
    if (shell !== undefined && shell.trim() !== '') return shell.trim()
    return '/bin/bash'
  }
  const candidates: string[] = []
  const path = env.PATH ?? ''
  candidates.push(...path.split(';').map(item => join(item, 'pwsh.exe')))
  for (const root of [env.ProgramW6432, env.ProgramFiles, env.LOCALAPPDATA]) {
    if (root === undefined || root.trim() === '') continue
    candidates.push(join(root, 'PowerShell', '7', 'pwsh.exe'))
    candidates.push(join(root, 'PowerShell', '7-preview', 'pwsh.exe'))
    candidates.push(join(root, 'Microsoft', 'PowerShell', '7', 'pwsh.exe'))
    candidates.push(join(root, 'Microsoft', 'PowerShell', '7-preview', 'pwsh.exe'))
  }
  for (const candidate of candidates) {
    if (candidate.includes('pwsh.exe') && existsSync(candidate)) return candidate
  }
  return 'powershell.exe'
}

/** Terminal registry with a per-session cap and reconnect grace. */
export class PtyManager {
  private readonly handles = new Map<string, TerminalHandle>()
  private readonly pendingCloses = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly shell: string,
    private readonly maxPerSession: number,
    readonly reconnectGraceMs: number,
  ) {}

  open(sessionId: string, tabId: string, cwd: string, cols: number, rows: number): TerminalHandle {
    const key = `${sessionId}:${tabId}`
    this.cancelClose(key)
    const existing = this.handles.get(key)
    if (existing !== undefined && !existing.exited && existing.cwd === cwd) return existing
    if (existing !== undefined) this.close(key)
    for (const [candidate, handle] of [...this.handles]) {
      if (handle.sessionId === sessionId && handle.exited) this.close(candidate)
    }
    if (this.keysOf(sessionId).length >= this.maxPerSession) {
      throw new Error(`terminal limit reached (${this.maxPerSession}) for this session`)
    }
    const handle: TerminalHandle = {
      key,
      sessionId,
      tabId,
      cwd,
      pty: nodePty.spawn(this.shell, process.platform === 'win32' ? [] : ['-l'], {
        name: 'xterm-256color',
        cols: Math.max(2, Math.floor(cols)),
        rows: Math.max(2, Math.floor(rows)),
        cwd,
        env: { ...process.env },
      }),
      transcript: '',
      exited: false,
    }
    handle.pty.onData((data) => {
      handle.transcript += data
      if (handle.transcript.length > TRANSCRIPT_LIMIT) {
        handle.transcript = handle.transcript.slice(handle.transcript.length - TRANSCRIPT_LIMIT)
      }
    })
    handle.pty.onExit(() => {
      handle.exited = true
    })
    this.handles.set(key, handle)
    return handle
  }

  get(key: string): TerminalHandle | undefined {
    return this.handles.get(key)
  }

  close(key: string): void {
    this.cancelClose(key)
    const handle = this.handles.get(key)
    if (handle === undefined) return
    this.handles.delete(key)
    try {
      handle.pty.kill()
    } catch {
      // Already exited.
    }
  }

  scheduleClose(key: string, delayMs: number): void {
    if (!this.handles.has(key)) return
    this.cancelClose(key)
    const timer = setTimeout(() => { this.close(key) }, delayMs)
    this.pendingCloses.set(key, timer)
  }

  private cancelClose(key: string): void {
    const timer = this.pendingCloses.get(key)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.pendingCloses.delete(key)
    }
  }

  private keysOf(sessionId: string): string[] {
    return [...this.handles.keys()].filter(key => key.startsWith(`${sessionId}:`))
  }

  disposeAll(): void {
    for (const timer of this.pendingCloses.values()) clearTimeout(timer)
    this.pendingCloses.clear()
    for (const key of [...this.handles.keys()]) this.close(key)
  }
}
