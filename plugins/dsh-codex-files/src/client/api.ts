/**
 * Wire client for the plugin's file routes (host half: src/index.ts).
 * Same-origin fetch — the routes ride the app's own webserver, so no CORS
 * and no port discovery.
 */

/** Route prefix (kept in sync with the host half's ROUTE_PREFIX). */
const ROUTE_PREFIX = '/plugins/dsh-codex-files'

/** One successful read. */
export interface ReadFileResult {
  ok: true
  content: string
  size: number
  mtime: number
}

/** One successful stat. */
export interface StatFileResult {
  ok: true
  exists: boolean
  size?: number
  mtime?: number
  isFile?: boolean
}

/** One successful write. */
export interface WriteFileResult {
  ok: true
  size: number
  mtime: number
}

/** A typed route failure (code matches the host's RouteErrorCode). */
export interface FileRouteFailure {
  ok: false
  code: string
  message?: string
  size?: number
  limit?: number
}

/** Union of every route outcome. */
export type FileRouteResult<T> = T | FileRouteFailure

async function parse<T>(response: Response): Promise<FileRouteResult<T>> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, code: 'invalid-request', message: `HTTP ${response.status}` }
  }
  return body as FileRouteResult<T>
}

/** Read one session file. */
export function readFile(sessionId: string, path: string): Promise<FileRouteResult<ReadFileResult>> {
  const query = new URLSearchParams({ sessionId, path })
  return fetch(`${ROUTE_PREFIX}/read?${query.toString()}`).then(r => parse<ReadFileResult>(r))
}

/** Stat one session file (existence + size + mtime). */
export function statFile(sessionId: string, path: string): Promise<FileRouteResult<StatFileResult>> {
  const query = new URLSearchParams({ sessionId, path })
  return fetch(`${ROUTE_PREFIX}/stat?${query.toString()}`).then(r => parse<StatFileResult>(r))
}

/** One successful git query. */
export interface GitInfoResult {
  ok: true
  /** Current branch name, or null when the cwd is not a git repository. */
  branch: string | null
  /** Repository display name (cwd basename). */
  repo: string
  /** Path (relative to cwd, slash-normalized) → porcelain status code ('' = clean). */
  status: Record<string, string>
}

/** Read the session cwd's git branch + per-file status map. */
export function gitInfo(sessionId: string): Promise<FileRouteResult<GitInfoResult>> {
  const query = new URLSearchParams({ sessionId })
  return fetch(`${ROUTE_PREFIX}/git?${query.toString()}`).then(r => parse<GitInfoResult>(r))
}

/** One directory entry off the host's listing route. */
export interface DirEntry {
  name: string
  dir: boolean
}

/** One successful directory listing. */
export interface ListDirResult {
  ok: true
  /** The listed path as requested ('' = cwd root). */
  path: string
  entries: DirEntry[]
}

/** List one directory level inside the session cwd ('' = root). */
export function listDir(sessionId: string, path: string): Promise<FileRouteResult<ListDirResult>> {
  const query = new URLSearchParams({ sessionId, path })
  return fetch(`${ROUTE_PREFIX}/list?${query.toString()}`).then(r => parse<ListDirResult>(r))
}

/** One successful workspace-wide filename search. */
export interface FindFilesResult {
  ok: true
  /** Matching paths (directories end with '/'), at most 200. */
  matches: string[]
}

/** Search workspace filenames (case-insensitive substring, capped at 200). */
export function findFiles(sessionId: string, q: string): Promise<FileRouteResult<FindFilesResult>> {
  const query = new URLSearchParams({ sessionId, q })
  return fetch(`${ROUTE_PREFIX}/find?${query.toString()}`).then(r => parse<FindFilesResult>(r))
}

/** Write one session file (UTF-8). */
export function writeFile(sessionId: string, path: string, content: string): Promise<FileRouteResult<WriteFileResult>> {
  return fetch(`${ROUTE_PREFIX}/write`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, path, content }),
  }).then(r => parse<WriteFileResult>(r))
}

/** One file's old/new review snapshot. */
export interface ReviewFileResult {
  ok: true
  path: string
  staged: boolean
  oldText: string | null
  newText: string | null
  binary: boolean
}

/** Read one changed file's old and new text for the review diff. */
export function reviewFile(sessionId: string, path: string, staged: boolean): Promise<FileRouteResult<ReviewFileResult>> {
  const query = new URLSearchParams({ sessionId, path, staged: staged ? '1' : '0' })
  return fetch(`${ROUTE_PREFIX}/review/file?${query.toString()}`).then(r => parse<ReviewFileResult>(r))
}

/** Successful mutation response for review actions. */
export interface ReviewActionResult {
  ok: true
}

/** Stage one file, or all changes when path is null. */
export function reviewStage(sessionId: string, path: string | null): Promise<FileRouteResult<ReviewActionResult>> {
  return fetch(`${ROUTE_PREFIX}/review/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, path }),
  }).then(r => parse<ReviewActionResult>(r))
}

/** Unstage one file, or all staged changes when path is null. */
export function reviewUnstage(sessionId: string, path: string | null): Promise<FileRouteResult<ReviewActionResult>> {
  return fetch(`${ROUTE_PREFIX}/review/unstage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, path }),
  }).then(r => parse<ReviewActionResult>(r))
}

/** Commit the currently staged changes. */
export function reviewCommit(sessionId: string, message: string): Promise<FileRouteResult<ReviewActionResult>> {
  return fetch(`${ROUTE_PREFIX}/review/commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  }).then(r => parse<ReviewActionResult>(r))
}

/** WebSocket URL for one terminal instance. */
export function terminalUrl(sessionId: string, tabId: string): string {
  const url = new URL(`${ROUTE_PREFIX}/terminal`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.search = new URLSearchParams({ sessionId, tab: tabId }).toString()
  return url.toString()
}
