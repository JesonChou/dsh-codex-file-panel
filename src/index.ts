/**
 * dsh-codex-file-panel, node half: serves the browser Files panel's file
 * read / write / stat routes over the shared webserver. Paths resolve
 * against the addressed session's durable cwd and must stay inside it;
 * transfer sizes are bounded by plugin config; binary and missing files
 * answer typed error codes. Every route is loopback-only by defense in
 * depth (the webserver itself binds 127.0.0.1 in the shipped composition).
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { SessionId, type SessionId as SessionIdBrand } from '@deepseek-ai/dsh-session'
import z from '@deepseek-ai/schemastery'
import { contentTypeFor } from './content-types.ts'
import { defaultShell, ensureSpawnHelper, PtyManager } from './pty-manager.ts'

export const name = 'dsh-codex-file-panel'

/** Host-plane services only. */
export const inject = ['webServer', 'sessions']

/** Plugin config: file transfer bounds and tree exclusions. */
export interface Config {
  /**
   * Maximum bytes one read may return. Files larger than this answer
   * `file-too-large` (the panel shows a hint instead of the content).
   */
  maxReadBytes?: number
  /** Maximum bytes one write may carry. */
  maxWriteBytes?: number
  /**
   * Maximum bytes one binary preview (/raw) may return. PDFs and media
   * routinely exceed text bounds; the default is 32 MiB.
   */
  maxRawBytes?: number
  /**
   * Maximum concurrent user terminals per session. The client opens at most
   * this many tabs before reporting the limit.
   */
  maxTerminalsPerSession?: number
  /** How long a disconnected terminal survives awaiting reconnect (ms). */
  terminalReconnectGraceMs?: number
  /** Optional terminal shell override (empty resolves by platform). */
  terminalShell?: string
  /**
   * Directory names the workspace tree hides. Defaults keep the tree
   * scannable (node_modules, .git, dist, build, .dsh).
   */
  excludeDirs?: string[]
}

export const Config: z<Config> = z.object({
  maxReadBytes: z.number().min(1024).max(64 * 1024 * 1024).step(1).default(2 * 1024 * 1024),
  maxWriteBytes: z.number().min(1024).max(64 * 1024 * 1024).step(1).default(2 * 1024 * 1024),
  maxRawBytes: z.number().min(1024).max(256 * 1024 * 1024).step(1).default(32 * 1024 * 1024),
  maxTerminalsPerSession: z.number().min(1).max(12).step(1).default(3),
  terminalReconnectGraceMs: z.number().min(0).max(60_000).step(1).default(5_000),
  terminalShell: z.string().default(''),
  excludeDirs: z.array(z.string()).default(['node_modules', '.git', 'dist', 'build', '.dsh', '.next', '.turbo', 'coverage', '__pycache__']),
})

/** Route prefix shared by the browser half (client/api.ts). */
export const ROUTE_PREFIX = '/plugins/dsh-codex-file-panel'

export { contentTypeFor, RAW_CONTENT_TYPES } from './content-types.ts'

/** Absolute root of the bundled pdf.js package, resolved at plugin load. */
function pdfjsAssetRoot(): string | null {
  try {
    const require = createRequire(import.meta.url)
    return dirname(require.resolve('pdfjs-dist/package.json'))
  } catch {
    return null
  }
}

/** A text file's encoded byte length may exceed its string length; read with headroom. */
const DECODE_HEADROOM = 4

/** Typed error codes of this route family. */
export type RouteErrorCode =
  | 'invalid-request'
  | 'not-loopback'
  | 'session-not-found'
  | 'session-no-cwd'
  | 'path-escape'
  | 'file-not-found'
  | 'not-a-file'
  | 'binary-file'
  | 'file-too-large'
  | 'read-failed'
  | 'write-failed'
  | 'directory-unreadable'
  | 'review-failed'
  | 'terminal-error'

/** One route failure: code + human message (English; the panel localizes). */
export class RouteError extends Error {
  constructor(readonly code: RouteErrorCode, message: string) {
    super(message)
    this.name = 'RouteError'
  }
}

const execFileAsync = promisify(execFile)

/** Git query timeout (ms); a slow repository answers null rather than hanging the panel. */
const GIT_TIMEOUT_MS = 5_000

/** Read the session cwd's current git branch; null when it is not a repository. */
async function gitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'branch', '--show-current'], { timeout: GIT_TIMEOUT_MS, windowsHide: true })
    const branch = stdout.trim()
    return branch === '' ? null : branch
  } catch {
    return null
  }
}

