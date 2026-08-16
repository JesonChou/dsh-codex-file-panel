/**
 * xterm.js terminal backed by the plugin's PTY WebSocket. The host replays
 * the shell transcript on connect and then streams live output; raw bytes
 * from the keyboard are sent verbatim, while resize frames use a small JSON
 * control protocol. A dropped socket retries automatically; a server-side
 * refusal stops the loop and shows a manual retry button.
 */
import { useEffect, useRef, useState } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { terminalUrl } from './api.ts'

const RETRY_DELAY_MS = 2_000
const FAILURE_LIMIT = 3

/** Codex-dark terminal palette; the surface reads app tokens in theme.ts. */
const TERMINAL_THEME: ITheme = {
  background: '#0a0a0a',
  foreground: '#e8e8e8',
  cursor: '#e8e8e8',
  cursorAccent: '#0a0a0a',
  selectionBackground: 'rgba(255,255,255,0.22)',
  black: '#282c34',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
}

export function TerminalView(props: {
  sessionId: string
  tabId: string
  t: PropsLocale<'codex-files'>['t']
}) {
  const { sessionId, tabId, t } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [connected, setConnected] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const retryRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const term = new Terminal({
      cursorBlink: true,
      allowTransparency: true,
      convertEol: false,
      scrollback: 4000,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: TERMINAL_THEME,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)

    let socket: WebSocket | null = null
    let closed = false
    let retry: number | undefined
    let failures = 0

    const sendResize = (): void => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    const connect = (): void => {
      if (closed) return
      socket = new WebSocket(terminalUrl(sessionId, tabId))
      socket.onopen = () => {
        failures = 0
        setConnected(true)
        setFatal(null)
        sendResize()
      }
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') term.write(event.data)
      }
      socket.onclose = (event) => {
        setConnected(false)
        if (event.code === 1011 && event.reason !== '') {
          setFatal(event.reason)
          return
        }
        failures += 1
        if (failures >= FAILURE_LIMIT) {
          const detail = event.reason === '' ? '' : ` (${event.code}: ${event.reason})`
          setFatal(`terminal connection failed${detail}`)
          return
        }
        if (!closed) retry = window.setTimeout(connect, RETRY_DELAY_MS)
      }
      socket.onerror = () => {
        socket?.close()
      }
    }
    retryRef.current = connect

    const inputSub = term.onData((data) => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) socket.send(data)
    })
    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
        sendResize()
      } catch {
        // The host may be mid-dispose.
      }
    })
    observer.observe(host)
    try {
      fit.fit()
    } catch {
      // A zero-size host can race first paint; the observer retries.
    }
    connect()

    return () => {
      closed = true
      window.clearTimeout(retry)
      observer.disconnect()
      inputSub.dispose()
      if (socket !== null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'close' }))
      }
      socket?.close()
      term.dispose()
      retryRef.current = null
    }
  }, [sessionId, tabId])

  return (
    <div className="cfx-terminal-wrap">
      {fatal !== null && (
        <div className="cfx-terminal-banner">
          <span>{fatal}</span>
          <button type="button" className="cfx-btn" onClick={() => { setFatal(null); retryRef.current?.() }}>
            {t('terminal.retry')}
          </button>
        </div>
      )}
      {fatal === null && !connected && <div className="cfx-terminal-banner">{t('terminal.connecting')}</div>}
      <div ref={hostRef} className="cfx-terminal" />
    </div>
  )
}
