/**
 * dsh-codex-files, browser half: installs the Codex Desktop-style dark
 * theme (token-layer overrides + panel styles), occupies the shell's right
 * details column with the CodexFilesPanel (priority -1 shadows the shipped
 * tool-details entry, whose seat collapses with it), and registers the
 * session-header toggle that opens the panel. Pure presentation: no host
 * services beyond the routes the node half serves.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { BottomPanel } from './BottomPanel.tsx'
import { CodexFilesPanel, PanelToggle, type PanelInjected, type PanelToggleInjected } from './CodexFilesPanel.tsx'
import { NS, en, zh } from './locales.ts'
import { CODEX_THEME_CSS } from './theme.ts'

export const name = 'dsh-codex-files'

export const inject = ['slots', 'sessions', 'locale', 'layout', 'workspaces']

/**
 * Client plugin body: dictionaries, theme stylesheet, the details-column
 * Files panel, and the header toggle.
 * @param ctx - the client cordis context (slots, locale, layout, workspaces).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-codex-files: dictionaries')

  // One <style> tag for the theme + panel styles; the disposer removes it
  // with the fiber so hot unload leaves no stray styles.
  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-dsh-codex-files', '')
    style.textContent = CODEX_THEME_CSS
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-codex-files: theme stylesheet')

  // The right details column: priority -1 shadows ui-conversation's
  // tool-details entry (same cell, lower priority wins; the shipped entry
  // stays on the ledger and returns if this plugin unloads). The inject
  // factory runs on the entry's first render (UI ready), where opening the
  // column is safe — Codex posture: the Files panel is a standing surface.
  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    priority: -1,
    locale: NS,
    inject: (): PanelInjected => {
      ctx.layout.openDetails()
      return {
        closeDetails: () => { ctx.layout.closeDetails() },
        toggleSidebar: () => { ctx.layout.toggleSidebar() },
        openPath: (path: string) => { void ctx.workspaces.openPath(path) },
      }
    },
  }, CodexFilesPanel))

  // The Codex-style bottom panel is discovered through the shell overlay slot
  // and portaled into the frame's grid row by BottomPanel itself.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'codex-files-bottom-panel',
    order: 100,
    locale: NS,
  }, BottomPanel))

  // The collapsed-panel opener belongs in the right-aligned header utilities,
  // immediately after Session log/export, so it sits next to the details
  // column instead of floating beside the mode controls. It only renders while
  // the details column is actually collapsed.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'codex-files-panel-toggle',
    order: 1000,
    locale: NS,
    inject: (): PanelToggleInjected => ({
      togglePanel: () => { ctx.layout.openDetails() },
    }),
  }, PanelToggle))
}
