/**
 * CodexFilesPanel: the right details column's occupant — a Codex Desktop-style
 * Files panel. Session files (read/write/edit tool paths) list newest-first;
 * opening one shows a syntax-highlighted preview with an edit mode that saves
 * back through the plugin's host routes. The panel is a pure reader of the
 * conversation snapshot plus its own local tab/edit state; nothing here
 * mutates the session.
 */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  IconBrowseOutline16, IconCheckOutline16, IconChevronLeftOutline14,
  IconCloseOutline16, IconCodeOutline16, IconCopyOutline16, IconEditOutline16,
  IconPanelLeftOutline16, IconRefreshOutline16, IconRightUpOutline16, IconFullscreenOutline16,
  DiffBlock, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FileRouteFailure } from './api.ts'
import { gitInfo, readFile, writeFile } from './api.ts'
import { BrowserView } from './BrowserView.tsx'
import { FileTree } from './FileTree.tsx'
import { isBinaryPreviewKind, previewKindFor } from './preview-logic.ts'
import { FilePreview } from './preview.tsx'
import { isDetailsCollapsed } from './panel-toggle.ts'
import { ReviewView } from './ReviewView.tsx'
import {
  resetRightPanelWidth, setPanelExpanded as setWorkbenchPanelExpanded,
  setRightPanelWidth, setWorkbenchView, toggleBottomPanel, useWorkbenchUi,
  type WorkbenchView,
} from './workbench-store.ts'
import {
  clamp, RIGHT_PANEL_CLOSE_THRESHOLD, RIGHT_PANEL_MIN_WIDTH,
  rightPanelMaximumWidth,
} from './workbench-layout.ts'
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

