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
}

let state: WorkbenchUiState = { bottomPanelOpen: false }
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

export function useWorkbenchUi(): WorkbenchUiState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
