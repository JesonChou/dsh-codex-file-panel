import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkbenchLauncher } from '../src/client/WorkbenchLauncher.tsx'
import {
  closeBottomPanel, setPanelExpanded, setWorkbenchView,
} from '../src/client/workbench-store.ts'

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
}

const t = ((key: string) => key) as never

function rect(width: number, height: number): DOMRect {
  return { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) }
}

function renderBridge() {
  const frame = document.createElement('div')
  frame.setAttribute('data-details-collapsed', '')
  frame.style.gridTemplateColumns = '280px minmax(0, 1fr) 0px'
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(rect(1600, 900))
  const sidebar = document.createElement('div')
  vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue(rect(280, 900))
  const center = document.createElement('div')
  const details = document.createElement('div')
  const overlay = document.createElement('div')
  overlay.setAttribute('data-shell-overlay', '')
  frame.append(sidebar, center, details, overlay)
  document.body.appendChild(frame)
  const openDetails = vi.fn()
  const result = render(
    <WorkbenchLauncher openDetails={openDetails} t={t} useSessions={vi.fn() as never} useWorkspaces={vi.fn() as never} />,
    { container: overlay },
  )
  return { ...result, frame, openDetails }
}

afterEach(() => {
  cleanup()
  closeBottomPanel()
  setPanelExpanded(false)
  setWorkbenchView('new-tab')
  window.localStorage.clear()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('WorkbenchLauncher shell bridge', () => {
  it('reserves no launcher or right-side canvas after the workbench closes', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { frame } = renderBridge()
    await waitFor(() => { expect(frame.getAttribute('data-codex-files-frame')).toBe('true') })
    expect(frame.querySelector('.cfx-launcher-overlay')).toBeNull()
    expect(frame.querySelector('button')).toBeNull()
  })

  it('tracks the host sidebar intent and recomputes right-panel geometry', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { frame } = renderBridge()
    await waitFor(() => { expect(frame.style.getPropertyValue('--cfx-sidebar-width')).toBe('280px') })
    const firstRightWidth = frame.style.getPropertyValue('--cfx-right-panel-width')

    frame.style.gridTemplateColumns = '56px minmax(0, 1fr) 0px'
    frame.setAttribute('data-sidebar-collapsed', '')

    await waitFor(() => { expect(frame.style.getPropertyValue('--cfx-sidebar-width')).toBe('56px') })
    expect(frame.style.getPropertyValue('--cfx-right-panel-width')).not.toBe(firstRightWidth)
  })

  it('opens workbench views from Codex shortcuts without needing a fake launcher', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { openDetails } = renderBridge()

    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(openDetails).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(openDetails).toHaveBeenCalledTimes(3)
  })
})