/** Find the DSH three-column frame that owns this panel's details slot. */
function findLayoutFrame(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null
  while (current !== null) {
    if (current.querySelector(':scope > [data-shell-overlay]') !== null) return current
    current = current.parentElement
  }
  return null
}

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
  const {
    activeView: workbenchView, bottomPanelOpen, fileRequest,
    mainContentWidth, rightPanelWidth,
  } = useWorkbenchUi()
  const [openTools, setOpenTools] = useState<Array<'review' | 'browser'>>([])
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [branch, setBranch] = useState<string | null>(null)
  const [repo, setRepo] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ pointerId: number; startX: number; startWidth: number; lastWidth: number } | null>(null)
  const activeTab = tabs.find(tab => tab.path === activePath)
  const activeFile = useMemo(
    () => files.find(file => file.path === activePath),
    [activePath, files],
  )

  // Native full-width mode keeps the left sidebar independent and gives the
  // right panel all remaining shell width. The geometry bridge recomputes the
  // first track from the host's inline grid whenever the sidebar changes.
  useLayoutEffect(() => {
    const frame = findLayoutFrame(rootRef.current)
    if (frame === null) return
    setWorkbenchPanelExpanded(panelExpanded)
    if (panelExpanded) {
      frame.setAttribute('data-codex-files-layout-expanded', 'true')
    } else {
      frame.removeAttribute('data-codex-files-layout-expanded')
    }
    return () => {
      frame.removeAttribute('data-codex-files-layout-expanded')
      setWorkbenchPanelExpanded(false)
    }
  }, [panelExpanded])

  useEffect(() => {
    const frame = findLayoutFrame(rootRef.current)
    if (frame === null) return
    const clearExpandedWhenClosed = (): void => {
      if (frame.hasAttribute('data-details-collapsed')) setPanelExpanded(false)
    }
    const observer = new MutationObserver(clearExpandedWhenClosed)
    observer.observe(frame, { attributes: true, attributeFilter: ['data-details-collapsed'] })
    return () => { observer.disconnect() }
  }, [])

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
    setOpenTools([])
    setPanelExpanded(false)
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

  useEffect(() => {
    if (workbenchView !== 'review' && workbenchView !== 'browser') return
    setOpenTools(current => current.includes(workbenchView) ? current : [...current, workbenchView])
  }, [workbenchView])

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

  useEffect(() => {
    if (fileRequest === null || fileRequest.sessionId !== sessionId) return
    openFile(fileRequest.path)
  }, [fileRequest, openFile, sessionId])

  /** Review surface → Files tab hand-off for one changed path. */
  const openFileFromReview = useCallback((path: string) => {
    setWorkbenchView('files')
    openFile(path)
  }, [openFile])

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

  const closeTool = useCallback((view: 'review' | 'browser') => {
    const nextTools = openTools.filter(item => item !== view)
    setOpenTools(nextTools)
    if (workbenchView !== view) return
    const nextFile = tabs.at(-1)
    if (nextFile !== undefined) {
      setActivePath(nextFile.path)
      setWorkbenchView('files')
      return
    }
    setWorkbenchView(nextTools.at(-1) ?? 'new-tab')
  }, [openTools, tabs, workbenchView])

  const dirtyCount = tabs.filter(tab => tab.editing).length

  const closePanel = useCallback((): void => {
    setPanelExpanded(false)
    setWorkbenchPanelExpanded(false)
    closeDetails()
  }, [closeDetails])

  const beginPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (panelExpanded || rootRef.current === null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const startWidth = rootRef.current.getBoundingClientRect().width
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      lastWidth: startWidth,
    }
    findLayoutFrame(rootRef.current)?.setAttribute('data-codex-files-right-panel-resizing', 'true')
  }, [panelExpanded])

  const resizePanel = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current
    if (resize === null || resize.pointerId !== event.pointerId) return
    const rawWidth = resize.startWidth + resize.startX - event.clientX
    if (rawWidth < RIGHT_PANEL_CLOSE_THRESHOLD) {
      resizeRef.current = null
      findLayoutFrame(rootRef.current)?.removeAttribute('data-codex-files-right-panel-resizing')
      closePanel()
      return
    }
    const nextWidth = clamp(rawWidth, RIGHT_PANEL_MIN_WIDTH, rightPanelMaximumWidth(mainContentWidth))
    resize.lastWidth = nextWidth
    setRightPanelWidth(nextWidth, false)
  }, [closePanel, mainContentWidth])

  const endPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current
    if (resize === null || resize.pointerId !== event.pointerId) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    findLayoutFrame(rootRef.current)?.removeAttribute('data-codex-files-right-panel-resizing')
    setRightPanelWidth(resize.lastWidth)
  }, [])

  const resizePanelWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const maximum = rightPanelMaximumWidth(mainContentWidth)
    let next: number | null = null
    if (event.key === 'Home') next = RIGHT_PANEL_MIN_WIDTH
    else if (event.key === 'End') next = maximum
    else if (event.key === 'ArrowLeft') next = rightPanelWidth + 10
    else if (event.key === 'ArrowRight') next = rightPanelWidth - 10
    if (next === null) return
    event.preventDefault()
    setRightPanelWidth(clamp(next, RIGHT_PANEL_MIN_WIDTH, maximum))
  }, [mainContentWidth, rightPanelWidth])

  return (
    <div
      ref={rootRef}
      className={`cfx-panel${panelExpanded ? ' cfx-panel-expanded' : ''}`}
      data-codex-files-panel
    >
      {!panelExpanded && (
        <div
          className="cfx-panel-resize-handle"
          role="separator"
          aria-label={t('panel.resizeRight')}
          aria-orientation="vertical"
          aria-valuemin={RIGHT_PANEL_MIN_WIDTH}
          aria-valuemax={Math.round(rightPanelMaximumWidth(mainContentWidth))}
          aria-valuenow={Math.round(rightPanelWidth)}
          tabIndex={0}
          onDoubleClick={resetRightPanelWidth}
          onKeyDown={resizePanelWithKeyboard}
          onPointerDown={beginPanelResize}
          onPointerMove={resizePanel}
          onPointerUp={endPanelResize}
          onPointerCancel={endPanelResize}
        />
      )}
      <div className="cfx-native-tabs" role="tablist">
        {openTools.map(view => (
          <button
            key={view}
            type="button" role="tab"
            className={`cfx-native-tab${workbenchView === view ? ' cfx-native-tab-active' : ''}`}
            aria-selected={workbenchView === view}
            onClick={() => { setWorkbenchView(view) }}
          >
            <WorkbenchGlyph view={view} />
            <span>{t(view === 'review' ? 'review.title' : 'browser.title')}</span>
            <span
              role="button" tabIndex={-1} className="cfx-tab-close"
              aria-label={t('file.close')}
              onClick={(event) => { event.stopPropagation(); closeTool(view) }}
            >
              <IconCloseOutline16 size={11} aria-hidden />
            </span>
          </button>
        ))}
        {tabs.map(tab => (
          <button
            key={tab.path} type="button" role="tab"
            className={`cfx-native-tab${workbenchView === 'files' && tab.path === activePath ? ' cfx-native-tab-active' : ''}`}
            aria-selected={workbenchView === 'files' && tab.path === activePath}
            onClick={() => { setWorkbenchView('files'); activateTab(tab.path) }}
          >
            <FileTypeMark path={tab.path} />
            <span className="cfx-tab-name">{splitDisplayPath(tab.path).name}</span>
            {tab.editing && <span className="cfx-tab-dot" aria-label={t('file.unsaved')} />}
            <span
              role="button" tabIndex={-1} className="cfx-tab-close"
              aria-label={t('file.close')}
              onClick={(event) => { event.stopPropagation(); closeTab(tab.path) }}
            >
              <IconCloseOutline16 size={11} aria-hidden />
            </span>
          </button>
        ))}
        <button
          type="button" className="cfx-native-tab-add" title={t('panel.title')}
          aria-label={t('panel.title')}
          onClick={() => { setWorkbenchView('new-tab') }}
        >
          <PlusGlyph />
        </button>
        <span className="cfx-spacer" />
        <button type="button" className={`cfx-icon-button${bottomPanelOpen ? ' cfx-icon-button-active' : ''}`} title={t('panel.toggleBottom')} aria-label={t('panel.toggleBottom')} onClick={toggleBottomPanel}>
          <BottomPanelGlyph />
        </button>
        <button type="button" className={`cfx-icon-button${panelExpanded ? ' cfx-icon-button-active' : ''}`} title={t(panelExpanded ? 'panel.collapse' : 'panel.expand')} aria-label={t(panelExpanded ? 'panel.collapse' : 'panel.expand')} aria-pressed={panelExpanded} onClick={() => { setPanelExpanded(value => !value) }}>
          <IconFullscreenOutline16 size={14} aria-hidden />
        </button>
        <button type="button" className="cfx-icon-button" title={t('panel.close')} aria-label={t('panel.close')} onClick={closePanel}>
          <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
        </button>
      </div>

      {workbenchView === 'review' && <div className="cfx-workbench-body"><ReviewView sessionId={sessionId} t={t} onOpenFile={openFileFromReview} /></div>}
      {workbenchView === 'browser' && <div className="cfx-workbench-body"><BrowserView t={t} /></div>}
      {workbenchView === 'new-tab' && (
        <WorkbenchActions
          t={t}
          bottomPanelOpen={bottomPanelOpen}
          onOpen={(view) => { setWorkbenchView(view) }}
        />
      )}

      {workbenchView === 'files' && (
        <div className={`cfx-files-workspace${activeTab === undefined ? '' : ' cfx-files-workspace-has-file'}`}>
          <section className="cfx-editor-pane">
          {activeTab === undefined ? (
            <div className="cfx-file-home">
              <div className="cfx-file-home-title">
                <span>{t('tree.activity')}</span>
                <span>{t('list.files', { count: String(files.length) })}</span>
              </div>
              <FileList files={files} t={t} onOpen={openFile} />
            </div>
          ) : (
            <div className="cfx-fileview">
          <div className="cfx-toolbar">
            <button
              type="button" className="cfx-icon-button" title={t('file.back')}
              aria-label={t('file.back')}
              onClick={() => { setActivePath(null) }}
            >
              <IconChevronLeftOutline14 size={14} aria-hidden />
            </button>
            <span className="cfx-path" title={activeTab.path}>{activeTab.path}</span>
            <button type="button" className="cfx-icon-button" title={t('panel.refresh')} aria-label={t('panel.refresh')} disabled={loading} onClick={() => { void loadInto(activeTab.path) }}>
              <IconRefreshOutline16 size={14} aria-hidden />
            </button>
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
          </section>
          <aside className="cfx-explorer-pane">
            <div className="cfx-explorer-header">
              <IconBrowseOutline16 size={15} aria-hidden />
              <span>{repo ?? t('tree.workspace')}</span>
              <span>{t('list.files', { count: String(files.length) })}</span>
            </div>
            <FileTree sessionId={sessionId} status={statusMap} onOpenFile={openFile} t={t} />
          </aside>
        </div>
      )}
    </div>
  )
}

function WorkbenchActions(props: {
  t: PropsLocale<'codex-files'>['t']
  bottomPanelOpen: boolean
  onOpen: (view: Exclude<WorkbenchView, 'new-tab'>) => void
}) {
  const { t, bottomPanelOpen, onOpen } = props
  const actions: Array<{
    id: 'review' | 'terminal' | 'browser' | 'files'
    label: string
    shortcut: string
    active?: boolean
    select: () => void
  }> = [
    { id: 'review', label: t('review.title'), shortcut: 'Ctrl+Shift+G', select: () => { onOpen('review') } },
    { id: 'terminal', label: t('terminal.title'), shortcut: 'Ctrl+`', active: bottomPanelOpen, select: toggleBottomPanel },
    { id: 'browser', label: t('browser.title'), shortcut: 'Ctrl+T', select: () => { onOpen('browser') } },
    { id: 'files', label: t('panel.title'), shortcut: 'Ctrl+P', select: () => { onOpen('files') } },
  ]
  return (
    <nav className="cfx-workbench-new-tab" aria-label={t('panel.tools')}>
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          className={`cfx-launcher-action${action.active === true ? ' cfx-launcher-action-active' : ''}`}
          aria-keyshortcuts={action.shortcut.replaceAll('+', ' ')}
          onClick={action.select}
        >
          <WorkbenchGlyph view={action.id} />
          <span>{action.label}</span>
          <kbd>{action.shortcut}</kbd>
        </button>
      ))}
    </nav>
  )
}

