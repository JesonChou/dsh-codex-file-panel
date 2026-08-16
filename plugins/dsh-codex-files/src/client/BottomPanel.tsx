/**
 * The Codex-style bottom panel. It renders through the shell.overlay slot for
 * framework discovery, but portals its DOM into the DSH three-column frame as
 * a true grid row (conversation + details width only), so opening it never
 * lifts or overlays the left sidebar.
 */
import {
  IconCloseOutline16,
  IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { TerminalView } from './TerminalView.tsx'
import { toggleBottomPanel, useWorkbenchUi } from './workbench-store.ts'

export type BottomPanelProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'codex-files'>

const MIN_TERMINAL_HEIGHT = 160
const DEFAULT_TERMINAL_HEIGHT = '42vh'
const MAX_TERMINAL_HEIGHT_RATIO = 0.78

/** The DSH three-column frame is the overlay slot's parent. */
function findLayoutFrame(): HTMLElement | null {
  const overlay = document.querySelector('[data-shell-overlay]')
  return overlay?.parentElement ?? null
}

export function BottomPanel({ useSessions, t }: BottomPanelProps) {
  const sessionId = useSessions(state => state.current)
  const cwd = useSessions(state => sessionId === undefined ? undefined : state.byId[sessionId]?.cwd)
  const { bottomPanelOpen } = useWorkbenchUi()
  const rootRef = useRef<HTMLDivElement>(null)
  const [terminalTabs, setTerminalTabs] = useState<string[]>(['bottom-terminal-1'])
  const [activeTab, setActiveTab] = useState('bottom-terminal-1')
  const [frame, setFrame] = useState<HTMLElement | null>(() => findLayoutFrame())
  const [heightPx, setHeightPx] = useState<number | null>(null)
  const nextTabNumber = useRef(1)
  const resizeRef = useRef<{ startY: number; startHeight: number; lastHeight?: number } | null>(null)
  const resizeFrameRef = useRef<number | null>(null)

  useEffect(() => {
    setTerminalTabs(['bottom-terminal-1'])
    setActiveTab('bottom-terminal-1')
  }, [sessionId])

  const closeTab = useCallback((tab: string) => {
    const next = terminalTabs.filter(item => item !== tab)
    setTerminalTabs(next)
    if (activeTab === tab) setActiveTab(next[0] ?? 'bottom-terminal-1')
  }, [activeTab, terminalTabs])

  const addTab = useCallback(() => {
    nextTabNumber.current += 1
    const id = `bottom-terminal-${nextTabNumber.current}`
    setTerminalTabs(tabs => [...tabs, id])
    setActiveTab(id)
  }, [])

  const beginResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const panel = rootRef.current
    if (panel === null || frame === null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const startHeight = panel.getBoundingClientRect().height
    frame.setAttribute('data-codex-files-bottom-panel-resizing', 'true')
    frame.style.setProperty('--cfx-bottom-panel-height', `${startHeight}px`)
    resizeRef.current = {
      startY: event.clientY,
      startHeight,
      lastHeight: startHeight,
    }
  }, [frame])

  const resizeTerminal = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current
    if (start === null || frame === null || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const frameHeight = frame.getBoundingClientRect().height
    const maxHeight = Math.max(MIN_TERMINAL_HEIGHT, Math.round(frameHeight * MAX_TERMINAL_HEIGHT_RATIO))
    const nextHeight = Math.min(maxHeight, Math.max(MIN_TERMINAL_HEIGHT, start.startHeight + start.startY - event.clientY))
    start.lastHeight = nextHeight
    if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
    resizeFrameRef.current = requestAnimationFrame(() => {
      frame.style.setProperty('--cfx-bottom-panel-height', `${nextHeight}px`)
      resizeFrameRef.current = null
    })
  }, [frame])

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = null
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const finishedHeight = resizeRef.current?.lastHeight ?? resizeRef.current?.startHeight
    if (finishedHeight !== undefined) setHeightPx(finishedHeight)
    if (frame !== null) frame.removeAttribute('data-codex-files-bottom-panel-resizing')
    resizeRef.current = null
  }, [frame])

  useEffect(() => () => {
    if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
    if (frame !== null) frame.removeAttribute('data-codex-files-bottom-panel-resizing')
  }, [frame])

  useLayoutEffect(() => {
    if (frame === null) {
      setFrame(findLayoutFrame())
      return
    }
    if (!bottomPanelOpen) return
    frame.setAttribute('data-codex-files-bottom-panel-open', 'true')
    return () => {
      frame.removeAttribute('data-codex-files-bottom-panel-open')
      frame.style.removeProperty('--cfx-bottom-panel-height')
    }
  }, [bottomPanelOpen, frame])

  useLayoutEffect(() => {
    if (frame === null || !bottomPanelOpen) return
    frame.style.setProperty('--cfx-bottom-panel-height', heightPx === null ? DEFAULT_TERMINAL_HEIGHT : `${heightPx}px`)
  }, [bottomPanelOpen, frame, heightPx])

  if (!bottomPanelOpen || sessionId === undefined) return null
  const panel = (
    <div ref={rootRef} className="cfx-bottom-panel" data-codex-files-bottom-panel>
      <div
        className="cfx-bottom-panel-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('panel.resizeBottom')}
        title={t('panel.resizeBottom')}
        onPointerDown={beginResize}
        onPointerMove={resizeTerminal}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <div className="cfx-bottom-panel-header">
        <div className="cfx-terminal-identity">
          <TerminalGlyph />
          <strong>{t('terminal.title')}</strong>
          {cwd !== undefined && cwd !== '' && <span title={cwd}>{cwd}</span>}
        </div>
        <div className="cfx-terminal-header-actions">
          <button
            type="button" className="cfx-terminal-action"
            aria-label={t('terminal.new')} title={t('terminal.new')}
            onClick={addTab}
          >
            <IconPlusOutline16 size={14} />
          </button>
          <button
            type="button" className="cfx-terminal-action"
            aria-label={t('panel.close')} title={t('panel.close')}
            onClick={toggleBottomPanel}
          >
            <IconCloseOutline16 size={14} />
          </button>
        </div>
      </div>
      {terminalTabs.length > 1 && (
        <nav className="cfx-terminal-session-rail" aria-label={t('terminal.sessions')}>
          <div className="cfx-terminal-session-rail-list">
            {terminalTabs.map((tab, index) => (
              <div
                key={tab}
                className={`cfx-terminal-session${activeTab === tab ? ' cfx-terminal-session-active' : ''}`}
              >
                <button
                  type="button"
                  className="cfx-terminal-session-select"
                  aria-current={activeTab === tab ? 'page' : undefined}
                  onClick={() => { setActiveTab(tab) }}
                >
                  <span
                    className={`cfx-terminal-session-status${activeTab === tab ? ' cfx-terminal-session-status-active' : ''}`}
                    aria-hidden
                  />
                  <span className="cfx-terminal-session-title">
                    {t('terminal.title')} {index + 1}
                  </span>
                </button>
                <button
                  type="button" className="cfx-terminal-session-close"
                  aria-label={t('file.close')} title={t('file.close')}
                  onClick={() => { closeTab(tab) }}
                >
                  <IconCloseOutline16 size={12} />
                </button>
              </div>
            ))}
          </div>
        </nav>
      )}
      <div className="cfx-bottom-panel-body">
        {terminalTabs.map(tab => (
          <div key={tab} className={`cfx-bottom-panel-terminal${activeTab === tab ? '' : ' cfx-bottom-panel-terminal-hidden'}`}>
            <TerminalView sessionId={sessionId} tabId={tab} t={t} />
          </div>
        ))}
      </div>
    </div>
  )
  return frame === null ? null : createPortal(panel, frame)
}

/** Compact terminal mark used by the bottom workbench header. */
function TerminalGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
      <path d="M2 3.5h12v6H2zM6 9.5v3M10 9.5v3M2.5 13.5h11"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
