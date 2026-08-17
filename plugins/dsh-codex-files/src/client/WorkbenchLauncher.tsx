import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
import { parseSidebarWidth } from './workbench-layout.ts'
import {
  setWorkbenchView,
  toggleBottomPanel,
  updateWorkbenchGeometry,
  useWorkbenchUi,
  type WorkbenchView,
} from './workbench-store.ts'

export interface WorkbenchLauncherInjected {
  openDetails: () => void
}

export type WorkbenchLauncherProps =
  PropsRuntime<'shell.overlay'> & WorkbenchLauncherInjected & PropsLocale<'codex-files'>

function setCssPixel(frame: HTMLElement, name: string, value: number): void {
  const next = `${Math.max(0, value)}px`
  if (frame.style.getPropertyValue(name) !== next) frame.style.setProperty(name, next)
}

/**
 * Non-visual shell bridge. Codex renders its launcher only inside an already
 * open, empty right panel; closing the panel unmounts that surface completely.
 * This component therefore owns geometry and shortcuts only.
 */
export function WorkbenchLauncher({ openDetails }: WorkbenchLauncherProps) {
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const {
    sidebarWidth, rightPanelWidth, summaryDisplayMode, summaryPinned,
    summaryPopoverOpen,
  } = useWorkbenchUi()

  useEffect(() => {
    const nextFrame = document.querySelector<HTMLElement>('[data-shell-overlay]')?.parentElement ?? null
    if (nextFrame === null) return
    setFrame(nextFrame)
    nextFrame.setAttribute('data-codex-files-frame', 'true')

    const updateGeometry = (): void => {
      const bounds = nextFrame.getBoundingClientRect()
      const sidebar = nextFrame.firstElementChild as HTMLElement | null
      const measuredSidebar = sidebar?.getBoundingClientRect().width ?? 0
      const intendedSidebar = parseSidebarWidth(nextFrame.style.gridTemplateColumns, measuredSidebar)
      updateWorkbenchGeometry({
        frameWidth: bounds.width,
        shellHeight: bounds.height,
        sidebarWidth: intendedSidebar,
        rightPanelOpen: !nextFrame.hasAttribute('data-details-collapsed'),
        panelExpanded: nextFrame.hasAttribute('data-codex-files-layout-expanded'),
      })
    }

    updateGeometry()
    const mutation = new MutationObserver(updateGeometry)
    mutation.observe(nextFrame, {
      attributes: true,
      attributeFilter: [
        'data-details-collapsed',
        'data-sidebar-collapsed',
        'data-codex-files-layout-expanded',
        'style',
      ],
    })
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateGeometry)
    resize?.observe(nextFrame)

    return () => {
      mutation.disconnect()
      resize?.disconnect()
      nextFrame.removeAttribute('data-codex-files-frame')
      nextFrame.removeAttribute('data-codex-files-summary-mode')
      nextFrame.removeAttribute('data-codex-files-summary-visible')
      nextFrame.style.removeProperty('--cfx-sidebar-width')
      nextFrame.style.removeProperty('--cfx-right-panel-width')
      setFrame(null)
    }
  }, [])

  useEffect(() => {
    if (frame === null) return
    setCssPixel(frame, '--cfx-sidebar-width', sidebarWidth)
    setCssPixel(frame, '--cfx-right-panel-width', rightPanelWidth)
    frame.setAttribute('data-codex-files-summary-mode', summaryDisplayMode)
    const summaryVisible = summaryDisplayMode === 'overlay' ? summaryPopoverOpen : summaryPinned
    frame.toggleAttribute('data-codex-files-summary-visible', summaryVisible)
  }, [frame, rightPanelWidth, sidebarWidth, summaryDisplayMode, summaryPinned, summaryPopoverOpen])

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
      } else if (event.key === '`' || event.key.toLowerCase() === 'j') {
        event.preventDefault()
        toggleBottomPanel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [openDetails])

  return null
}