/** Inline glyphs for the Codex-style workbench tab bar. */
function WorkbenchGlyph(props: { view: Exclude<WorkbenchView, 'new-tab'> | 'terminal' }) {
  const size = 15
  if (props.view === 'files') {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h2.6l1.2 1.5H13A1.5 1.5 0 0 1 14.5 6v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z"
          fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  if (props.view === 'review') {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <path d="M3 1.5h8L14.5 5v9a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 1.5V5h3.5M5 8.5l1.5 1.5 3-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (props.view === 'browser') {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <circle cx="8" cy="8" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.8 8h10.4M8 2.3c1.5 1.4 2.2 3.2 2.2 5.7S9.5 12.3 8 13.7C6.5 12.3 5.8 10.5 5.8 8S6.5 3.7 8 2.3z"
          fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <path d="M2 3.5h12v6H2zM6 9.5v3M10 9.5v3M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileTypeMark({ path }: { path: string }) {
  const extension = path.split('.').pop()?.slice(0, 2).toUpperCase() ?? ''
  return <span className="cfx-file-type-mark" aria-hidden>{extension}</span>
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** Small bottom-panel toggle glyph. */
function BottomPanelGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M2 11V4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5V11M2 11h12M2 11v.5A1.5 1.5 0 0 0 3.5 13h9a1.5 1.5 0 0 0 1.5-1.5V11"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  PropsRuntime<'conversation.session.header.utilities'> & PanelToggleInjected & PropsLocale<'codex-files'>

export function PanelToggle({ togglePanel, t }: PanelToggleProps) {
  const [collapsed, setCollapsed] = useState(() => isDetailsCollapsed())

  useEffect(() => {
    const update = (): void => { setCollapsed(isDetailsCollapsed()) }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-details-collapsed'],
    })
    return () => { observer.disconnect() }
  }, [])

  if (!collapsed) return null
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
