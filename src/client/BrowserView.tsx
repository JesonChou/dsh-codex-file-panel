/**
 * Codex-style embedded browser content. Browser tabs are owned by the
 * workbench so that every page is a peer in the native tab strip; this
 * component only renders the active page and its navigation controls.
 */
import { useEffect, useRef, useState } from 'react'
import {
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconLinkOutline14,
  IconRefreshOutline14,
  IconRightUpOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

const IFRAME_SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-downloads',
  'allow-modals',
  'allow-popups-to-escape-sandbox',
].join(' ')

/** Browser features that sites commonly need for a complete embedded UI. */
const IFRAME_ALLOW = 'autoplay; clipboard-read; clipboard-write; fullscreen; picture-in-picture'

export interface BrowserTab {
  id: number
  url: string | null
  history: string[]
  cursor: number
  reloadKey: number
}

export function closeNativeBrowserTab(tabId: number): void {
  getWebViewBridge()?.postMessage({ type: 'dsh-browser-native-tab-close', tabId })
}

export function createBrowserTab(id: number, url: string | null = null): BrowserTab {
  return {
    id,
    url,
    history: url === null ? [] : [url],
    cursor: url === null ? -1 : 0,
    reloadKey: 0,
  }
}

interface UrlResult {
  ok: boolean
  url?: string
  reason?: 'invalid' | 'scheme' | 'loopback'
}

interface WebViewBridge {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
  postMessage(message: unknown): void
}

interface NativeTabState {
  generation: string
  geometry: string
}

function getWebViewBridge(): WebViewBridge | null {
  const hostWindow = window as Window & { chrome?: { webview?: WebViewBridge } }
  return hostWindow.chrome?.webview ?? null
}

/** Normalize the address-bar input into an embeddable http(s) URL. */
export function normalizeBrowserUrl(raw: string, selfOrigin: string): UrlResult {
  let text = raw.trim()
  if (text === '') return { ok: false, reason: 'invalid' }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) text = `https://${text}`
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, reason: 'scheme' }
  if (parsed.origin === selfOrigin || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
    return { ok: false, reason: 'loopback' }
  }
  return { ok: true, url: parsed.href }
}

export interface BrowserViewProps {
  t: PropsLocale<'codex-files'>['t']
  tabs: BrowserTab[]
  activeTabId: number
  onTabsChange: (tabs: BrowserTab[]) => void
  onActiveTabChange: (id: number) => void
  /** Keep the browser page mounted while another workbench view is active. */
  visible?: boolean
  /** Kept for focused component tests and standalone embedding. */
  showTabs?: boolean
}