/** Read `git status --porcelain` into a path → status-letter map ('' = clean). */
async function gitStatusMap(cwd: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'status', '--porcelain', '-z', '--untracked-files=all'], { timeout: GIT_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
    for (const record of stdout.split('\0')) {
      if (record.length < 4) continue
      const code = record.slice(0, 2).trim()
      let path = record.slice(3)
      // Rename entries carry "old -> new": the tree marks the destination.
      const arrow = path.indexOf(' -> ')
      if (arrow !== -1) path = path.slice(arrow + 4)
      map.set(path, code)
    }
  } catch {
    // Not a repository (or git unavailable): no decorations.
  }
  return map
}

/** Run a git subcommand and return stdout, or null when git fails. */
async function gitOutput(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout
  } catch {
    return null
  }
}

/** Resolve a request path against the cwd, rejecting anything outside it. */
function resolveInside(cwd: string, requestPath: string): string {
  const abs = isAbsolute(requestPath) ? resolve(requestPath) : resolve(cwd, requestPath)
  const rel = relative(cwd, abs)
  if (rel === '' || rel === '.' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new RouteError('path-escape', `path "${requestPath}" resolves outside the session cwd`)
  }
  return abs
}

/** The session's cwd, or a typed failure when the session is unknown or cwd-less. */
function sessionCwd(ctx: Context, raw: string | null): string {
  if (raw === null || raw === '') throw new RouteError('invalid-request', 'sessionId is required')
  const session = ctx.sessions.get(SessionId(raw) as SessionIdBrand)
  if (session === undefined) throw new RouteError('session-not-found', `unknown session "${raw}"`)
  const cwd = session.header.cwd
  if (cwd === undefined) throw new RouteError('session-no-cwd', `session "${raw}" has no working directory`)
  return cwd
}

/** Serialize one route response. */
function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Read a bounded JSON request body; oversized bodies reject before parsing. */
async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > maxBytes) throw new RouteError('invalid-request', 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return null
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new RouteError('invalid-request', 'request body is not valid JSON')
  }
}

/**
 * The plugin body: three exact routes owning read/write/stat under
 * `ROUTE_PREFIX`. Mounted through `ctx.effect` so reload unwinds them.
 * Exact routes (not a prefix) so the client bundle's own
 * `/plugins/dsh-codex-file-panel/client.js` path keeps resolving to the module
 * loader's exact route.
 * @param ctx - context with webServer and sessions mounted.
 * @param config - validated plugin config (transfer bounds).
 */
