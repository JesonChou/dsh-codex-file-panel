/**
 * Session file extraction: which files the current conversation window
 * touched, derived from the snapshot's tool-call lifecycles (heads and
 * results). File tools are read / write / edit and the path fields are
 * `path` / `file_path` (the same vocabulary the chat tool rows use); the
 * result-side diff views supply each file's latest hunks and the +N/-M
 * change totals the panel shows.
 */

import type {
  ConversationSnapshot, ToolCallBlock,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { DiffHunk } from '@deepseek-ai/dsh-client-ui-primitives'

/** One applied file change (the wire diff vocabulary, declared locally to stay decoupled). */
export interface FileDiff {
  /** File the change addresses, as the tool reported it. */
  path: string
  /** Prior content, or null for a new file / an overwrite. */
  oldText: string | null
  /** Content after the change. */
  newText: string
}

/** File-tool names whose args carry a filesystem path. */
const FILE_TOOLS = new Set(['read', 'write', 'edit'])

/** Argument keys that may name the target file. */
const PATH_KEYS = ['path', 'file_path'] as const

/** The ops one session window performed on one file. */
export type FileOp = 'read' | 'write' | 'edit'

/** One file the session touched. */
export interface SessionFile {
  /** Path exactly as the tool reported it (relative or absolute). */
  path: string
  /** Ops performed on it, newest first. */
  ops: FileOp[]
  /** Unix epoch ms of the newest touching event, for ordering. */
  lastTime: number
  /** Latest result-side diff hunks for this file (authoritative applied change). */
  diffs: FileDiff[]
  /** Lines added by the latest diff (0 when no diff recorded). */
  added: number
  /** Lines removed by the latest diff (0 when no diff recorded). */
  removed: number
}

interface FileAccumulator {
  byPath: Map<string, SessionFile>
  order: string[]
}

function bumpOp(acc: FileAccumulator, path: string, op: FileOp, time: number): void {
  const existing = acc.byPath.get(path)
  if (existing !== undefined) {
    existing.ops = [op, ...existing.ops.filter(o => o !== op)]
    if (time > existing.lastTime) existing.lastTime = time
    return
  }
  acc.byPath.set(path, { path, ops: [op], lastTime: time, diffs: [], added: 0, removed: 0 })
  acc.order.push(path)
}

/** Attach the latest diff hunks and their +N/-M totals to one file record. */
function attachDiffs(acc: FileAccumulator, path: string, diffs: readonly FileDiff[], time: number): void {
  if (diffs.length === 0) return
  let existing = acc.byPath.get(path)
  if (existing === undefined) {
    acc.byPath.set(path, { path, ops: ['edit'], lastTime: time, diffs: [], added: 0, removed: 0 })
    acc.order.push(path)
    existing = acc.byPath.get(path) as SessionFile
  }
  if (time < existing.lastTime) return
  existing.diffs = [...diffs]
  let added = 0
  let removed = 0
  for (const diff of diffs) {
    const change = countLineChanges(diff.oldText, diff.newText)
    if (change !== null) {
      added += change.added
      removed += change.removed
    }
  }
  existing.added = added
  existing.removed = removed
}

/** Extract the path from one tool call's raw JSON args; null when absent. */
function toolPath(name: string, argsRaw: string): string | null {
  if (!FILE_TOOLS.has(name)) return null
  let args: unknown
  try {
    args = JSON.parse(argsRaw)
  } catch {
    return null
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return null
  for (const key of PATH_KEYS) {
    const value = (args as Record<string, unknown>)[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return null
}

/**
 * Line change totals between two texts. Lines pair by (text, occurrence
 * index) so repeated lines count correctly; the LCS over those pairs gives
 * the true added/removed totals. Files beyond the size bound answer null
 * (the panel then shows the op badge without totals).
 */
export function countLineChanges(oldText: string | null, newText: string): { added: number; removed: number } | null {
  const b = newText.split('\n')
  if (oldText === null) return { added: b.length, removed: 0 }
  const a = oldText.split('\n')
  if (a.length * b.length > 4_000_000) return null
  const seenA = new Map<string, number>()
  const aIdx = a.map(line => { const k = seenA.get(line) ?? 0; seenA.set(line, k + 1); return k })
  const seenB = new Map<string, number>()
  const bIdx = b.map(line => { const k = seenB.get(line) ?? 0; seenB.set(line, k + 1); return k })
  // LCS over (line, occurrence) pairs; rolling rows keep memory O(n).
  const prev = new Uint32Array(b.length + 1)
  const curr = new Uint32Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1] && aIdx[i - 1] === bIdx[j - 1]) {
        curr[j] = prev[j - 1]! + 1
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!)
      }
    }
    prev.set(curr)
  }
  const lcs = curr[b.length]!
  return { added: b.length - lcs, removed: a.length - lcs }
}

/** The diff views of one block: result-side first, call-side while running. */
function blockDiffs(block: ToolCallBlock): readonly FileDiff[] {
  if (!('kind' in block)) {
    return block.callView?.card === 'diff' ? block.callView.diffs : []
  }
  return block.resultView?.card === 'diff' ? block.resultView.diffs : []
}

