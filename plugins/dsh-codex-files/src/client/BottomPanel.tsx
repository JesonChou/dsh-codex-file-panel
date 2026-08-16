/**
 * The Codex-style bottom panel. It renders through the shell.overlay slot for
 * framework discovery, but portals its DOM into the DSH three-column frame as
 * a true grid row (conversation + details width only), so opening it never
 * lifts or overlays the left sidebar.
 */
import {
  IconCloseOutline16,
  IconPanelLeftOutline16,
  IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TerminalView } from './TerminalView.tsx'
import { toggleBottomPanel, useWorkbenchUi } from './workbench-store.ts'

export type BottomPanelProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'codex-files'>

/** The DSH three-column frame is the overlay slot's parent. */
function findLayoutFrame(): HTMLElement | null {
  const overlay = document.querySelector('[data-shell-overlay]')
  return overlay?.parentElement ?? null
}

export function BottomPanel({ useSessions, t }: BottomPanelProps) {
  const sessionId = useSessions(state => state.current)
  const { bottomPanelOpen } = useWorkbenchUi()
  const rootRef = useRef<HTMLDivElement>(null)
  const [terminalTabs, setTerminalTabs] = useState<string[]>(['bottom-terminal-1'])
  const [activeTab, setActiveTab] = useState('bottom-terminal-1')
  const [frame, setFrame] = useState<HTMLElement | null>(() => findLayoutFrame())

  useEffect(() => {
    setTerminalTabs(['bottom-terminal-1'])
    setActiveTab('bottom-terminal-1')
  }, [sessionId])

  useLayoutEffect(() => {
    if (frame === null) {
      setFrame(findLayoutFrame())
      return
    }
    if (!bottomPanelOpen) return
    frame.setAttribute('data-codex-files-bottom-panel-open', 'true')
    frame.style.setProperty('--cfx-bottom-panel-height', '42vh')
    return () => {
      frame.removeAttribute('data-codex-files-bottom-panel-open')
      frame.style.removeProperty('--cfx-bottom-panel-height')
    }
  }, [bottomPanelOpen, frame])

  if (!bottomPanelOpen || sessionId === undefined) return null
  const nextNumber = terminalTabs.length + 1
  const panel = (
    <div ref={rootRef} className="cfx-bottom-panel" data-codex-files-bottom-panel>
      <div className="cfx-bottom-panel-header">
        <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
        <div className="cfx-bottom-panel-tabs" role="tablist">
          {terminalTabs.map((tab, index) => (
            <div key={tab} className={`cfx-bottom-panel-tab${activeTab === tab ? ' cfx-bottom-panel-tab-active' : ''}`}>
              <button type="button" role="tab" aria-selected={activeTab === tab} onClick={() => { setActiveTab(tab) }}>
                {t('terminal.title')} {index + 1}
              </button>
              {terminalTabs.length > 1 && (
                <button
                  type="button" className="cfx-bottom-panel-tab-close"
                  aria-label={t('file.close')} title={t('file.close')}
                  onClick={() => {
                    const next = terminalTabs.filter(item => item !== tab)
                    setTerminalTabs(next)
                    if (activeTab === tab) setActiveTab(next[0] ?? 'bottom-terminal-1')
                  }}
                >
                  <IconCloseOutline16 size={11} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button" className="cfx-icon-button"
            aria-label={t('terminal.new')} title={t('terminal.new')}
            onClick={() => {
              const id = `bottom-terminal-${nextNumber}`
              setTerminalTabs(tabs => [...tabs, id])
              setActiveTab(id)
            }}
          >
            <IconPlusOutline16 size={14} />
          </button>
        </div>
        <span className="cfx-spacer" />
        <button
          type="button" className="cfx-icon-button" aria-label={t('panel.close')} title={t('panel.close')}
          onClick={toggleBottomPanel}
        >
          <IconCloseOutline16 size={14} />
        </button>
      </div>
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
