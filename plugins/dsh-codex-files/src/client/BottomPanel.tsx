/**
 * The Codex-style bottom panel, mounted through the shell.overlay slot so it
 * spans the app instead of living inside the right details column. Today it
 * hosts one terminal; the right-side header button toggles it.
 */
import {
  IconCloseOutline16,
  IconPanelLeftOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { TerminalView } from './TerminalView.tsx'
import { toggleBottomPanel, useWorkbenchUi } from './workbench-store.ts'

export type BottomPanelProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'codex-files'>

export function BottomPanel({ useSessions, t }: BottomPanelProps) {
  const sessionId = useSessions(state => state.current)
  const { bottomPanelOpen } = useWorkbenchUi()
  if (!bottomPanelOpen || sessionId === undefined) return null
  return (
    <div className="cfx-bottom-panel" data-codex-files-bottom-panel>
      <div className="cfx-bottom-panel-header">
        <IconPanelLeftOutline16 className="cfx-panel-right-icon" size={14} aria-hidden />
        <span className="cfx-bottom-panel-title">{t('terminal.title')}</span>
        <span className="cfx-spacer" />
        <button
          type="button" className="cfx-icon-button" aria-label={t('panel.close')} title={t('panel.close')}
          onClick={toggleBottomPanel}
        >
          <IconCloseOutline16 size={14} />
        </button>
      </div>
      <TerminalView sessionId={sessionId} tabId="bottom-terminal" t={t} />
    </div>
  )
}
