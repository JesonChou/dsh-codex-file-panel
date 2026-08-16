/**
 * Codex-style embedded browser tab. The iframe is sandboxed without
 * allow-same-origin or allow-top-navigation so a visited page cannot touch
 * the GUI. The address bar only accepts http(s) and rejects loopback /
 * self-origin URLs.
 */
import { useState } from 'react'
import {
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconLinkOutline14,
  IconRefreshOutline14,
  IconRightUpOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

const IFRAME_SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox'

interface UrlResult {
  ok: boolean
  url?: string
  reason?: 'invalid' | 'scheme' | 'loopback'
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

export function BrowserView(props: { t: PropsLocale<'codex-files'>['t'] }) {
  const { t } = props
  const [input, setInput] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const navigateTo = (raw: string): void => {
    const result = normalizeBrowserUrl(raw, window.location.origin)
    if (!result.ok || result.url === undefined) {
      setMessage(
        result.reason === 'scheme'
          ? t('browser.blockedScheme')
          : result.reason === 'loopback'
            ? t('browser.blockedLoopback')
            : t('browser.invalid'),
      )
      return
    }
    setMessage(null)
    setUrl(result.url)
    setInput(result.url)
    setHistory(prev => [...prev.slice(0, cursor + 1), result.url!])
    setCursor(prev => prev + 1)
    setReloadKey(key => key + 1)
  }

  const go = (nextCursor: number): void => {
    const next = history[nextCursor]
    if (next === undefined) return
    setCursor(nextCursor)
    setUrl(next)
    setInput(next)
    setReloadKey(key => key + 1)
  }

  return (
    <div className="cfx-browser">
      <div className="cfx-browser-bar">
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.back')} title={t('browser.back')}
          disabled={cursor <= 0} onClick={() => { go(cursor - 1) }}
        >
          <IconChevronLeftOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.forward')} title={t('browser.forward')}
          disabled={cursor >= history.length - 1} onClick={() => { go(cursor + 1) }}
        >
          <IconChevronRightOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.refresh')} title={t('browser.refresh')}
          onClick={() => { setReloadKey(key => key + 1) }}
        >
          <IconRefreshOutline14 size={14} />
        </button>
        <input
          className="cfx-browser-input"
          value={input}
          placeholder={t('browser.placeholder')}
          spellCheck={false}
          onChange={(event) => { setInput(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigateTo(input)
          }}
        />
        <button type="button" className="cfx-icon-button" aria-label={t('browser.go')} title={t('browser.go')} onClick={() => { navigateTo(input) }}>
          <IconLinkOutline14 size={14} />
        </button>
        <button
          type="button" className="cfx-icon-button" aria-label={t('browser.openExternal')} title={t('browser.openExternal')}
          disabled={url === null}
          onClick={() => { if (url !== null) window.open(url, '_blank', 'noopener') }}
        >
          <IconRightUpOutline16 size={15} />
        </button>
      </div>
      {message !== null && <div className="cfx-browser-message">{message}</div>}
      {url === null ? (
        <div className="cfx-browser-empty">{t('browser.start')}</div>
      ) : (
        <iframe
          key={reloadKey}
          className="cfx-browser-frame"
          src={url}
          title={url}
          sandbox={IFRAME_SANDBOX}
          referrerPolicy="no-referrer"
          allow=""
        />
      )}
    </div>
  )
}
