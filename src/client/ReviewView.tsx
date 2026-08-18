/**
 * Codex-style review pane: the repository's uncommitted changes, grouped
 * into staged and unstaged sections. Selecting a file loads its old/new text
 * through the host review route and renders it with the shared DiffBlock.
 * Stage/unstage actions are per-file; a small commit box commits the staged
 * set.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DiffBlock,
  IconBranchOutline16,
  IconCheckOutline16,
  IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  gitInfo, reviewCommit, reviewFile, reviewStage, reviewUnstage,
  type FileRouteResult, type GitInfoResult, type ReviewFileResult,
} from './api.ts'

interface ReviewEntry {
  path: string
  staged: boolean
  code: string
}

interface LoadedReview {
  path: string
  staged: boolean
  oldText: string | null
  newText: string | null
  binary: boolean
}

/** The visible status letter for one porcelain XY code. */
function badgeOf(entry: ReviewEntry): string {
  if (entry.staged) return entry.code[0] === '?' ? '?' : (entry.code[0] ?? 'M')
  if (entry.code === '??') return '?'
  return entry.code[1] === '?' ? '?' : (entry.code[1] ?? 'M')
}

/** Split the host status map into one row per staged/unstaged side. */
function entriesOf(status: Record<string, string>): ReviewEntry[] {
  const out: ReviewEntry[] = []
  for (const [path, code] of Object.entries(status)) {
    if (code === '') continue
    const index = code[0]
    const worktree = code[1]
    if (index !== undefined && index !== ' ' && index !== '?') out.push({ path, staged: true, code })
    if (code === '??' || (worktree !== undefined && worktree !== ' ' && worktree !== '?')) {
      out.push({ path, staged: false, code })
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

export function ReviewView(props: {
  sessionId: string
  t: PropsLocale<'codex-files'>['t']
  onOpenFile: (path: string) => void
}) {
  const { sessionId, t, onOpenFile } = props
  const [info, setInfo] = useState<GitInfoResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReviewEntry | null>(null)
  const [file, setFile] = useState<LoadedReview | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const result = await gitInfo(sessionId)
    if (!result.ok) {
      setError(result.message ?? result.code)
      setInfo(null)
    } else {
      setInfo(result)
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadFile = useCallback(async (entry: ReviewEntry): Promise<void> => {
    setSelected(entry)
    setFileLoading(true)
    setFile(null)
    const result: FileRouteResult<ReviewFileResult> = await reviewFile(sessionId, entry.path, entry.staged)
    setFileLoading(false)
    if (!result.ok) {
      setError(result.message ?? result.code)
      return
    }
    setFile({
      path: result.path,
      staged: result.staged,
      oldText: result.oldText,
      newText: result.newText,
      binary: result.binary,
    })
  }, [sessionId])

  const mutate = useCallback(async (action: () => Promise<FileRouteResult<{ ok: true }>>): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setError(result.message ?? result.code)
      return
    }
    await refresh()
    setSelected(null)
    setFile(null)
  }, [refresh])

  const entries = useMemo(() => info === null ? [] : entriesOf(info.status), [info])
  const stagedEntries = entries.filter(entry => entry.staged)
  const unstagedEntries = entries.filter(entry => !entry.staged)

  const renderRow = (entry: ReviewEntry): JSX.Element => {
    const active = selected?.path === entry.path && selected.staged === entry.staged
    return (
      <div key={`${entry.staged ? 's' : 'u'}:${entry.path}`} className={`cfx-review-row${active ? ' cfx-review-row-active' : ''}`}>
        <button type="button" className="cfx-review-row-main" onClick={() => { void loadFile(entry) }} title={entry.path}>
          <span className={`cfx-review-badge cfx-review-badge-${entry.staged ? 'staged' : 'unstaged'}`}>{badgeOf(entry)}</span>
          <span className="cfx-review-name">{entry.path}</span>
        </button>
        <button
          type="button" className="cfx-icon-button" disabled={busy}
          aria-label={entry.staged ? t('review.unstage') : t('review.stage')}
          title={entry.staged ? t('review.unstage') : t('review.stage')}
          onClick={() => { void mutate(() => entry.staged ? reviewUnstage(sessionId, entry.path) : reviewStage(sessionId, entry.path)) }}
        >
          <IconBranchOutline16 size={14} />
        </button>
      </div>
    )
  }

  const commit = async (): Promise<void> => {
    const message = commitMessage.trim()
    if (message === '' || busy) return
    await mutate(() => reviewCommit(sessionId, message))
    setCommitMessage('')
  }

  return (
    <div className="cfx-review">
      <div className="cfx-review-toolbar">
        <span className="cfx-branch" title={info?.branch ?? ''}>
          <IconBranchMark />
          {info?.branch ?? '—'}
        </span>
        <span className="cfx-spacer" />
        <button type="button" className="cfx-icon-button" aria-label={t('file.reload')} title={t('file.reload')} onClick={() => { void refresh() }}>
          <IconRefreshOutline16 size={14} />
        </button>
      </div>
      {loading && <div className="cfx-binary-loading">{t('file.loading')}</div>}
      {!loading && error !== null && <div className="cfx-binary-loading cfx-binary-error">{error}</div>}
      {!loading && info !== null && (
        <>
          <div className="cfx-review-section">
            <div className="cfx-review-section-title">{t('review.staged')} ({stagedEntries.length})</div>
            {stagedEntries.length === 0 && <div className="cfx-review-empty">{t('review.noChanges')}</div>}
            {stagedEntries.map(renderRow)}
          </div>
          <div className="cfx-review-section">
            <div className="cfx-review-section-title">{t('review.unstaged')} ({unstagedEntries.length})</div>
            {unstagedEntries.length === 0 && <div className="cfx-review-empty">{t('review.noChanges')}</div>}
            {unstagedEntries.map(renderRow)}
          </div>
          <div className="cfx-review-commit">
            <input
              className="cfx-review-commit-input"
              value={commitMessage}
              placeholder={t('review.commitPlaceholder')}
              disabled={busy}
              onChange={(event) => { setCommitMessage(event.target.value) }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void commit()
              }}
            />
            <button
              type="button" className="cfx-btn cfx-btn-primary" disabled={busy || commitMessage.trim() === '' || stagedEntries.length === 0}
              onClick={() => { void commit() }}
            >
              <IconCheckOutline16 size={13} />
              {t('review.commit')}
            </button>
          </div>
          {fileLoading && <div className="cfx-binary-loading">{t('file.loading')}</div>}
          {!fileLoading && file !== null && (
            <div className="cfx-review-diff">
              {file.binary ? (
                <div className="cfx-binary-loading cfx-binary-error">{t('file.binary')}</div>
              ) : (
                <>
                  <div className="cfx-review-diff-toolbar">
                    <span className="cfx-review-diff-title" title={file.path}>{file.path}</span>
                    <button type="button" className="cfx-btn" onClick={() => { onOpenFile(file.path) }}>
                      {t('review.openFile')}
                    </button>
                  </div>
                  <DiffBlock
                    className="cfx-review-diff-body"
                    maxLines={1000}
                    diffs={[{ path: file.path, oldText: file.oldText ?? '', newText: file.newText ?? '' }]}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function IconBranchMark(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path d="M10.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM4 2v8.2M4 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM10.5 5A1.5 1.5 0 0 0 12 6.5V9a3 3 0 0 1-3 3H6"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}