export function BrowserView(props: BrowserViewProps) {
  const { t, tabs, activeTabId, onTabsChange, onActiveTabChange, visible = true, showTabs = false } = props
  const tabsRef = useRef(tabs)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const nativeTabIdsRef = useRef(new Set<number>())
  const nativeTabStateRef = useRef(new Map<number, NativeTabState>())
  tabsRef.current = tabs
  const activeTab = (tabs.find(tab => tab.id === activeTabId) ?? tabs[0])!
  const [address, setAddress] = useState(activeTab.url ?? '')
  const hasNativeBrowser = getWebViewBridge() !== null

  useEffect(() => {
    setAddress(activeTab.url ?? '')
  }, [activeTab.id, activeTab.url])

  const openInternalTab = (raw: string): void => {
    const result = normalizeBrowserUrl(raw, window.location.origin)
    if (!result.ok || result.url === undefined) return
    const id = Math.max(0, ...tabsRef.current.map(tab => tab.id)) + 1
    onTabsChange([...tabsRef.current, createBrowserTab(id, result.url)])
    onActiveTabChange(id)
  }

  // WebView2 sends NewWindowRequested messages to the top-level page. This is
  // what keeps iframe target="_blank" links inside the workbench tab strip.
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>): void => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const payload = data as { type?: unknown; url?: unknown; tabId?: unknown }
      if ((payload.type === 'dsh-browser-new-window' || payload.type === 'dsh-browser-native-new-window') && typeof payload.url === 'string') {
        openInternalTab(payload.url)
        return
      }
      if (payload.type !== 'dsh-browser-native-navigate' || typeof payload.url !== 'string' || typeof payload.tabId !== 'number') return
      if (!tabsRef.current.some(tab => tab.id === payload.tabId)) return
      const result = normalizeBrowserUrl(payload.url, window.location.origin)
      if (!result.ok || result.url === undefined) return
      const nextUrl = result.url
      onTabsChange(tabsRef.current.map(tab => {
        if (tab.id !== payload.tabId) return tab
        // The native host emits this after the child WebView has already
        // navigated. This only synchronizes the address/history; changing
        // reloadKey here would close and recreate the just-opened tab,
        // causing a visible flash (and, for media, a second player).
        if (tab.history[tab.cursor] === nextUrl) return tab
        return {
          ...tab,
          url: nextUrl,
          history: [...tab.history.slice(0, tab.cursor + 1), nextUrl],
          cursor: tab.cursor + 1,
        }
      }))
    }
    const bridge = getWebViewBridge()
    window.addEventListener('message', onMessage)
    bridge?.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      bridge?.removeEventListener('message', onMessage)
    }
  }, [])

  // Removing a tab from the workbench must also remove the corresponding
  // native WebView2 child. This is intentionally based on the tab-id diff so
  // top-level tab close buttons and the focused browser view share one path.
  useEffect(() => {
    const currentIds = new Set(tabs.map(tab => tab.id))
    for (const tabId of nativeTabIdsRef.current) {
      if (!currentIds.has(tabId)) {
        closeNativeBrowserTab(tabId)
        nativeTabStateRef.current.delete(tabId)
      }
    }
    nativeTabIdsRef.current = new Set([...nativeTabIdsRef.current].filter(tabId => currentIds.has(tabId)))
  }, [tabs])

  // The browser panel can be unmounted while its last tab is still playing.
  // Codex tears down the page in this case; do the same for every native tab.
  useEffect(() => {
    return () => {
      for (const tabId of nativeTabIdsRef.current) closeNativeBrowserTab(tabId)
      getWebViewBridge()?.postMessage({ type: 'dsh-browser-native-tab-active', tabId: null })
    }
  }, [])

  // In the desktop Harness, the iframe is only a geometry anchor. A native
  // WebView2 child is positioned over it so pages that send
  // frame-ancestors 'none' (including DeepSeek sign-in) still render. Keep
  // the anchor on about:blank: loading the remote page here as well would
  // create a second media document underneath the native child, so a video
  // would play twice and produce an echo.
  useEffect(() => {
    const bridge = getWebViewBridge()
    if (bridge === null) return
    const sendGeometry = (): void => {
      const frame = frameRef.current
      if (activeTab.url === null) {
        // The shell can reload without running the previous component's
        // unmount cleanup. Reclaim the initial id even before a new address
        // is entered, so an orphaned page cannot keep playing in the
        // background after the app refreshes.
        closeNativeBrowserTab(activeTab.id)
        nativeTabStateRef.current.delete(activeTab.id)
        nativeTabIdsRef.current.delete(activeTab.id)
        bridge.postMessage({ type: 'dsh-browser-native-tab-active', tabId: null })
        return
      }
      if (!visible || frame === null) {
        bridge.postMessage({ type: 'dsh-browser-native-tab-active', tabId: null })
        return
      }
      const rect = frame.getBoundingClientRect()
      const geometry = JSON.stringify({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      })
      // URL changes reported by the native child are already loaded in that
      // child. Only an explicit reload/navigation action increments
      // reloadKey and requires replacing the native page.
      const generation = String(activeTab.reloadKey)
      const previous = nativeTabStateRef.current.get(activeTab.id)
      const needsNewPage = previous?.generation !== generation
      if (needsNewPage) {
        // A page reload can outlive the old top-level document in the host.
        // Reclaim the id before creating the replacement so stale WebView2
        // children cannot remain audible underneath the new one.
        closeNativeBrowserTab(activeTab.id)
      }
      if (needsNewPage || previous?.geometry !== geometry) {
        bridge.postMessage({
          type: 'dsh-browser-native-tab',
          tabId: activeTab.id,
          url: activeTab.url,
          devicePixelRatio: window.devicePixelRatio || 1,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        })
        nativeTabStateRef.current.set(activeTab.id, { generation, geometry })
      }
      nativeTabIdsRef.current.add(activeTab.id)
      bridge.postMessage({ type: 'dsh-browser-native-tab-active', tabId: activeTab.id })
    }
    sendGeometry()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sendGeometry)
    if (frameRef.current !== null) resize?.observe(frameRef.current)
    window.addEventListener('resize', sendGeometry)
    return () => {
      resize?.disconnect()
      window.removeEventListener('resize', sendGeometry)
    }
  }, [activeTab.id, activeTab.url, activeTab.reloadKey, visible])

  const navigateTo = (raw: string, tabId = activeTab.id): void => {
    const result = normalizeBrowserUrl(raw, window.location.origin)
    if (!result.ok || result.url === undefined) return
    onTabsChange(tabsRef.current.map(tab => tab.id === tabId ? {
      ...tab,
      url: result.url!,
      history: [...tab.history.slice(0, tab.cursor + 1), result.url!],
      cursor: tab.cursor + 1,
      reloadKey: tab.reloadKey + 1,
    } : tab))
  }

  const go = (nextCursor: number): void => {
    const next = activeTab.history[nextCursor]
    if (next === undefined) return
    onTabsChange(tabsRef.current.map(tab => tab.id === activeTab.id ? {
      ...tab,
      url: next,
      cursor: nextCursor,
      reloadKey: tab.reloadKey + 1,
    } : tab))
  }

  const closeTab = (tabId: number): void => {
    closeNativeBrowserTab(tabId)
    if (tabsRef.current.length === 1) {
      onTabsChange([createBrowserTab(tabId)])
      return
    }
    const index = tabsRef.current.findIndex(tab => tab.id === tabId)
    const remaining = tabsRef.current.filter(tab => tab.id !== tabId)
    onTabsChange(remaining)
    if (tabId === activeTab.id) onActiveTabChange(remaining[Math.max(0, index - 1)]!.id)
  }

  return (
    <div className="cfx-browser">
      {showTabs && (
        <div className="cfx-browser-tabs" role="tablist">
          {tabs.map(tab => (
            <div className={`cfx-browser-tab${tab.id === activeTab.id ? ' is-active' : ''}`} key={tab.id}>
              <button type="button" role="tab" aria-selected={tab.id === activeTab.id} onClick={() => { onActiveTabChange(tab.id) }}>
                {tab.url === null ? t('browser.title') : new URL(tab.url).hostname}
              </button>
              <button type="button" className="cfx-browser-tab-close" aria-label={t('browser.closeTab')} onClick={() => { closeTab(tab.id) }}>×</button>
            </div>
          ))}
          <button type="button" className="cfx-browser-new-tab" aria-label={t('browser.newTab')} onClick={() => {
            const id = Math.max(0, ...tabsRef.current.map(tab => tab.id)) + 1
            onTabsChange([...tabsRef.current, createBrowserTab(id)])
            onActiveTabChange(id)
          }}>+</button>
        </div>
      )}
      <div className="cfx-browser-bar">
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.back')} title={t('browser.back')}
          disabled={activeTab.cursor <= 0} onClick={() => { go(activeTab.cursor - 1) }}
        >
          <IconChevronLeftOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.forward')} title={t('browser.forward')}
          disabled={activeTab.cursor >= activeTab.history.length - 1} onClick={() => { go(activeTab.cursor + 1) }}
        >
          <IconChevronRightOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.refresh')} title={t('browser.refresh')}
          onClick={() => { onTabsChange(tabsRef.current.map(tab => tab.id === activeTab.id ? { ...tab, reloadKey: tab.reloadKey + 1 } : tab)) }}
        >
          <IconRefreshOutline14 size={14} />
        </button>
        <input
          className="cfx-browser-input"
          value={address}
          placeholder={t('browser.placeholder')}
          spellCheck={false}
          onChange={(event) => {
            setAddress(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigateTo(address)
          }}
        />
        <button type="button" className="cfx-icon-button" aria-label={t('browser.go')} title={t('browser.go')} onClick={() => { navigateTo(address) }}>
          <IconLinkOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.openExternal')} title={t('browser.openExternal')}
          disabled={activeTab.url === null}
          onClick={() => { if (activeTab.url !== null) openInternalTab(activeTab.url) }}
        >
          <IconRightUpOutline16 size={15} />
        </button>
      </div>
      {activeTab.url === null ? (
        <div className="cfx-browser-empty">{t('browser.start')}</div>
      ) : (
        <iframe
          key={`${activeTab.id}:${activeTab.reloadKey}`}
          ref={frameRef}
          className="cfx-browser-frame"
          src={hasNativeBrowser ? 'about:blank' : activeTab.url}
          title={activeTab.url}
          sandbox={IFRAME_SANDBOX}
          referrerPolicy="no-referrer"
          allow={IFRAME_ALLOW}
        />
      )}
    </div>
  )
}
