/**
 * FileTree: the workspace browser inside the Files panel — a lazily loaded
 * directory tree rooted at the session cwd. Directories expand on click
 * (one listing per directory, cached); files open through the panel's tab
 * machinery. A search box switches the tree into flat filename-search mode
 * (host-side BFS, capped). Git status letters (M/A/D/?) decorate rows from
 * the /git route's porcelain map.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { findFiles, listDir, type DirEntry } from './api.ts'

/** One tree row: a directory entry under a parent path. */
interface TreeRow {
  path: string
  name: string
  dir: boolean
}

interface FocusableRow extends TreeRow {
  depth: number
}

/** Tree props. */
export interface FileTreeProps {
  sessionId: string
  /** Porcelain status map (path → code). */
  status: Record<string, string>
  /** Open a file path in the panel's tab view. */
  onOpenFile: (path: string) => void
  t: PropsLocale<'codex-files'>['t']
}

/** Retry count for a listing that races the host's session registration. */
export const LIST_RETRIES = 3

/** Base backoff delay between listing retries (ms). */
export const LIST_RETRY_DELAY_MS = 600

/** The git status code → display letter. */function statusLetter(status: Record<string, string>, path: string): string | null {
  const code = status[path] ?? ''
  if (code === '') return null
  if (code.includes('A')) return 'A'
  if (code.includes('D')) return 'D'
  if (code.includes('R')) return 'R'
  if (code.includes('M')) return 'M'
  return '?'
}

/** The git letter → CSS class. */
function statusClass(letter: string): string {
  switch (letter) {
    case 'A': return 'cfx-git-a'
    case 'D': return 'cfx-git-d'
    case 'R': return 'cfx-git-r'
    case 'M': return 'cfx-git-m'
    default: return 'cfx-git-u'
  }
}

/** The folder/open folder glyphs (kept inline to avoid icon-table coupling). */
function FolderGlyph(props: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d={props.open
          ? 'M1.5 4.5A1.5 1.5 0 0 1 3 3h2.6l1.2 1.5H13A1.5 1.5 0 0 1 14.5 6v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z'
          : 'M1.5 5A1.5 1.5 0 0 1 3 3.5h2.6l1.2 1.5H13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 11.5V5z'}
        fill={props.open ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.1"
      />
    </svg>
  )
}

