/**
 * Panel open-path tests (jsdom + testing-library): opening a binary preview
 * kind (PDF, media, Office, EPUB) must NOT call the text read route — the
 * previewer fetches its own bytes through /raw. The regression: the read
 * route answered `binary-file` and the panel showed the "binary, cannot
 * preview" error instead of the preview. Text files still load through the
 * read route as before.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexFilesPanel, type CodexFilesPanelProps } from '../src/client/CodexFilesPanel.tsx'
import type { ListDirResult } from '../src/client/api.ts'

const listDirMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const gitInfoMock = vi.hoisted(() => vi.fn())

vi.mock('../src/client/api.ts', () => ({
  listDir: listDirMock,
  readFile: readFileMock,
  writeFile: writeFileMock,
  gitInfo: gitInfoMock,
}))

// The linked dsh-client-ui-primitives drags a deep dependency tree (katex,
// shiki, anser, …) that this project does not install. The panel tests only
// assert routing and open behavior, so stub the visual primitives.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const icon = (): JSX.Element => <span data-testid="cfx-icon" />
  return {
    IconBrowseOutline16: icon,
    IconCheckOutline16: icon,
    IconChevronLeftOutline14: icon,
    IconCloseOutline16: icon,
    IconCodeOutline16: icon,
    IconCopyOutline16: icon,
    IconEditOutline16: icon,
    IconPanelLeftOutline16: icon,
    IconFullscreenOutline16: icon,
    IconRefreshOutline16: icon,
    IconRefreshOutline14: icon,
    IconChevronRightOutline14: icon,
    IconLinkOutline14: icon,
    IconRightUpOutline16: icon,
    DiffBlock: (): JSX.Element => <div data-testid="cfx-diff" />,
    writeClipboard: (): void => {},
    MarkdownText: ({ text }: { text: string }): JSX.Element => <div>{text}</div>,
    ReadBlock: ({ lines }: { lines: readonly { text: string }[] }): JSX.Element => (
      <div>{lines.map(line => line.text).join('\n')}</div>
    ),
  }
})

/** jsdom has no ResizeObserver; PdfPreview uses one to fit page width. */
class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

const t = ((key: string) => key) as never

const snapshot = { chat: { nodes: new Map() } }
const sessions = { byId: { s1: { cwd: 'C:/work' } } }

function panelProps(): CodexFilesPanelProps {
  return {
    sessionId: 's1',
    useSession: ((selector: (state: unknown) => unknown) => selector(snapshot)) as never,
    useSessions: ((selector: (state: unknown) => unknown) => selector(sessions)) as never,
    closeDetails: vi.fn(),
    toggleSidebar: vi.fn(),
    openPath: vi.fn(),
    t,
  }
}

afterEach(() => {
  cleanup()
  listDirMock.mockReset()
  readFileMock.mockReset()
  writeFileMock.mockReset()
  gitInfoMock.mockReset()
  vi.unstubAllGlobals()
})

describe('CodexFilesPanel open path', () => {
  it('opens a PDF without the text read route and renders the previewer instead of the binary error', async () => {
    gitInfoMock.mockResolvedValue({ ok: true, branch: null, repo: 'work', status: {} })
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [
      { name: 'a.pdf', dir: false },
    ] } satisfies ListDirResult)
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)

    render(<CodexFilesPanel {...panelProps()} />)
    await waitFor(() => { expect(screen.getByText('a.pdf')).toBeTruthy() })
    fireEvent.click(screen.getByText('a.pdf'))

    // The previewer mounts and starts its own /raw fetch; the text read
    // route is never consulted, and the binary error never appears.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock.mock.calls[0]?.[0]).toContain('/plugins/dsh-codex-files/raw?')
    })
    expect(readFileMock).not.toHaveBeenCalled()
    expect(screen.queryByText('file.binary')).toBeNull()
    // With the fetch failing, the previewer lands on its render-failed state.
    expect(await screen.findByText('file.pdfFailed')).toBeTruthy()
  })

  it('still loads text files through the read route', async () => {
    gitInfoMock.mockResolvedValue({ ok: true, branch: null, repo: 'work', status: {} })
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [
      { name: 'b.ts', dir: false },
    ] } satisfies ListDirResult)
    readFileMock.mockResolvedValue({ ok: true, content: 'const x = 1', size: 12, mtime: 1 })

    render(<CodexFilesPanel {...panelProps()} />)
    await waitFor(() => { expect(screen.getByText('b.ts')).toBeTruthy() })
    fireEvent.click(screen.getByText('b.ts'))

    await waitFor(() => { expect(readFileMock).toHaveBeenCalledWith('s1', 'b.ts') })
    expect(await screen.findByText('const x = 1')).toBeTruthy()
    expect(screen.queryByText('file.binary')).toBeNull()
  })
})