export function apply(ctx: Context, config: Config): void {
  const maxRead = config.maxReadBytes ?? 2 * 1024 * 1024
  const maxWrite = config.maxWriteBytes ?? 2 * 1024 * 1024
  const terminalShell = config.terminalShell ?? ''
  const ptyManager = new PtyManager(
    terminalShell === '' ? defaultShell() : terminalShell,
    config.maxTerminalsPerSession ?? 3,
    config.terminalReconnectGraceMs ?? 5_000,
  )
  ensureSpawnHelper()

  const registerRoute = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): void => {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path,
      handler,
    }), `dsh-codex-file-panel: ${path} route`)
  }

  // pdf.js renders client-side, but its CMap and standard-font tables are
  // binary files outside the browser bundle. Serve them from the installed
  // pdfjs-dist package under the plugin's own asset prefix; the client passes
  // these URLs to getDocument so CJK and non-embedded standard fonts render
  // without network access or a build-time asset copy.
  const pdfAssetBase = `${ROUTE_PREFIX}/pdf-assets`
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: pdfAssetBase,
    handler: async (req, res) => {
      try {
        const addr = req.socket.remoteAddress
        if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        if (req.method !== 'GET') {
          res.writeHead(405)
          res.end('method not allowed')
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const relativeAsset = url.pathname.slice(pdfAssetBase.length).replace(/^[/]+/, '')
        const [kind, ...nameParts] = relativeAsset.split('/')
        const name = nameParts.join('/')
        if ((kind !== 'cmaps' && kind !== 'standard_fonts') || name === '' || name.includes('..')) {
          res.writeHead(404)
          res.end('not found')
          return
        }
        if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
          res.writeHead(400)
          res.end('bad asset name')
          return
        }
        const root = pdfjsAssetRoot()
        if (root === null) {
          res.writeHead(404)
          res.end('pdf.js assets unavailable')
          return
        }
        const assetDir = kind === 'cmaps' ? 'cmaps' : 'standard_fonts'
        const absolute = resolve(root, assetDir, name)
        const inside = relative(resolve(root, assetDir), absolute)
        if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        const body = await readFile(absolute)
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': body.length,
          'cache-control': 'no-store',
        })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    },
  }), 'dsh-codex-file-panel: pdf.js asset route')

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const addr = req.socket.remoteAddress
      if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
        throw new RouteError('not-loopback', `request from non-loopback address "${String(addr)}"`)
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId')
      const path = url.searchParams.get('path')

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/read`) {
        const cwd = sessionCwd(ctx, sessionId)
        if (path === null || path === '') throw new RouteError('invalid-request', 'path is required')
        const abs = resolveInside(cwd, path)
        let info
        try {
          info = await stat(abs)
        } catch {
          throw new RouteError('file-not-found', `cannot stat "${path}"`)
        }
        if (!info.isFile()) throw new RouteError('not-a-file', `"${path}" is not a file`)
        if (info.size > maxRead) {
          json(res, 200, { ok: false, code: 'file-too-large', size: info.size, limit: maxRead })
          return
        }
        let buffer
        try {
          buffer = await readFile(abs)
        } catch {
          throw new RouteError('read-failed', `cannot read "${path}"`)
        }
        if (buffer.includes(0)) {
          json(res, 200, { ok: false, code: 'binary-file', size: buffer.length })
          return
        }
        json(res, 200, {
          ok: true,
          content: buffer.toString('utf8'),
          size: buffer.length,
          mtime: info.mtimeMs,
        })
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/stat`) {
        const cwd = sessionCwd(ctx, sessionId)
        if (path === null || path === '') throw new RouteError('invalid-request', 'path is required')
        const abs = resolveInside(cwd, path)
        try {
          const info = await stat(abs)
          json(res, 200, { ok: true, exists: true, size: info.size, mtime: info.mtimeMs, isFile: info.isFile() })
        } catch {
          json(res, 200, { ok: true, exists: false })
        }
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/git`) {
        const cwd = sessionCwd(ctx, sessionId)
        const status = Object.fromEntries(await gitStatusMap(cwd))
        json(res, 200, { ok: true, branch: await gitBranch(cwd), repo: basename(cwd), status })
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/list`) {
        const cwd = sessionCwd(ctx, sessionId)
        const dirPath = path ?? ''
        // The empty path means the cwd itself (the tree root).
        const abs = dirPath === '' ? cwd : resolveInside(cwd, dirPath)
        let entries
        try {
          entries = await readdir(abs, { withFileTypes: true })
        } catch {
          throw new RouteError('directory-unreadable', `cannot list "${dirPath}"`)
        }
        const exclude = new Set(config.excludeDirs ?? [])
        const rows = entries
          .filter(entry => !(entry.isDirectory() && exclude.has(entry.name)))
          .map(entry => ({ name: entry.name, dir: entry.isDirectory() }))
          .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
          .slice(0, 500)
        json(res, 200, { ok: true, path: dirPath, entries: rows })
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/find`) {
        const cwd = sessionCwd(ctx, sessionId)
        const query = (url.searchParams.get('q') ?? '').toLowerCase()
        if (query === '') throw new RouteError('invalid-request', 'q is required')
        const exclude = new Set(config.excludeDirs ?? [])
        const out: string[] = []
        const queue = ['']
        while (queue.length > 0 && out.length < 200) {
          const dir = queue.shift()!
          let entries
          try {
            entries = await readdir(join(cwd, dir), { withFileTypes: true })
          } catch {
            continue
          }
          for (const entry of entries) {
            if (out.length >= 200) break
            const rel = dir === '' ? entry.name : `${dir}/${entry.name}`
            if (entry.isDirectory()) {
              if (exclude.has(entry.name)) continue
              queue.push(rel)
              if (entry.name.toLowerCase().includes(query)) out.push(`${rel}/`)
            } else if (entry.name.toLowerCase().includes(query)) {
              out.push(rel)
            }
          }
        }
        json(res, 200, { ok: true, matches: out })
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/raw`) {
        const cwd = sessionCwd(ctx, sessionId)
        if (path === null || path === '') throw new RouteError('invalid-request', 'path is required')
        const contentType = contentTypeFor(path)
        if (contentType === undefined) throw new RouteError('invalid-request', `extension not previewable: "${path}"`)
        const abs = resolveInside(cwd, path)
        const maxRaw = config.maxRawBytes ?? 32 * 1024 * 1024
        let info
        try {
          info = await stat(abs)
        } catch {
          throw new RouteError('file-not-found', `cannot stat "${path}"`)
        }
        if (!info.isFile()) throw new RouteError('not-a-file', `"${path}" is not a file`)
        if (info.size > maxRaw) {
          json(res, 200, { ok: false, code: 'file-too-large', size: info.size, limit: maxRaw })
          return
        }
        let buffer
        try {
          buffer = await readFile(abs)
        } catch {
          throw new RouteError('read-failed', `cannot read "${path}"`)
        }
        res.writeHead(200, {
          'content-type': contentType,
          'content-length': buffer.length,
          'cache-control': 'no-store',
        })
        res.end(buffer)
        return
      }

      if (req.method === 'POST' && url.pathname === `${ROUTE_PREFIX}/write`) {
        const body = (await readJsonBody(req, maxWrite + 64 * 1024)) as { sessionId?: unknown; path?: unknown; content?: unknown } | null
        if (body === null || typeof body !== 'object') throw new RouteError('invalid-request', 'JSON body required')
        const rawSession = typeof body.sessionId === 'string' ? body.sessionId : null
        const rawPath = typeof body.path === 'string' ? body.path : null
        const rawContent = typeof body.content === 'string' ? body.content : null
        if (rawSession === null || rawPath === null || rawContent === null) {
          throw new RouteError('invalid-request', 'sessionId, path, and content are required')
        }
        const cwd = sessionCwd(ctx, rawSession)
        const abs = resolveInside(cwd, rawPath)
        const bytes = Buffer.byteLength(rawContent, 'utf8')
        if (bytes > maxWrite) throw new RouteError('file-too-large', 'content exceeds maxWriteBytes')
        try {
          await writeFile(abs, rawContent, 'utf8')
        } catch {
          throw new RouteError('write-failed', `cannot write "${rawPath}"`)
        }
        const info = await stat(abs).catch(() => null)
        json(res, 200, { ok: true, size: bytes, mtime: info?.mtimeMs ?? Date.now() })
        return
      }

      if (req.method === 'GET' && url.pathname === `${ROUTE_PREFIX}/review/file`) {
        const cwd = sessionCwd(ctx, sessionId)
        if (path === null || path === '') throw new RouteError('invalid-request', 'path is required')
        const abs = resolveInside(cwd, path)
        const staged = url.searchParams.get('staged') === '1'
        let oldText: string | null = null
        let newText: string | null = null
        if (staged) {
          oldText = await gitOutput(cwd, ['show', `HEAD:${path}`])
          newText = await gitOutput(cwd, ['show', `:${path}`])
        } else {
          oldText = await gitOutput(cwd, ['show', `:${path}`])
          const buffer = await readFile(abs).catch(() => null)
          if (buffer !== null) newText = buffer.includes(0) ? null : buffer.toString('utf8')
        }
        const binary = (oldText !== null && oldText.includes('\0')) || (newText !== null && newText.includes('\0'))
        json(res, 200, { ok: true, path, staged, oldText, newText, binary })
        return
      }

      const reviewBody = (await readJsonBody(req, 256 * 1024)) as {
        sessionId?: unknown
        path?: unknown
        message?: unknown
      } | null
      const reviewSession = reviewBody !== null && typeof reviewBody.sessionId === 'string' ? reviewBody.sessionId : null
      const reviewPath = reviewBody !== null && typeof reviewBody.path === 'string' && reviewBody.path !== '' ? reviewBody.path : null

      if (req.method === 'POST' && url.pathname === `${ROUTE_PREFIX}/review/stage`) {
        if (reviewSession === null) throw new RouteError('invalid-request', 'sessionId is required')
        const cwd = sessionCwd(ctx, reviewSession)
        try {
          await execFileAsync('git', ['-C', cwd, ...(reviewPath === null ? ['add', '-A'] : ['add', '--', reviewPath])], {
            timeout: GIT_TIMEOUT_MS,
            windowsHide: true,
          })
        } catch {
          throw new RouteError('review-failed', `cannot stage "${reviewPath ?? '*'}"`)
        }
        json(res, 200, { ok: true })
        return
      }

      if (req.method === 'POST' && url.pathname === `${ROUTE_PREFIX}/review/unstage`) {
        if (reviewSession === null) throw new RouteError('invalid-request', 'sessionId is required')
        const cwd = sessionCwd(ctx, reviewSession)
        try {
          await execFileAsync('git', ['-C', cwd, 'reset', ...(reviewPath === null ? [] : ['--', reviewPath])], {
            timeout: GIT_TIMEOUT_MS,
            windowsHide: true,
          })
        } catch {
          throw new RouteError('review-failed', `cannot unstage "${reviewPath ?? '*'}"`)
        }
        json(res, 200, { ok: true })
        return
      }

      if (req.method === 'POST' && url.pathname === `${ROUTE_PREFIX}/review/commit`) {
        if (reviewSession === null) throw new RouteError('invalid-request', 'sessionId is required')
        const message = reviewBody !== null && typeof reviewBody.message === 'string' ? reviewBody.message.trim() : ''
        if (message === '') throw new RouteError('invalid-request', 'commit message is required')
        const cwd = sessionCwd(ctx, reviewSession)
        try {
          await execFileAsync('git', ['-C', cwd, 'commit', '-m', message], {
            timeout: 20_000,
            windowsHide: true,
          })
        } catch {
          throw new RouteError('review-failed', `cannot commit "${message}"`)
        }
        json(res, 200, { ok: true })
        return
      }

      json(res, 404, { ok: false, code: 'invalid-request', message: 'unknown route' })
    } catch (error) {
      if (error instanceof RouteError) {
        json(res, error.code === 'invalid-request' ? 400 : 200, { ok: false, code: error.code, message: error.message })
        return
      }
      json(res, 500, { ok: false, code: 'read-failed', message: String(error) })
    }
  }

  registerRoute(`${ROUTE_PREFIX}/read`, handle)
  registerRoute(`${ROUTE_PREFIX}/write`, handle)
  registerRoute(`${ROUTE_PREFIX}/stat`, handle)
  registerRoute(`${ROUTE_PREFIX}/git`, handle)
  registerRoute(`${ROUTE_PREFIX}/list`, handle)
  registerRoute(`${ROUTE_PREFIX}/find`, handle)
  registerRoute(`${ROUTE_PREFIX}/raw`, handle)
  registerRoute(`${ROUTE_PREFIX}/review/file`, handle)
  registerRoute(`${ROUTE_PREFIX}/review/stage`, handle)
  registerRoute(`${ROUTE_PREFIX}/review/unstage`, handle)
  registerRoute(`${ROUTE_PREFIX}/review/commit`, handle)

  const terminalWss = new WebSocketServer({ noServer: true })
  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: `${ROUTE_PREFIX}/terminal`,
    handler: (req, socket, head) => {
      const addr = req.socket.remoteAddress
      if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
        socket.destroy()
        return
      }
      terminalWss.handleUpgrade(
        req as unknown as IncomingMessage,
        socket as unknown as Duplex,
        head as Buffer,
        (ws) => { void attachTerminal(ctx, ptyManager, ws, req) },
      )
    },
  }), 'dsh-codex-file-panel: terminal WebSocket')

  ctx.effect(() => () => {
    ptyManager.disposeAll()
    terminalWss.close()
  }, 'dsh-codex-file-panel: terminal teardown')
}

