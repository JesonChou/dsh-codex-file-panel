import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PinnedSummary } from '../src/client/PinnedSummary.tsx'
import { setWorkbenchView } from '../src/client/workbench-store.ts'

const gitInfoMock = vi.hoisted(() => vi.fn())
const writeClipboardMock = vi.hoisted(() => vi.fn())

vi.mock('../src/client/api.ts', () => ({ gitInfo: gitInfoMock }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ writeClipboard: writeClipboardMock }))

const t = ((key: string) => key) as never
const snapshot = { chat: { nodes: new Map() } }
const sessions = { byId: { s1: { cwd: 'C:/work/project' } } }

function renderSummary() {
  const frame = document.createElement('div')
  frame.setAttribute('data-details-collapsed', '')
  const overlay = document.createElement('div')
  overlay.setAttribute('data-shell-overlay', '')
  frame.append(document.createElement('div'), document.createElement('div'), document.createElement('div'), overlay)
  const header = document.createElement('div')
  document.body.append(frame, header)
  const openDetails = vi.fn()
  const result = render(
    <PinnedSummary
      sessionId="s1"
      useSession={((selector: (state: unknown) => unknown) => selector(snapshot)) as never}
      useSessions={((selector: (state: unknown) => unknown) => selector(sessions)) as never}
      openDetails={openDetails}
      t={t}
    />,
    { container: header },
  )
  return { ...result, frame, openDetails }
}

afterEach(() => {
  cleanup()
  gitInfoMock.mockReset()
  writeClipboardMock.mockReset()
  setWorkbenchView('new-tab')
  document.body.replaceChildren()
})

describe('PinnedSummary', () => {
  it('pins Codex environment actions only while the right workbench is closed', async () => {
    gitInfoMock.mockResolvedValue({ ok: true, branch: 'main', repo: 'project', status: { 'a.ts': 'M' } })
    const { frame, openDetails } = renderSummary()

    expect(await screen.findByLabelText('summary.environment')).toBeTruthy()
    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByText('summary.prUnavailable')).toBeTruthy()

    fireEvent.click(screen.getByText('summary.changes'))
    expect(openDetails).toHaveBeenCalledTimes(1)

    frame.removeAttribute('data-details-collapsed')
    await waitFor(() => { expect(screen.queryByLabelText('summary.environment')).toBeNull() })
  })
})
