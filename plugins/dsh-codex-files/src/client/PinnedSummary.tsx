import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gitInfo } from './api.ts'
import { collectSessionFiles, sessionFilesEqual, splitDisplayPath } from './files.ts'
import { requestWorkbenchFile, setWorkbenchView } from './workbench-store.ts'

export interface PinnedSummaryInjected {
  openDetails: () => void
}

export type PinnedSummaryProps =
  PropsRuntime<'conversation.session.header.utilities'> &
  PinnedSummaryInjected &
  PropsLocale<'codex-files'>

/** Codex's compact thread summary, pinned above the closed workbench. */
export function PinnedSummary({
  sessionId, useSession, useSessions, openDetails, t,
}: PinnedSummaryProps) {
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  const files = useSession(state => collectSessionFiles(state), sessionFilesEqual)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [branch, setBranch] = useState<string | null>(null)
  const [repo, setRepo] = useState<string | null>(null)
  const [statusCount, setStatusCount] = useState(0)

  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>('[data-shell-overlay]')
    const frame = overlay?.parentElement ?? null
    if (overlay === null || frame === null) return
    setPortalHost(overlay)
    const update = (): void => { setCollapsed(frame.hasAttribute('data-details-collapsed')) }
    update()
    const observer = new MutationObserver(update)
    observer.observe(frame, { attributes: true, attributeFilter: ['data-details-collapsed'] })
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => {
    let current = true
    setBranch(null)
    setRepo(null)
    setStatusCount(0)
    void gitInfo(sessionId).then(result => {
      if (!current || !result.ok) return
      setBranch(result.branch)
      setRepo(result.repo)
      setStatusCount(Object.values(result.status).filter(Boolean).length)
    })
    return () => { current = false }
  }, [sessionId])

  const workspace = useMemo(() => {
    const normalized = cwd?.replace(/[\\/]+$/, '') ?? ''
    return normalized.split(/[\\/]/).at(-1) || repo || t('summary.local')
  }, [cwd, repo, t])

  if (!collapsed || portalHost === null || cwd === undefined) return null

  const openView = (view: 'files' | 'review'): void => {
    setWorkbenchView(view)
    openDetails()
  }

  return createPortal(
    <aside className="cfx-summary-card" aria-label={t('summary.environment')}>
      <SummarySection
        title={t('summary.environment')}
        onAdd={() => { openView('review') }}
        addLabel={t('summary.openReview')}
      >
        <SummaryButton icon="changes" label={t('summary.changes')} meta={statusCount > 0 ? String(statusCount) : undefined} onClick={() => { openView('review') }} />
        <SummaryRow icon="local" label={t('summary.local')} meta={workspace} chevron />
        {branch !== null && (
          <SummaryButton
            icon="branch" label={branch} chevron
            title={t('summary.copyBranch')}
            onClick={() => { void writeClipboard(branch) }}
          />
        )}
        <SummaryButton icon="commit" label={t('summary.commitPush')} onClick={() => { openView('review') }} />
        <SummaryRow icon="github" label={t('summary.prUnavailable')} muted />
      </SummarySection>

      {files.length > 0 && (
        <SummarySection
          title={t('summary.sources')}
          onAdd={() => { openView('files') }}
          addLabel={t('summary.openFiles')}
          divided
        >
          {files.slice(0, 3).map(file => {
            const display = splitDisplayPath(file.path)
            return (
              <button
                key={file.path}
                type="button"
                className="cfx-summary-source"
                title={file.path}
                onClick={() => {
                  requestWorkbenchFile(sessionId, file.path)
                  openDetails()
                }}
              >
                <SourceMark path={file.path} />
                <span>{display.name}</span>
              </button>
            )
          })}
          <button type="button" className="cfx-summary-show-all" onClick={() => { openView('files') }}>
            <SummaryGlyph kind="sources" />
            <span>{t('summary.showAll')}</span>
          </button>
        </SummarySection>
      )}
    </aside>,
    portalHost,
  )
}

function SummarySection({ title, onAdd, addLabel, divided = false, children }: {
  title: string
  onAdd: () => void
  addLabel: string
  divided?: boolean
  children: ReactNode
}) {
  return (
    <section className={`cfx-summary-section${divided ? ' cfx-summary-section-divided' : ''}`}>
      <header className="cfx-summary-heading">
        <span>{title}</span>
        <button type="button" aria-label={addLabel} title={addLabel} onClick={onAdd}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div className="cfx-summary-rows">{children}</div>
    </section>
  )
}

