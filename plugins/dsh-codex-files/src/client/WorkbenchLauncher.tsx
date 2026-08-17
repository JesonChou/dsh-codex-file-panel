import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
import {
  setWorkbenchView, toggleBottomPanel, useWorkbenchUi, type WorkbenchView,
} from './workbench-store.ts'

export interface WorkbenchLauncherInjected {
  openDetails: () => void
}

export type WorkbenchLauncherProps =
  PropsRuntime<'shell.overlay'> & WorkbenchLauncherInjected & PropsLocale<'codex-files'>

function isDetailsClosed(): boolean {
  return document.querySelector('[data-details-collapsed]') !== null
}

function shortcutLabel(key: string): string {
  return navigator.platform.toLowerCase().includes('mac') ? key.replace('Ctrl', '⌘') : key
}

export function WorkbenchLauncher({ openDetails, t }: WorkbenchLauncherProps) {
  const [collapsed, setCollapsed] = useState(() => isDetailsClosed())
  const { bottomPanelOpen } = useWorkbenchUi()

  useEffect(() => {
    const frame = document.querySelector<HTMLElement>('[data-shell-overlay]')?.parentElement ?? null
    if (frame === null) return
    frame.setAttribute('data-codex-files-frame', 'true')
    const sidebar = frame.firstElementChild as HTMLElement | null
    const updateGeometry = (): void => {
      const width = sidebar?.getBoundingClientRect().width ?? 0
      frame.style.setProperty('--cfx-sidebar-width', `${width}px`)
      setCollapsed(frame.hasAttribute('data-details-collapsed'))
    }
    updateGeometry()
    const mutation = new MutationObserver(updateGeometry)
    mutation.observe(frame, { attributes: true, attributeFilter: ['data-details-collapsed', 'data-sidebar-collapsed'] })
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateGeometry)
    if (sidebar !== null) resize?.observe(sidebar)
    return () => {
      mutation.disconnect()
      resize?.disconnect()
      frame.removeAttribute('data-codex-files-frame')
      frame.style.removeProperty('--cfx-sidebar-width')
    }
  }, [])

  useEffect(() => {
    const open = (view: WorkbenchView): void => {
      setWorkbenchView(view)
      openDetails()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        open('files')
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        open('browser')
      } else if (event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        open('review')
      } else if (event.key === '`') {
        event.preventDefault()
        toggleBottomPanel()
      } else if (event.key.toLowerCase() === 'j') {
        event.preventDefault()
        toggleBottomPanel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [openDetails])

  if (!collapsed) return null

  const open = (view: WorkbenchView): void => {
    setWorkbenchView(view)
    openDetails()
  }

  return (
    <nav className="cfx-launcher-overlay" aria-label={t('panel.tools')}>
      <LauncherButton icon="review" label={t('review.title')} shortcut={shortcutLabel('Ctrl+Shift+G')} onClick={() => { open('review') }} />
      <LauncherButton icon="terminal" label={t('terminal.title')} shortcut={shortcutLabel('Ctrl+`')} active={bottomPanelOpen} onClick={toggleBottomPanel} />
      <LauncherButton icon="browser" label={t('browser.title')} shortcut={shortcutLabel('Ctrl+T')} onClick={() => { open('browser') }} />
      <LauncherButton icon="files" label={t('panel.title')} shortcut={shortcutLabel('Ctrl+P')} onClick={() => { open('files') }} />
    </nav>
  )
}

function LauncherButton({ icon, label, shortcut, active = false, onClick }: {
  icon: 'review' | 'terminal' | 'browser' | 'files'
  label: string
  shortcut: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`cfx-launcher-action${active ? ' cfx-launcher-action-active' : ''}`}
      aria-keyshortcuts={shortcut.replaceAll('+', ' ')}
      onClick={onClick}
    >
      <LauncherGlyph kind={icon} />
      <span>{label}</span>
      <kbd>{shortcut}</kbd>
    </button>
  )
}

function LauncherGlyph({ kind }: { kind: 'review' | 'terminal' | 'browser' | 'files' }) {
  if (kind === 'terminal') return <svg viewBox="0 0 16 16" aria-hidden><rect x="1.8" y="2.5" width="12.4" height="9" rx="1.7" fill="none" stroke="currentColor"/><path d="m4.3 5 2 1.7-2 1.7M8 9h3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (kind === 'browser') return <svg viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor"/><path d="M2.4 8h11.2M8 2c1.6 1.7 2.4 3.7 2.4 6S9.6 12.3 8 14M8 2C6.4 3.7 5.6 5.7 5.6 8s.8 4.3 2.4 6" fill="none" stroke="currentColor"/></svg>
  if (kind === 'files') return <svg viewBox="0 0 16 16" aria-hidden><path d="M1.8 4.5h4l1.3 1.4h7.1v6.4a1.5 1.5 0 0 1-1.5 1.5H3.3a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" strokeLinejoin="round"/><path d="M1.8 5V3.7c0-.8.7-1.5 1.5-1.5h3l1.2 1.4h5.2c.8 0 1.5.7 1.5 1.5v.8" fill="none" stroke="currentColor"/></svg>
  return <svg viewBox="0 0 16 16" aria-hidden><rect x="2" y="1.8" width="12" height="12.4" rx="2" fill="none" stroke="currentColor"/><path d="M5 5h6M5 8h6M5 11h3" fill="none" stroke="currentColor" strokeLinecap="round"/></svg>
}
