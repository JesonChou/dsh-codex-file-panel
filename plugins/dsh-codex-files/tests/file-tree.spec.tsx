/**
 * FileTree component tests (jsdom + testing-library): the tree must render
 * the loaded root listing instead of staying on the loading row, expand
 * directories on demand, surface search results, and open files — the
 * regression test for the endless "loading" loop.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileTree, LIST_RETRIES, LIST_RETRY_DELAY_MS,
} from '../src/client/FileTree.tsx'
import type { ListDirResult } from '../src/client/api.ts'

const listDirMock = vi.hoisted(() => vi.fn())
const findFilesMock = vi.hoisted(() => vi.fn())

vi.mock('../src/client/api.ts', () => ({
  listDir: listDirMock,
  findFiles: findFilesMock,
}))

const t = ((key: string) => key) as never

function treeProps(overrides: Partial<Parameters<typeof FileTree>[0]> = {}) {
  return {
    sessionId: 's1',
    status: {},
    onOpenFile: vi.fn(),
    t,
    ...overrides,
  } as Parameters<typeof FileTree>[0]
}

afterEach(() => {
  cleanup()
  listDirMock.mockReset()
  findFilesMock.mockReset()
})

describe('FileTree', () => {
  it('renders the root listing after load instead of staying on loading', async () => {
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [
      { name: 'src', dir: true },
      { name: 'package.json', dir: false },
    ] } satisfies ListDirResult)
    render(<FileTree {...treeProps()} />)
    expect(screen.getByText('file.loading')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('src')).toBeTruthy()
      expect(screen.getByText('package.json')).toBeTruthy()
    })
    expect(screen.queryByText('file.loading')).toBeNull()
  })

  it('loads a directory once when expanded, reusing the cache', async () => {
    listDirMock.mockResolvedValueOnce({ ok: true, path: '', entries: [{ name: 'src', dir: true }] } satisfies ListDirResult)
      .mockResolvedValueOnce({ ok: true, path: 'src', entries: [{ name: 'a.ts', dir: false }] } satisfies ListDirResult)
    render(<FileTree {...treeProps()} />)
    await waitFor(() => { expect(screen.getByText('src')).toBeTruthy() })
    fireEvent.click(screen.getByText('src'))
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    // Collapse and re-expand: no second fetch for the cached listing.
    fireEvent.click(screen.getByText('src'))
    fireEvent.click(screen.getByText('src'))
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    expect(listDirMock).toHaveBeenCalledTimes(2)
  })

  it('opens a file through the injected callback', async () => {
    const onOpenFile = vi.fn()
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [{ name: 'x.ts', dir: false }] } satisfies ListDirResult)
    render(<FileTree {...treeProps({ onOpenFile })} />)
    await waitFor(() => { expect(screen.getByText('x.ts')).toBeTruthy() })
    fireEvent.click(screen.getByText('x.ts'))
    expect(onOpenFile).toHaveBeenCalledWith('x.ts')
  })

  it('supports Codex-style arrow and Enter keyboard navigation', async () => {
    const onOpenFile = vi.fn()
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [
      { name: 'src', dir: true },
      { name: 'package.json', dir: false },
    ] } satisfies ListDirResult)
    render(<FileTree {...treeProps({ onOpenFile })} />)
    await waitFor(() => { expect(screen.getByText('package.json')).toBeTruthy() })
    const tree = screen.getByRole('tree')
    fireEvent.focus(tree)
    await waitFor(() => { expect(screen.getByText('src').closest('button')?.getAttribute('aria-current')).toBe('true') })
    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    await waitFor(() => { expect(screen.getByText('package.json').closest('button')?.getAttribute('aria-current')).toBe('true') })
    fireEvent.keyDown(tree, { key: 'Enter' })
    expect(onOpenFile).toHaveBeenCalledWith('package.json')
  })

  it('shows flat search results after the debounce', async () => {
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [] } satisfies ListDirResult)
    findFilesMock.mockResolvedValue({ ok: true, matches: ['src/client/index.tsx'] })
    render(<FileTree {...treeProps()} />)
    await waitFor(() => { expect(screen.queryByText('file.loading')).toBeNull() })
    fireEvent.change(screen.getByLabelText('tree.search'), { target: { value: 'index' } })
    await waitFor(() => { expect(screen.getByText('src/client/index.tsx')).toBeTruthy() }, { timeout: 3000 })
    expect(findFilesMock).toHaveBeenCalledWith('s1', 'index')
  })

  it('decorates files with their git status letter', async () => {
    listDirMock.mockResolvedValue({ ok: true, path: '', entries: [{ name: 'm.ts', dir: false }] } satisfies ListDirResult)
    render(<FileTree {...treeProps({ status: { 'm.ts': 'M' } })} />)
    await waitFor(() => { expect(screen.getByText('m.ts')).toBeTruthy() })
    expect(screen.getByText('M')).toBeTruthy()
  })

  it('retries a failed root listing (session-registration race) and recovers', async () => {
    listDirMock
      .mockResolvedValueOnce({ ok: false, code: 'session-not-found' })
      .mockResolvedValueOnce({ ok: true, path: '', entries: [{ name: 'recovered.ts', dir: false }] } satisfies ListDirResult)
    vi.useFakeTimers()
    try {
      render(<FileTree {...treeProps()} />)
      // First attempt fails; the tree stays on loading while the retry timer runs.
      await vi.advanceTimersByTimeAsync(1)
      expect(listDirMock).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('recovered.ts')).toBeNull()
      // Advance past the retry delay: the second attempt succeeds and renders.
      await vi.advanceTimersByTimeAsync(LIST_RETRY_DELAY_MS + 50)
      expect(listDirMock).toHaveBeenCalledTimes(2)
      expect(screen.getByText('recovered.ts')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows an error row with a retry button after all attempts fail', async () => {
    listDirMock.mockResolvedValue({ ok: false, code: 'session-not-found' })
    vi.useFakeTimers()
    try {
      render(<FileTree {...treeProps()} />)
      // Run every retry timer through: initial + LIST_RETRIES retries.
      for (let round = 1; round <= LIST_RETRIES; round++) {
        await vi.advanceTimersByTimeAsync(LIST_RETRY_DELAY_MS * round + 50)
      }
      expect(screen.getByText('tree.listFailed')).toBeTruthy()
      // The manual retry clears the error and refetches.
      fireEvent.click(screen.getByText('file.reload'))
      await vi.advanceTimersByTimeAsync(1)
      expect(listDirMock.mock.calls.length).toBeGreaterThan(LIST_RETRIES + 1)
    } finally {
      vi.useRealTimers()
    }
  })
})