function SummaryButton(props: {
  icon: SummaryIcon
  label: string
  meta?: string | undefined
  chevron?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button type="button" className="cfx-summary-row cfx-summary-row-button" title={props.title} onClick={props.onClick}>
      <SummaryRowContents {...props} />
    </button>
  )
}

function SummaryRow(props: {
  icon: SummaryIcon
  label: string
  meta?: string | undefined
  chevron?: boolean
  muted?: boolean
}) {
  return (
    <div className={`cfx-summary-row${props.muted === true ? ' cfx-summary-row-muted' : ''}`}>
      <SummaryRowContents {...props} />
    </div>
  )
}

function SummaryRowContents(props: { icon: SummaryIcon, label: string, meta?: string | undefined, chevron?: boolean }) {
  return (
    <>
      <SummaryGlyph kind={props.icon} />
      <span className="cfx-summary-row-label">{props.label}</span>
      {props.meta !== undefined && <span className="cfx-summary-row-meta">{props.meta}</span>}
      {props.chevron === true && <svg className="cfx-summary-chevron" viewBox="0 0 16 16" aria-hidden><path d="m4.5 6 3.5 3.5L11.5 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </>
  )
}

type SummaryIcon = 'changes' | 'local' | 'branch' | 'commit' | 'github' | 'sources'

function SummaryGlyph({ kind }: { kind: SummaryIcon }) {
  if (kind === 'local') return <svg viewBox="0 0 16 16" aria-hidden><path d="M2.5 3h11v7.5h-11zM1.5 13h13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (kind === 'branch') return <svg viewBox="0 0 16 16" aria-hidden><circle cx="5" cy="3" r="1.5" fill="none" stroke="currentColor"/><circle cx="5" cy="13" r="1.5" fill="none" stroke="currentColor"/><circle cx="11" cy="5" r="1.5" fill="none" stroke="currentColor"/><path d="M5 4.5v7M11 6.5v1A3.5 3.5 0 0 1 7.5 11H5" fill="none" stroke="currentColor" strokeLinecap="round" /></svg>
  if (kind === 'commit') return <svg viewBox="0 0 16 16" aria-hidden><path d="M1.5 8h3M11.5 8h3" fill="none" stroke="currentColor" strokeLinecap="round"/><circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor"/></svg>
  if (kind === 'github') return <svg viewBox="0 0 16 16" aria-hidden><path d="M8 1.5a6.4 6.4 0 0 0-2 12.5v-1.7c-1.7.4-2.1-.7-2.1-.7-.3-.8-.8-1-1-1.1-.7-.4.1-.4.1-.4.8.1 1.2.8 1.2.8.7 1.2 1.8.9 2.2.7.1-.5.3-.9.5-1.1-1.4-.2-2.9-.7-2.9-3.2 0-.7.3-1.3.7-1.8-.1-.2-.3-.9.1-1.8 0 0 .6-.2 2 .7A6.8 6.8 0 0 1 8 4.5c.6 0 1.2.1 1.8.2 1.4-.9 2-.7 2-.7.4.9.2 1.6.1 1.8.5.5.7 1.1.7 1.8 0 2.5-1.5 3-2.9 3.2.2.2.5.7.5 1.3V14A6.4 6.4 0 0 0 8 1.5Z" fill="currentColor" /></svg>
  if (kind === 'sources') return <svg viewBox="0 0 16 16" aria-hidden><circle cx="4" cy="11.5" r="1.5" fill="none" stroke="currentColor"/><circle cx="8" cy="4.5" r="1.5" fill="none" stroke="currentColor"/><circle cx="12" cy="9" r="1.5" fill="none" stroke="currentColor"/><path d="m5 10.3 2.1-4.4M9.2 5.5l1.7 2.4" fill="none" stroke="currentColor" /></svg>
  return <svg viewBox="0 0 16 16" aria-hidden><rect x="2" y="1.8" width="12" height="12.4" rx="2" fill="none" stroke="currentColor"/><path d="M5 5h6M5 8h6M5 11h3" fill="none" stroke="currentColor" strokeLinecap="round"/></svg>
}

function SourceMark({ path }: { path: string }) {
  const extension = path.split('.').pop()?.slice(0, 2).toUpperCase() ?? ''
  return <span className="cfx-summary-source-mark" aria-hidden>{extension}</span>
}
