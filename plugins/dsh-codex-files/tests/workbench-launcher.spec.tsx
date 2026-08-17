import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkbenchLauncher } from '../src/client/WorkbenchLauncher.tsx'
import { closeBottomPanel, setWorkbenchView } from '../src/client/workbench-store.ts'

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
}

const t = ((key: string) => key) as never

function renderLauncher() {
  const frame = document.createElement('div')
  frame.setAttribute('data-details-collapsed', '')
  const sidebar = document.createElement('div')
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
  setWorkbenchView('new-tab')
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('WorkbenchLauncher', () => {
  it('shows the native Codex action order while the right workbench is closed', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    renderLauncher()
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual([
      'review.titleCtrl+Shift+G',
      'terminal.titleCtrl+`',
      'browser.titleCtrl+T',
      'panel.titleCtrl+P',
    ])
  })

  it('opens workbench views and honors Codex keyboard shortcuts', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { openDetails } = renderLauncher()

    fireEvent.click(screen.getByText('review.title'))
    expect(openDetails).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    expect(openDetails).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    expect(openDetails).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(openDetails).toHaveBeenCalledTimes(4)
  })

  it('toggles the bottom terminal without opening the right workbench', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { openDetails } = renderLauncher()
    const terminal = screen.getByText('terminal.title').closest('button')
    expect(terminal).not.toBeNull()
    fireEvent.click(terminal!)
    expect(terminal?.className).toContain('cfx-launcher-action-active')
    expect(openDetails).not.toHaveBeenCalled()
  })
})
