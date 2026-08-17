import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BrowserView, createBrowserTab, normalizeBrowserUrl, type BrowserTab } from '../src/client/BrowserView.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Icon = () => <span aria-hidden />
  return {
    IconChevronLeftOutline14: Icon,
    IconChevronRightOutline14: Icon,
    IconLinkOutline14: Icon,
    IconRefreshOutline14: Icon,
    IconRightUpOutline16: Icon,
  }
})

const t = ((key: string) => key) as never

function TestBrowserView(props: { visible?: boolean } = {}) {
  const [tabs, setTabs] = useState<BrowserTab[]>([createBrowserTab(1)])
  const [activeTabId, setActiveTabId] = useState(1)
  return <BrowserView t={t} tabs={tabs} activeTabId={activeTabId} onTabsChange={setTabs} onActiveTabChange={setActiveTabId} visible={props.visible} showTabs />
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('normalizeBrowserUrl', () => {
  it('normalizes a public host and rejects the GUI origin', () => {
    expect(normalizeBrowserUrl('www.deepseek.com', 'https://dsh.example')).toEqual({
      ok: true,
      url: 'https://www.deepseek.com/',
    })
    expect(normalizeBrowserUrl('https://dsh.example/settings', 'https://dsh.example')).toEqual({
      ok: false,
      reason: 'loopback',
    })
  })
})

describe('BrowserView', () => {
  it('keeps the remote frame sandboxed while preserving its origin for resource loading', () => {
    const { container, getByRole } = render(<TestBrowserView />)
    const input = getByRole('textbox')

    fireEvent.change(input, { target: { value: 'https://www.deepseek.com/' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const frame = container.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame?.getAttribute('sandbox')?.split(/\s+/)).toContain('allow-same-origin')
    expect(frame?.getAttribute('sandbox')?.split(/\s+/)).toContain('allow-scripts')
    expect(frame?.getAttribute('sandbox')?.split(/\s+/)).not.toContain('allow-top-navigation')
    expect(frame?.getAttribute('allow')).toContain('clipboard-read')
    expect(frame?.getAttribute('allow')).toContain('fullscreen')
  })

  it('opens host new-window requests as an internal browser tab', async () => {
    const { getByRole, getAllByRole } = render(<TestBrowserView />)

    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'dsh-browser-new-window', url: 'https://chat.deepseek.com/sign_in' },
    }))

    await waitFor(() => expect(getAllByRole('tab')).toHaveLength(2))
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('https://chat.deepseek.com/sign_in')
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('https://chat.deepseek.com/sign_in')
  })

  it('asks the desktop host to close the native page when a tab is closed', async () => {
    const postMessage = vi.fn()
    const bridge = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage,
    }
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: bridge } })

    const { getByRole } = render(<TestBrowserView />)
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.bilibili.com/' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dsh-browser-native-tab',
      url: 'https://www.bilibili.com/',
    })))

    fireEvent.click(getByRole('button', { name: 'browser.closeTab' }))
    expect(postMessage).toHaveBeenCalledWith({ type: 'dsh-browser-native-tab-close', tabId: 1 })
  })

  it('closes every native page when the browser view is unmounted', async () => {
    const postMessage = vi.fn()
    const bridge = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage,
    }
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: bridge } })

    const { getByRole, unmount } = render(<TestBrowserView />)
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.bilibili.com/' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    unmount()
    expect(postMessage).toHaveBeenCalledWith({ type: 'dsh-browser-native-tab-close', tabId: 1 })
    expect(postMessage).toHaveBeenCalledWith({ type: 'dsh-browser-native-tab-active', tabId: null })
  })

  it('detaches the native page when another workbench view is active without closing it', async () => {
    const postMessage = vi.fn()
    const bridge = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage,
    }
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: bridge } })

    const { getByRole, rerender } = render(<TestBrowserView visible />)
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.bilibili.com/' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dsh-browser-native-tab',
      url: 'https://www.bilibili.com/',
    })))

    rerender(<TestBrowserView visible={false} />)
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'dsh-browser-native-tab-active', tabId: null }))
    expect(postMessage.mock.calls.some(([message]) => message?.type === 'dsh-browser-native-tab-close')).toBe(false)
  })
})
