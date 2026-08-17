/**
 * Tiny shared UI store for the workbench surfaces that live outside the
 * details-slot React tree (the bottom terminal panel). React state alone
 * cannot bridge the right-column slot and the shell.overlay portal, so the
 * shared fact stays in this framework-free external store.
 */
import { useSyncExternalStore } from 'react'

export interface WorkbenchUiState {
  /** Whether the Codex-style bottom panel is visible. */
  bottomPanelOpen: boolean
  /** Surface shown when the right Codex workbench is opened. */
  activeView: WorkbenchView
  /** File requested by a summary/source affordance outside the details tree. */
  fileRequest: { sessionId: string, path: string, sequence: number } | null
}

export type WorkbenchView = 'new-tab' | 'files' | 'review' | 'browser'

let state: WorkbenchUiState = { bottomPanelOpen: false, activeView: 'new-tab', fileRequest: null }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): WorkbenchUiState {
  return state
}

function setState(patch: Partial<WorkbenchUiState>): void {
  state = { ...state, ...patch }
  emit()
}

export function toggleBottomPanel(): void {
  setState({ bottomPanelOpen: !state.bottomPanelOpen })
}

export function openBottomPanel(): void {
  if (!state.bottomPanelOpen) setState({ bottomPanelOpen: true })
}

export function closeBottomPanel(): void {
  if (state.bottomPanelOpen) setState({ bottomPanelOpen: false })
}

export function setWorkbenchView(activeView: WorkbenchView): void {
  if (state.activeView !== activeView) setState({ activeView })
}

export function requestWorkbenchFile(sessionId: string, path: string): void {
  setState({
    activeView: 'files',
    fileRequest: {
      sessionId,
      path,
      sequence: (state.fileRequest?.sequence ?? 0) + 1,
    },
  })
}

export function useWorkbenchUi(): WorkbenchUiState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
