/**
 * The Codex-style bottom panel, mounted through the shell.overlay slot so it
 * spans the app instead of living inside the right details column. Today it
 * hosts one terminal; the right-side header button toggles it.
 */
import {
  IconCloseOutline16,
  IconPanelLeftOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useLayoutEffect, useRef } from 'react'
import { TerminalView } from './TerminalView.tsx'
import { toggleBottomPanel, useWorkbenchUi } from './workbench-store.ts'

export type BottomPanelProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'codex-files'>

export function BottomPanel({ useSessions, t }: BottomPanelProps) {
  const sessionId = useSessions(state => state.current)
  const { bottomPanelOpen } = useWorkbenchUi()
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const frame = rootRef.current?.closest('[data-shell-overlay]')?.parentElement ?? null
    if (frame === null || !bottomPanelOpen) return
    frame.setAttribute('data-codex-files-bottom-panel-open', 'true')
    frame.style.setProperty('--cfx-bottom-panel-height', '42vh')
    const updateSidebarWidth = (): void => {
      const sidebar = frame.firstElementChild as HTMLElement | null
      frame.style.setProperty('--cfx-layout-sidebar-width', `${sidebar?.getBoundingClientRect().width ?? 0}px`)
    }
    updateSidebarWidth()
    const observer = new ResizeObserver(updateSidebarWidth)
    if (frame.firstElementChild instanceof Element) observer.observe(frame.firstElementChild)
    window.addEventListener('resize', updateSidebarWidth)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSidebarWidth)
      frame.removeAttribute('data-codex-files-bottom-panel-open')
      frame.style.removeProperty('--cfx-bottom-panel-height')
      frame.style.removeProperty('--cfx-layout-sidebar-width')
    }
  }, [bottomPanelOpen])

  if (!bottomPanelOpen || sessionId === undefined) return null
  return (
    <div ref={rootRef} className="cfx-bottom-panel" data-codex-files-bottom-panel>
      <div className="cfx-bottom-panel-header">
        <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
        <span className="cfx-bottom-panel-title">{t('terminal.title')}</span>
        <span className="cfx-spacer" />
        <button
          type="button" className="cfx-icon-button" aria-label={t('panel.close')} title={t('panel.close')}
          onClick={toggleBottomPanel}
        >
          <IconCloseOutline16 size={14} />
        </button>
      </div>
      <TerminalView sessionId={sessionId} tabId="bottom-terminal" t={t} />
    </div>
  )
}
