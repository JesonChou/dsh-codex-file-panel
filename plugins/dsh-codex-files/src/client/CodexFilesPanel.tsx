/**
 * CodexFilesPanel: the right details column's occupant — a Codex Desktop-style
 * Files panel. Session files (read/write/edit tool paths) list newest-first;
 * opening one shows a syntax-highlighted preview with an edit mode that saves
 * back through the plugin's host routes. The panel is a pure reader of the
 * conversation snapshot plus its own local tab/edit state; nothing here
 * mutates the session.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconBrowseOutline16, IconCheckOutline16, IconChevronLeftOutline14,
  IconCloseOutline16, IconCodeOutline16, IconCopyOutline16, IconEditOutline16,
  IconPanelLeftOutline16, IconRefreshOutline16, IconRightUpOutline16,
  DiffBlock, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FileRouteFailure } from './api.ts'
import { gitInfo, readFile, writeFile } from './api.ts'
import { FileTree } from './FileTree.tsx'
import { isBinaryPreviewKind, previewKindFor } from './preview-logic.ts'
import { FilePreview } from './preview.tsx'
import {
  collectSessionFiles, sessionFilesEqual, splitDisplayPath,
  toDiffHunks, type SessionFile,
} from './files.ts'

/** The plugin's injected share: layout orchestration plus the system opener. */
export interface PanelInjected {
  /** Close the details column (layout geometry stays with ctx.layout). */
  closeDetails: () => void
  /** Open a filesystem path with the host OS default application. */
  openPath: (path: string) => void
}

/** Full panel props: the details-slot runtime share + injected + locale. */
export type CodexFilesPanelProps =
  PropsRuntime<'details'> & PanelInjected & PropsLocale<'codex-files'>

/** Localized text for one route failure code. */
function failureText(t: PropsLocale<'codex-files'>['t'], failure: FileRouteFailure): string {
  switch (failure.code) {
    case 'path-escape': return t('file.pathEscape')
    case 'session-not-found':
    case 'session-no-cwd': return t('file.sessionMissing')
    case 'file-not-found':
    case 'not-a-file': return t('file.notFound')
    case 'file-too-large':
      return t('file.tooLarge', { limit: String(failure.limit ?? '') })
    case 'binary-file': return t('file.binary')
    default: return t('file.error', { message: failure.message ?? failure.code })
  }
}

/** One open file tab. */
interface OpenTab {
  path: string
  /** Disk content last loaded or saved (the preview's source of truth). */
  content: string
  /** True while an edit draft is open (content diverged from disk). */
  editing: boolean
  /** The unsaved draft text while editing. */
  draft: string
  /** Bump to re-mount the preview (binary refreshes, which load no text). */
  refreshKey: number
}

const EMPTY_TABS: OpenTab[] = []

