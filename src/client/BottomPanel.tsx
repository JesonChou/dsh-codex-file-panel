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
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { TerminalView } from './TerminalView.tsx'
import {
  clampTerminalHeight, TERMINAL_CLOSE_THRESHOLD, TERMINAL_DEFAULT_HEIGHT,
  TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT_RATIO,
} from './workbench-layout.ts'
import { toggleBottomPanel, useWorkbenchUi } from './workbench-store.ts'

export type BottomPanelProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'codex-files'>

const TERMINAL_HEIGHT_KEY = 'dsh-codex-file-panel:bottom-panel-height:v1'

function readTerminalHeight(): number {
  if (typeof window === 'undefined' || window.localStorage === undefined) return TERMINAL_DEFAULT_HEIGHT
  const stored = Number.parseFloat(window.localStorage.getItem(TERMINAL_HEIGHT_KEY) ?? '')
  return Number.isFinite(stored) ? stored : TERMINAL_DEFAULT_HEIGHT
}

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
  const [heightPx, setHeightPx] = useState(readTerminalHeight)
  const nextTabNumber = useRef(1)
  const resizeRef = useRef<{ startY: number; startHeight: number; lastHeight?: number } | null>(null)
  const resizeFrameRef = useRef<number | null>(null)

  useEffect(() => {
    setTerminalTabs(['bottom-terminal-1'])
    setActiveTab('bottom-terminal-1')
  }, [sessionId])

  const closeTab = useCallback((tab: string) => {
    if (terminalTabs.length === 1) {
      setTerminalTabs(['bottom-terminal-1'])
      setActiveTab('bottom-terminal-1')
      nextTabNumber.current = 1
      toggleBottomPanel()
      return
    }
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
    const rawHeight = start.startHeight + start.startY - event.clientY
    if (rawHeight < TERMINAL_CLOSE_THRESHOLD) {
      resizeRef.current = null
      frame.removeAttribute('data-codex-files-bottom-panel-resizing')
      toggleBottomPanel()
      return
    }
    const nextHeight = clampTerminalHeight(rawHeight, frameHeight)
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
    if (finishedHeight !== undefined) {
      setHeightPx(finishedHeight)
      window.localStorage?.setItem(TERMINAL_HEIGHT_KEY, String(finishedHeight))
    }
    if (frame !== null) frame.removeAttribute('data-codex-files-bottom-panel-resizing')
    resizeRef.current = null
  }, [frame])

  const resetHeight = useCallback((): void => {
    const next = frame === null
      ? TERMINAL_DEFAULT_HEIGHT
      : clampTerminalHeight(TERMINAL_DEFAULT_HEIGHT, frame.getBoundingClientRect().height)
    setHeightPx(next)
    window.localStorage?.removeItem(TERMINAL_HEIGHT_KEY)
  }, [frame])

  const resizeWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (frame === null) return
    const maximum = Math.max(TERMINAL_MIN_HEIGHT, frame.getBoundingClientRect().height * TERMINAL_MAX_HEIGHT_RATIO)
    let next: number | null = null
    if (event.key === 'Home') next = TERMINAL_MIN_HEIGHT
    else if (event.key === 'End') next = maximum
    else if (event.key === 'ArrowUp') next = heightPx + 10
    else if (event.key === 'ArrowDown') next = heightPx - 10
    if (next === null) return
    event.preventDefault()
    const clamped = clampTerminalHeight(next, frame.getBoundingClientRect().height)
    setHeightPx(clamped)
    window.localStorage?.setItem(TERMINAL_HEIGHT_KEY, String(clamped))
  }, [frame, heightPx])

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
    const clamped = clampTerminalHeight(heightPx, frame.getBoundingClientRect().height)
    frame.style.setProperty('--cfx-bottom-panel-height', `${clamped}px`)
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
        aria-valuemin={TERMINAL_MIN_HEIGHT}
        aria-valuemax={frame === null ? undefined : Math.round(Math.max(TERMINAL_MIN_HEIGHT, frame.getBoundingClientRect().height * TERMINAL_MAX_HEIGHT_RATIO))}
        aria-valuenow={Math.round(heightPx)}
        tabIndex={0}
        onDoubleClick={resetHeight}
        onKeyDown={resizeWithKeyboard}
        onPointerDown={beginResize}
        onPointerMove={resizeTerminal}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
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
                    aria-hidden><TerminalGlyph /></span>
                  <span className="cfx-terminal-session-title">
                    {cwd !== undefined && cwd !== '' ? cwd : `${t('terminal.title')} ${index + 1}`}
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
            <button
              type="button" className="cfx-terminal-tab-add"
              aria-label={t('terminal.new')} title={t('terminal.new')}
              onClick={addTab}
            >
              <IconPlusOutline16 size={14} />
            </button>
          </div>
          <button
            type="button" className="cfx-terminal-panel-close"
            aria-label={t('panel.close')} title={t('panel.close')}
            onClick={toggleBottomPanel}
          >
            <IconCloseOutline16 size={14} />
          </button>
      </nav>
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
      <rect x="1.8" y="2.5" width="12.4" height="10.5" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="m4.2 5.2 2 1.7-2 1.7M8 9.1h3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