/** File glyph with extension tint. */
function FileGlyph(props: { name: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M4 1.5h5L12.5 5v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z"
        fill="none" stroke="currentColor" strokeWidth="1.1"
      />
      <path d="M9 1.5V5h3.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export function FileTree({ sessionId, status, onOpenFile, t }: FileTreeProps) {
  const [dirs, setDirs] = useState<Map<string, DirEntry[]>>(() => new Map())
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<number | null>(null)
  // Loaded-path bookkeeping lives in a ref, NOT in state: reading `dirs`
  // inside loadDir would rebuild the callback on every listing and re-run
  // the root-load effect (which resets the tree) — an endless "loading" loop.
  const loadedRef = useRef<Set<string>>(new Set())
  // Session generation: retries scheduled by a previous session must never
  // land state into the current session's tree.
  const generationRef = useRef(0)
  const searchingFor = query.trim().toLowerCase()

  const loadDir = useCallback(async (
    path: string,
    attempt = 0,
    generation = generationRef.current,
  ): Promise<void> => {
    // The in-flight flag gates only the FIRST attempt; scheduled retries
    // must run even while the flag stays set.
    if (attempt === 0 && loadedRef.current.has(path)) return
    if (attempt === 0) {
      // Mark in-flight before the first fetch; retries keep the flag set.
      loadedRef.current.add(path)
      setLoading(prev => new Set(prev).add(path))
      setErrors(prev => { const next = new Set(prev); next.delete(path); return next })
    }
    const result = await listDir(sessionId, path)
    if (generationRef.current !== generation) return
    if (result.ok) {
      setLoading(prev => { const next = new Set(prev); next.delete(path); return next })
      setDirs(prev => new Map(prev).set(path, result.entries))
      return
    }
    // The panel can mount a moment before the host finished registering a
    // freshly opened session (session-not-found). Back off and retry a few
    // times instead of showing an empty tree the user has to fix by hand.
    if (attempt < LIST_RETRIES) {
      window.setTimeout(() => {
        void loadDir(path, attempt + 1, generation)
      }, LIST_RETRY_DELAY_MS * (attempt + 1))
      return
    }
    loadedRef.current.delete(path)
    setLoading(prev => { const next = new Set(prev); next.delete(path); return next })
    setErrors(prev => new Set(prev).add(path))
  }, [sessionId])

  /** Retry a failed listing (clears its error first). */
  const retryDir = useCallback((path: string) => {
    setErrors(prev => { const next = new Set(prev); next.delete(path); return next })
    void loadDir(path)
  }, [loadDir])

  // The root listing loads once per session (loadDir is stable per sessionId).
  useEffect(() => {
    generationRef.current += 1
    loadedRef.current = new Set()
    setDirs(new Map())
    setExpanded(new Set())
    setResults(null)
    setQuery('')
    setErrors(new Set())
    setFocusedPath(null)
    void loadDir('')
  }, [loadDir, sessionId])

  // Debounced workspace search: clears when the query empties.
  useEffect(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current)
    if (searchingFor === '') {
      setResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = window.setTimeout(() => {
      void findFiles(sessionId, searchingFor).then(result => {
        setResults(result.ok ? result.matches : [])
        setSearching(false)
      })
    }, 220)
  }, [searchingFor, sessionId])

  const toggleDir = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    void loadDir(path)
  }, [loadDir])

  const visibleRows = useMemo(() => {
    const rows: FocusableRow[] = []
    const visit = (path: string, depth: number): void => {
      for (const entry of dirs.get(path) ?? []) {
        const child = path === '' ? entry.name : `${path}/${entry.name}`
        rows.push({ path: child, name: entry.name, dir: entry.dir, depth })
        if (entry.dir && expanded.has(child)) visit(child, depth + 1)
      }
    }
    visit('', 0)
    return rows
  }, [dirs, expanded])

  const moveFocus = useCallback((delta: number) => {
    if (visibleRows.length === 0) return
    const current = focusedPath === null ? -1 : visibleRows.findIndex(row => row.path === focusedPath)
    const next = Math.max(0, Math.min(visibleRows.length - 1, current + delta))
    const nextPath = visibleRows[next]?.path ?? null
    setFocusedPath(nextPath)
    const focusRow = (): void => {
      const row = Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[data-cfx-tree-path]') ?? [])
        .find(element => element.dataset.cfxTreePath === nextPath)
      row?.focus()
      row?.scrollIntoView?.({ block: 'nearest' })
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusRow)
    else focusRow()
  }, [focusedPath, visibleRows])

  const handleTreeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (focusedPath === null) return
    const row = visibleRows.find(item => item.path === focusedPath)
    if (row === undefined) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (row.dir) toggleDir(row.path)
      else onOpenFile(row.path)
    } else if (event.key === 'ArrowRight' && row.dir && !expanded.has(row.path)) {
      event.preventDefault()
      toggleDir(row.path)
    } else if (event.key === 'ArrowLeft' && row.dir && expanded.has(row.path)) {
      event.preventDefault()
      toggleDir(row.path)
    } else if (event.key === 'Escape' && query !== '') {
      event.preventDefault()
      setQuery('')
    }
  }, [expanded, focusedPath, moveFocus, onOpenFile, query, toggleDir, visibleRows])

  /** One recursion level of the tree. */
  const renderLevel = useCallback((path: string, depth: number): JSX.Element[] => {
    const entries = dirs.get(path)
    if (entries === undefined) {
      if (errors.has(path)) {
        return [(
          <div key={`${path}::error`} className="cfx-tree-row cfx-tree-error" style={{ paddingLeft: `${10 + depth * 14}px` }}>
            <span className="cfx-tree-name">{t('tree.listFailed')}</span>
            <button
              type="button" className="cfx-btn" onClick={() => { retryDir(path) }}
            >
              {t('file.reload')}
            </button>
          </div>
        )]
      }
      return [(
        <div key={`${path}::loading`} className="cfx-tree-row cfx-tree-loading" style={{ paddingLeft: `${10 + depth * 14}px` }}>
          {t('file.loading')}
        </div>
      )]
    }
    const rows: JSX.Element[] = []
    for (const entry of entries) {
      const child = path === '' ? entry.name : `${path}/${entry.name}`
      if (entry.dir) {
        const isOpen = expanded.has(child)
        rows.push((
          <button
            key={child} type="button" className="cfx-tree-row"
            role="treeitem"
            data-cfx-tree-path={child}
            aria-current={focusedPath === child ? 'true' : undefined}
            aria-expanded={isOpen}
            tabIndex={focusedPath === child ? 0 : -1}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onFocus={() => { setFocusedPath(child) }}
            onClick={() => { setFocusedPath(child); toggleDir(child) }}
            title={child}
          >
            <span className={`cfx-tree-caret${isOpen ? ' cfx-tree-caret-open' : ''}`}>
              <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
                <path d="M5 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <FolderGlyph open={isOpen} />
            <span className="cfx-tree-name">{entry.name}</span>
          </button>
        ))
        if (isOpen) rows.push(...renderLevel(child, depth + 1))
      } else {
        const letter = statusLetter(status, child)
        rows.push((
          <button
            key={child} type="button" className="cfx-tree-row"
            role="treeitem"
            data-cfx-tree-path={child}
            aria-current={focusedPath === child ? 'true' : undefined}
            tabIndex={focusedPath === child ? 0 : -1}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onFocus={() => { setFocusedPath(child) }}
            onClick={() => { setFocusedPath(child); onOpenFile(child) }}
            title={child}
          >
            <span className="cfx-tree-caret" />
            <FileGlyph name={entry.name} />
            <span className="cfx-tree-name">{entry.name}</span>
            {letter !== null && <span className={`cfx-tree-status ${statusClass(letter)}`}>{letter}</span>}
          </button>
        ))
      }
    }
    return rows
  }, [dirs, expanded, errors, focusedPath, status, toggleDir, retryDir, onOpenFile, t])

  const treeBody = useMemo(
    () => renderLevel('', 0),
    [renderLevel],
  )

  return (
    <div className="cfx-filetree">
      <div className="cfx-tree-search">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <circle cx="6.8" cy="6.8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.3 10.3l3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text" className="cfx-tree-search-input" placeholder={t('tree.search')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
          aria-label={t('tree.search')}
        />
      </div>
      <div
        ref={treeRef}
        className="cfx-tree-scroll"
        role="tree"
        tabIndex={0}
        aria-label={t('tree.workspace')}
        onFocus={() => { if (focusedPath === null) setFocusedPath(visibleRows[0]?.path ?? null) }}
        onKeyDown={handleTreeKeyDown}
      >
        {searchingFor !== '' ? (
          searching
            ? <div className="cfx-tree-row cfx-tree-loading">{t('file.loading')}</div>
            : results === null
              ? <div className="cfx-tree-row cfx-tree-loading">{t('file.loading')}</div>
              : results.length === 0
                ? <div className="cfx-tree-row cfx-tree-loading">{t('tree.noMatches')}</div>
                : results.map(match => {
                  const isDir = match.endsWith('/')
                  const path = isDir ? match.slice(0, -1) : match
                  const letter = isDir ? null : statusLetter(status, path)
                  return (
                    <button
                      key={path} type="button" className="cfx-tree-row"
                      style={{ paddingLeft: 10 }}
                      onClick={() => {
                        if (isDir) {
                          setQuery('')
                          setExpanded(prev => new Set(prev).add(path))
                          void loadDir(path)
                        } else {
                          onOpenFile(path)
                        }
                      }}
                      title={path}
                    >
                      <span className="cfx-tree-caret" />
                      {isDir ? <FolderGlyph open={false} /> : <FileGlyph name={path} />}
                      <span className="cfx-tree-name">{path}</span>
                      {letter !== null && <span className={`cfx-tree-status ${statusClass(letter)}`}>{letter}</span>}
                    </button>
                  )
                })
        ) : treeBody}
      </div>
    </div>
  )
}