/** Visit one tool lifecycle (root or nested), folding it into the accumulator. */
function visitBlock(acc: FileAccumulator, block: ToolCallBlock, time: number): void {
  if ('kind' in block) {
    // Settled: the result's applied hunks are authoritative for diff data.
    const diffs = blockDiffs(block)
    if (diffs.length > 0) {
      for (const diff of diffs) attachDiffs(acc, diff.path, diffs, time)
    }
    const call = block.call
    if (call !== null) {
      const path = toolPath(call.name, call.argsRaw)
      if (path !== null) bumpOp(acc, path, call.name as FileOp, time)
    }
  } else {
    const path = toolPath(block.name, block.argsRaw)
    if (path !== null) bumpOp(acc, path, block.name as FileOp, time)
    const diffs = blockDiffs(block)
    for (const diff of diffs) attachDiffs(acc, diff.path, diffs, time)
  }
  for (const child of block.subCalls) visitBlock(acc, child, time)
}

/** The tool-call node shape off the snapshot's chat store (runtime-narrowed). */
interface ToolCallChatNode {
  kind: string
  data: unknown
}

/**
 * Collect the files the snapshot's in-window tool lifecycles touched,
 * newest op first per file, files ordered by their newest touch.
 * @param snapshot - the conversation snapshot.
 * @returns the touched files, newest first.
 */
export function collectSessionFiles(snapshot: ConversationSnapshot): SessionFile[] {
  const acc: FileAccumulator = { byPath: new Map(), order: [] }
  for (const value of snapshot.chat.nodes.values()) {
    const node = value as unknown as ToolCallChatNode
    if (node.kind !== 'tool-call') continue
    const root = (node.data as { root?: ToolCallBlock } | undefined)?.root
    if (root === undefined) continue
    visitBlock(acc, root, root.time)
  }
  return acc.order.map(path => acc.byPath.get(path) as SessionFile)
}

/** Stable comparison for the useSession selector: same paths, ops, and order. */
export function sessionFilesEqual(left: readonly SessionFile[], right: readonly SessionFile[]): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const a = left[i]!
    const b = right[i]!
    if (a.path !== b.path || a.lastTime !== b.lastTime || a.added !== b.added || a.removed !== b.removed) return false
    if (a.ops.length !== b.ops.length) return false
    for (let j = 0; j < a.ops.length; j++) {
      if (a.ops[j] !== b.ops[j]) return false
    }
    if (a.diffs.length !== b.diffs.length) return false
    for (let j = 0; j < a.diffs.length; j++) {
      const d1 = a.diffs[j]!
      const d2 = b.diffs[j]!
      if (d1.path !== d2.path || d1.oldText !== d2.oldText || d1.newText !== d2.newText) return false
    }
  }
  return true
}

/** Map the session's hunks onto the DiffBlock vocabulary. */
export function toDiffHunks(diffs: readonly FileDiff[]): DiffHunk[] {
  return diffs.map(diff => ({ path: diff.path, oldText: diff.oldText, newText: diff.newText }))
}

/** Display path: the file's basename for the title, directory for the subtitle. */
export function splitDisplayPath(path: string): { name: string; dir: string } {
  const normalized = path.replaceAll('\\', '/')
  const slash = normalized.lastIndexOf('/')
  if (slash === -1) return { name: normalized, dir: '' }
  return { name: normalized.slice(slash + 1), dir: normalized.slice(0, slash) }
}

/** Grammar hint for the CodeBlock, from the file extension. */
export function langForPath(path: string): string | undefined {
  const normalized = path.toLowerCase()
  const dot = normalized.lastIndexOf('.')
  if (dot === -1) return undefined
  const ext = normalized.slice(dot + 1)
  switch (ext) {
    case 'ts': case 'mts': case 'cts': return 'ts'
    case 'tsx': return 'tsx'
    case 'js': case 'mjs': case 'cjs': return 'js'
    case 'jsx': return 'jsx'
    case 'json': case 'jsonc': return 'json'
    case 'py': return 'python'
    case 'md': case 'mdx': return 'md'
    case 'css': return 'css'
    case 'scss': case 'less': return 'scss'
    case 'html': case 'htm': return 'html'
    case 'yaml': case 'yml': return 'yaml'
    case 'sh': case 'bash': case 'zsh': return 'bash'
    case 'rs': return 'rust'
    case 'go': return 'go'
    case 'java': return 'java'
    case 'c': case 'h': return 'c'
    case 'cpp': case 'cc': case 'hpp': return 'cpp'
    case 'cs': return 'csharp'
    case 'rb': return 'ruby'
    case 'php': return 'php'
    case 'swift': return 'swift'
    case 'kt': return 'kotlin'
    case 'sql': return 'sql'
    case 'toml': return 'ini'
    case 'xml': case 'svg': return 'xml'
    case 'vue': return 'vue'
    case 'svelte': return 'svelte'
    case 'diff': case 'patch': return 'diff'
    default: return undefined
  }
}