export function CodexFilesPanel({
  sessionId, useSession, useSessions, closeDetails, openPath, t,
}: CodexFilesPanelProps) {
  const cwd = useSessions(s => s.byId[sessionId]?.cwd)
  const files = useSession(s => collectSessionFiles(s), sessionFilesEqual)
  const [tabs, setTabs] = useState<OpenTab[]>(EMPTY_TABS)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<FileRouteFailure | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [viewMode, setViewMode] = useState<'content' | 'diff'>('content')
  const [viewTab, setViewTab] = useState<'workspace' | 'activity'>('workspace')
  const [branch, setBranch] = useState<string | null>(null)
  const [repo, setRepo] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const activeTab = tabs.find(tab => tab.path === activePath)
  const activeFile = useMemo(
    () => files.find(file => file.path === activePath),
    [activePath, files],
  )

  // A session switch resets the panel's whole local state (details is a
  // session-scope seat; the component instance survives the switch).
  useEffect(() => {
    setTabs(EMPTY_TABS)
    setActivePath(null)
    setLoadError(null)
    setSaving(false)
    setSavedFlash(false)
    setCopiedFlash(false)
    setViewMode('content')
    setViewTab('workspace')
    setBranch(null)
    setRepo(null)
    setStatusMap({})
    void gitInfo(sessionId).then(result => {
      if (result.ok) {
        setBranch(result.branch)
        setRepo(result.repo)
        setStatusMap(result.status)
      }
    })
  }, [sessionId])

  /** Load a file's disk content into (or refresh) a tab. */
  const loadInto = useCallback(async (path: string): Promise<void> => {
    if (isBinaryPreviewKind(previewKindFor(path))) {
      // Binary previews fetch their own bytes through /raw; a refresh just
      // re-mounts the previewer. The text read route would answer
      // `binary-file` and mask the preview behind an error.
      setLoadError(null)
      setTabs(prev => prev.map(tab => tab.path === path ? { ...tab, refreshKey: tab.refreshKey + 1 } : tab))
      return
    }
    setLoading(true)
    setLoadError(null)
    const result = await readFile(sessionId, path)
    setLoading(false)
    if (!result.ok) {
      setLoadError(result)
      return
    }
    setTabs(prev => prev.map(tab => tab.path === path ? { ...tab, content: result.content, editing: false, draft: result.content } : tab))
  }, [sessionId])

  /** Open (or activate) one session file; loads its content on first open. */
  const openFile = useCallback((path: string) => {
    setActivePath(path)
    setLoadError(null)
    const binary = isBinaryPreviewKind(previewKindFor(path))
    setTabs(prev => prev.some(tab => tab.path === path) ? prev : [...prev, { path, content: '', editing: false, draft: '', refreshKey: 0 }])
    if (!binary) void loadInto(path)
  }, [loadInto])

  /** Close one tab; the active tab falls back to its neighbor. */
  const closeTab = useCallback((path: string) => {
    setTabs(prev => {
      const index = prev.findIndex(tab => tab.path === path)
      const next = prev.filter(tab => tab.path !== path)
      if (activePath === path) {
        const neighbor = next[Math.max(0, index - 1)] ?? next[0] ?? null
        setActivePath(neighbor?.path ?? null)
      }
      return next
    })
  }, [activePath])

  /** Activate a tab without reloading its cached content. */
  const activateTab = useCallback((path: string) => {
    setActivePath(path)
    setLoadError(null)
  }, [])

  /** Enter edit mode seeded with the preview content. */
  const startEdit = useCallback(() => {
    if (isBinaryPreviewKind(previewKindFor(activePath ?? ''))) return
    setTabs(prev => prev.map(tab => tab.path === activePath && !tab.editing
      ? { ...tab, editing: true, draft: tab.content }
      : tab))
    setLoadError(null)
  }, [activePath])

  /** Drop the edit draft and return to the preview. */
  const cancelEdit = useCallback(() => {
    setTabs(prev => prev.map(tab => tab.path === activePath ? { ...tab, editing: false, draft: tab.content } : tab))
    setLoadError(null)
  }, [activePath])

  /** Persist the draft through the plugin's write route. */
  const save = useCallback(async () => {
    const tab = tabs.find(t => t.path === activePath)
    if (tab === undefined || !tab.editing) return
    setSaving(true)
    setLoadError(null)
    const result = await writeFile(sessionId, tab.path, tab.draft)
    setSaving(false)
    if (!result.ok) {
      setLoadError(result)
      return
    }
    setTabs(prev => prev.map(t => t.path === tab.path ? { ...t, content: t.draft, editing: false } : t))
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }, [activePath, sessionId, tabs])

  /** Absolute path for system-open and copy actions. */
  const absolutePath = useMemo(() => {
    if (activePath === null) return null
    if (activePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(activePath)) return activePath
    if (cwd === undefined || cwd === '') return null
    return `${cwd.replace(/[\\/]$/, '')}/${activePath.replace(/^[\\/]+/, '')}`
  }, [activePath, cwd])

  const copyPath = useCallback(() => {
    if (absolutePath === null) return
    void writeClipboard(absolutePath)
    setCopiedFlash(true)
    window.setTimeout(() => setCopiedFlash(false), 1500)
  }, [absolutePath])

  const openInSystem = useCallback(() => {
    if (absolutePath !== null) openPath(absolutePath)
  }, [absolutePath, openPath])

  const dirtyCount = tabs.filter(tab => tab.editing).length

  return (
    <div className="cfx-panel" data-codex-files-panel>
      <div className="cfx-header">
        <IconBrowseOutline16 size={14} aria-hidden />
        <span className="cfx-title">{t('panel.title')}</span>
        <span className="cfx-count">{t('list.files', { count: String(files.length) })}</span>
        <span className="cfx-spacer" />
        {activePath !== null && (
          <button
            type="button" className="cfx-icon-button" title={t('panel.refresh')}
            aria-label={t('panel.refresh')}
            disabled={loading}
            onClick={() => { void loadInto(activePath) }}
          >
            <IconRefreshOutline16 size={14} aria-hidden />
          </button>
        )}
        <button
          type="button" className="cfx-icon-button" title={t('panel.close')}
          aria-label={t('panel.close')}
          onClick={closeDetails}
        >
          <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
        </button>
      </div>

      {activeTab === undefined && (
        <div className="cfx-viewtabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={viewTab === 'workspace'}
            className={`cfx-viewtab${viewTab === 'workspace' ? ' cfx-viewtab-active' : ''}`}
            onClick={() => { setViewTab('workspace') }}
          >
            {t('tree.workspace')}
          </button>
          <button
            type="button" role="tab" aria-selected={viewTab === 'activity'}
            className={`cfx-viewtab${viewTab === 'activity' ? ' cfx-viewtab-active' : ''}`}
            onClick={() => { setViewTab('activity') }}
          >
            {t('tree.activity')}
          </button>
        </div>
      )}

      {activeTab === undefined ? (
        viewTab === 'workspace'
          ? <FileTree sessionId={sessionId} status={statusMap} onOpenFile={openFile} t={t} />
          : <FileList files={files} t={t} onOpen={openFile} />
      ) : (
        <div className="cfx-fileview">
          <div className="cfx-tabs" role="tablist">
            {tabs.map(tab => (
              <button
                key={tab.path} type="button" role="tab"
                className={`cfx-tab${tab.path === activePath ? ' cfx-tab-active' : ''}`}
                aria-selected={tab.path === activePath}
                onClick={() => { activateTab(tab.path) }}
              >
                <span className="cfx-tab-name">{splitDisplayPath(tab.path).name}</span>
                {tab.editing && <span className="cfx-tab-dot" aria-label={t('file.unsaved')} />}
                <span
                  role="button" tabIndex={-1} className="cfx-tab-close"
                  aria-label={t('file.close')}
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(tab.path)
                  }}
                >
                  <IconCloseOutline16 size={11} aria-hidden />
                </span>
              </button>
            ))}
          </div>

          <div className="cfx-toolbar">
            <button
              type="button" className="cfx-icon-button" title={t('file.back')}
              aria-label={t('file.back')}
              onClick={() => { setActivePath(null) }}
            >
              <IconChevronLeftOutline14 size={14} aria-hidden />
            </button>
            <span className="cfx-path" title={activeTab.path}>{activeTab.path}</span>
            {!activeTab.editing ? (
              <>
                {activeFile !== undefined && activeFile.diffs.length > 0 && (
                  <button
                    type="button" className={`cfx-btn${viewMode === 'diff' ? ' cfx-btn-selected' : ''}`}
                    onClick={() => { setViewMode(viewMode === 'diff' ? 'content' : 'diff') }}
                  >
                    <IconCodeOutline16 size={13} aria-hidden />
                    {viewMode === 'diff' ? t('file.preview') : t('file.diff')}
                  </button>
                )}
                {!isBinaryPreviewKind(previewKindFor(activeTab.path)) && (
                  <button type="button" className="cfx-btn" onClick={startEdit}>
                    <IconEditOutline16 size={13} aria-hidden />
                    {t('file.edit')}
                  </button>
                )}
                <button
                  type="button" className="cfx-btn" title={t('file.openInSystem')}
                  aria-label={t('file.openInSystem')}
                  disabled={absolutePath === null}
                  onClick={openInSystem}
                >
                  <IconRightUpOutline16 size={13} aria-hidden />
                </button>
                <button type="button" className="cfx-btn" onClick={copyPath}>
                  {copiedFlash ? <IconCheckOutline16 size={13} aria-hidden /> : <IconCopyOutline16 size={13} aria-hidden />}
                  {copiedFlash ? t('file.copied') : t('file.copyPath')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="cfx-btn" onClick={cancelEdit}>
                  {t('file.cancel')}
                </button>
                <button type="button" className="cfx-btn cfx-btn-primary" disabled={saving} onClick={() => { void save() }}>
                  <IconCheckOutline16 size={13} aria-hidden />
                  {saving ? '…' : savedFlash ? t('file.saved') : t('file.save')}
                </button>
              </>
            )}
          </div>

          <div className="cfx-content">
            {loadError !== null ? (
              <div className="cfx-error">
                <span>{failureText(t, loadError)}</span>
                <button type="button" className="cfx-btn" onClick={() => { void loadInto(activeTab.path) }}>
                  <IconRefreshOutline16 size={13} aria-hidden />
                  {t('file.reload')}
                </button>
              </div>
            ) : activeTab.editing ? (
              <textarea
                className="cfx-editor" spellCheck={false}
                value={activeTab.draft}
                aria-label={t('file.edited')}
                onChange={(event) => {
                  const draft = event.target.value
                  setTabs(prev => prev.map(tab => tab.path === activeTab.path ? { ...tab, draft } : tab))
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                    event.preventDefault()
                    void save()
                  }
                }}
              />
            ) : viewMode === 'diff' && activeFile !== undefined && activeFile.diffs.length > 0 ? (
              <div className="cfx-diff">
                <DiffBlock diffs={toDiffHunks(activeFile.diffs)} />
              </div>
            ) : (
              <FilePreview
                key={`${activeTab.path}:${activeTab.refreshKey}`}
                sessionId={sessionId} path={activeTab.path} content={activeTab.content} t={t}
              />
            )}
          </div>

          <div className="cfx-status">
            {branch !== null && (
              <span className="cfx-branch" title={branch}>
                <IconBranchMark />
                {branch}
              </span>
            )}
            {repo !== null && <span className="cfx-repo">{repo}</span>}
            <span className="cfx-spacer" />
            {loadError !== null
              ? <span className="cfx-status-error">{failureText(t, loadError)}</span>
              : activeTab.editing
                ? <span className="cfx-status-dirty">{t('file.unsaved')}</span>
                : savedFlash
                  ? <span>{t('file.saved')}</span>
                  : <span>{t('file.preview')}</span>}
            {dirtyCount > 1 && <span>· {dirtyCount} {t('file.unsaved')}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/** The default file-list body (no tab open). */
function FileList(props: {
  files: readonly SessionFile[]
  t: PropsLocale<'codex-files'>['t']
  onOpen: (path: string) => void
}) {
  const { files, t, onOpen } = props
  if (files.length === 0) {
    return (
      <div className="cfx-empty">
        <IconCodeOutline16 className="cfx-empty-icon" size={28} aria-hidden />
        <span className="cfx-empty-title">{t('panel.empty')}</span>
        <span className="cfx-empty-hint">{t('panel.emptyHint')}</span>
        <div className="cfx-hints">
          <span className="cfx-hint-row"><kbd>{t('tree.hintOpen')}</kbd></span>
          <span className="cfx-hint-row"><kbd>{t('tree.hintSave')}</kbd></span>
          <span className="cfx-hint-row"><kbd>{t('tree.hintSearch')}</kbd></span>
        </div>
      </div>
    )
  }
  return (
    <div className="cfx-list">
      {files.map(file => (
        <FileRow key={file.path} file={file} t={t} onOpen={() => { onOpen(file.path) }} />
      ))}
    </div>
  )
}

/** One file row: icon, name + directory, newest op badge, and +N/-M totals. */
function FileRow(props: {
  file: SessionFile
  t: PropsLocale<'codex-files'>['t']
  onOpen: () => void
}) {
  const { file, t, onOpen } = props
  const { name, dir } = splitDisplayPath(file.path)
  const newest = file.ops[0] ?? 'read'
  const hasTotals = file.added > 0 || file.removed > 0
  return (
    <button type="button" className="cfx-file-row" onClick={onOpen}>
      <IconCodeOutline16 className="cfx-file-icon" size={16} aria-hidden />
      <span className="cfx-file-meta">
        <span className="cfx-file-name">{name}</span>
        {dir !== '' && <span className="cfx-file-dir">{dir}</span>}
      </span>
      {hasTotals && (
        <span className="cfx-file-totals">
          {file.added > 0 && <span className="cfx-file-added">+{file.added}</span>}
          {file.removed > 0 && <span className="cfx-file-removed">-{file.removed}</span>}
        </span>
      )}
      <span className={`cfx-file-op cfx-file-op-${newest}`}>
        {newest === 'read' ? t('list.read') : newest === 'write' ? t('list.new') : t('list.modified')}
      </span>
    </button>
  )
}

/** The git-branch glyph for the status strip. */
function IconBranchMark(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path
        d="M10.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM4 2v8.2M4 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM10.5 5A1.5 1.5 0 0 0 12 6.5V9a3 3 0 0 1-3 3H6"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

/** The session-header toggle that opens and closes the files panel, exactly
 *  like the left sidebar's own panel toggle (same glyph, mirrored). */
export interface PanelToggleInjected {
  togglePanel: () => void
}

/** Full toggle props: header-actions runtime share + injected toggle + locale. */
export type PanelToggleProps =
  PropsRuntime<'conversation.session.header.actions'> & PanelToggleInjected & PropsLocale<'codex-files'>

export function PanelToggle({ togglePanel, t }: PanelToggleProps) {
  return (
    <button
      type="button" className="cfx-header-toggle" title={t('panel.toggle')}
      aria-label={t('panel.toggle')}
      onClick={togglePanel}
    >
      <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
    </button>
  )
}