/** Wire one WebSocket to a session-scoped PTY and stream both directions. */
async function attachTerminal(
  ctx: Context,
  ptyManager: PtyManager,
  ws: WebSocket,
  req: IncomingMessage,
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    const tabId = url.searchParams.get('tab')
    if (sessionId === null || tabId === null) {
      ws.close(1008, 'sessionId and tab are required')
      return
    }
    const cwd = sessionCwd(ctx, sessionId)
    const handle = ptyManager.open(sessionId, tabId, cwd, 80, 24)
    if (handle.transcript !== '') ws.send(handle.transcript)
    const onData = (data: string): void => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 4 * 1024 * 1024) {
        ws.send(data)
      }
    }
    const onExit = ({ exitCode }: { exitCode: number; signal?: number }): void => {
      onData(`\r\n[process exited with code ${String(exitCode)}]\r\n`)
    }
    const dataSub = handle.pty.onData(onData)
    const exitSub = handle.pty.onExit(onExit)
    ws.on('message', (data) => {
      const text = data.toString('utf8')
      let control: { type?: unknown; cols?: unknown; rows?: unknown } | null = null
      try {
        const parsed: unknown = JSON.parse(text)
        if (parsed !== null && typeof parsed === 'object') {
          control = parsed as { type?: unknown; cols?: unknown; rows?: unknown }
        }
      } catch {
        // Raw terminal input.
      }
      if (control !== null && control.type === 'close') {
        ptyManager.scheduleClose(handle.key, 0)
        return
      }
      if (handle.exited) return
      if (
        control !== null
        && control.type === 'resize'
        && typeof control.cols === 'number' && typeof control.rows === 'number'
      ) {
        handle.pty.resize(
          Math.max(2, Math.floor(control.cols)),
          Math.max(2, Math.floor(control.rows)),
        )
      } else {
        handle.pty.write(text)
      }
    })
    ws.on('close', () => {
      dataSub.dispose()
      exitSub.dispose()
      ptyManager.scheduleClose(handle.key, ptyManager.reconnectGraceMs)
    })
  } catch (error) {
    ws.close(1011, error instanceof Error ? error.message : String(error))
  }
}
