/**
 * Tiny shared UI store for the workbench surfaces that live outside the
 * details-slot React tree (the bottom terminal panel). React state alone
 * cannot bridge the right-column slot and the shell.overlay portal, so the
 * shared fact stays in this framework-free external store.
 */
import { useSyncExternalStore } from 'react'
import {
  defaultRightPanelWidth,
  rightPanelRatioFromWidth,
  rightPanelWidthFromRatio,
  summaryDisplayMode,
  type SummaryDisplayMode,
} from './workbench-layout.ts'

const RIGHT_PANEL_RATIO_KEY = 'dsh-codex-files:right-panel-width-ratio:v1'

function readRightPanelRatio(): number | null {
  if (typeof window === 'undefined' || window.localStorage === undefined) return null
  const value = Number.parseFloat(window.localStorage.getItem(RIGHT_PANEL_RATIO_KEY) ?? '')
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
}

export interface WorkbenchUiState {
  /** Whether the Codex-style bottom panel is visible. */
  bottomPanelOpen: boolean
  /** Surface shown when the right Codex workbench is opened. */
  activeView: WorkbenchView
  /** File requested by a summary/source affordance outside the details tree. */
  fileRequest: { sessionId: string, path: string, sequence: number } | null
  /** Widths measured from the live DSH shell rather than CSS media queries. */
  frameWidth: number
  shellHeight: number
  sidebarWidth: number
  mainContentWidth: number
  mainContentTargetWidth: number
  rightPanelWidth: number
  rightPanelWidthRatio: number | null
  rightPanelOpen: boolean
  panelExpanded: boolean
  summaryDisplayMode: SummaryDisplayMode
  summarySessionId: string | null
  summaryPinned: boolean
  summaryPopoverOpen: boolean
}

export type WorkbenchView = 'new-tab' | 'files' | 'review' | 'browser'

let state: WorkbenchUiState = {
  bottomPanelOpen: false,
  activeView: 'new-tab',
  fileRequest: null,
  frameWidth: 0,
  shellHeight: 0,
  sidebarWidth: 0,
  mainContentWidth: 0,
  mainContentTargetWidth: 0,
  rightPanelWidth: 0,
  rightPanelWidthRatio: readRightPanelRatio(),
  rightPanelOpen: false,
  panelExpanded: false,
  summaryDisplayMode: 'overlay',
  summarySessionId: null,
  summaryPinned: true,
  summaryPopoverOpen: false,
}
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
  const entries = Object.entries(patch) as [keyof WorkbenchUiState, WorkbenchUiState[keyof WorkbenchUiState]][]
  if (entries.every(([key, value]) => Object.is(state[key], value))) return
  state = { ...state, ...patch }
  emit()
}

export function updateWorkbenchGeometry(input: {
  frameWidth: number
  shellHeight: number
  sidebarWidth: number
  rightPanelOpen: boolean
  panelExpanded: boolean
}): void {
  const mainContentWidth = Math.max(0, input.frameWidth - input.sidebarWidth)
  const rightPanelWidth = input.panelExpanded
    ? mainContentWidth
    : state.rightPanelWidthRatio === null
      ? defaultRightPanelWidth(mainContentWidth, input.shellHeight)
      : rightPanelWidthFromRatio(state.rightPanelWidthRatio, mainContentWidth)
  const mainContentTargetWidth = Math.max(0, mainContentWidth - (input.rightPanelOpen ? rightPanelWidth : 0))
  const nextSummaryDisplayMode = summaryDisplayMode(mainContentTargetWidth)
  const summaryPopoverOpen = state.summaryDisplayMode === nextSummaryDisplayMode
    ? state.summaryPopoverOpen
    : false
  if (!summaryPopoverOpen && state.summaryPopoverOpen) {
    saveSummaryState(state.summarySessionId, state.summaryPinned, false)
  }
  setState({
    ...input,
    mainContentWidth,
    mainContentTargetWidth,
    rightPanelWidth,
    summaryDisplayMode: nextSummaryDisplayMode,
    summaryPopoverOpen,
  })
}

export function setRightPanelWidth(width: number, persist = true): void {
  const ratio = rightPanelRatioFromWidth(width, state.mainContentWidth)
  if (persist && window.localStorage !== undefined) window.localStorage.setItem(RIGHT_PANEL_RATIO_KEY, String(ratio))
  setState({
    rightPanelWidthRatio: ratio,
    rightPanelWidth: rightPanelWidthFromRatio(ratio, state.mainContentWidth),
  })
}

export function resetRightPanelWidth(): void {
  window.localStorage?.removeItem(RIGHT_PANEL_RATIO_KEY)
  setState({
    rightPanelWidthRatio: null,
    rightPanelWidth: defaultRightPanelWidth(state.mainContentWidth, state.shellHeight),
  })
}

export function setPanelExpanded(panelExpanded: boolean): void {
  if (panelExpanded && state.summaryPopoverOpen) {
    saveSummaryState(state.summarySessionId, state.summaryPinned, false)
  }
  setState({ panelExpanded, summaryPopoverOpen: false })
}

const summaryStates = new Map<string, { pinned: boolean; popoverOpen: boolean }>()

function saveSummaryState(sessionId: string | null, pinned: boolean, popoverOpen: boolean): void {
  if (sessionId !== null) summaryStates.set(sessionId, { pinned, popoverOpen })
}

export function selectSummarySession(summarySessionId: string): void {
  const saved = summaryStates.get(summarySessionId) ?? { pinned: true, popoverOpen: false }
  setState({
    summarySessionId,
    summaryPinned: saved.pinned,
    summaryPopoverOpen: saved.popoverOpen,
  })
}

export function toggleSummary(summarySessionId = state.summarySessionId): void {
  if (summarySessionId !== null && summarySessionId !== state.summarySessionId) selectSummarySession(summarySessionId)
  if (state.summaryDisplayMode === 'overlay') {
    const summaryPopoverOpen = !state.summaryPopoverOpen
    saveSummaryState(summarySessionId, state.summaryPinned, summaryPopoverOpen)
    setState({ summaryPopoverOpen })
  } else {
    const summaryPinned = !state.summaryPinned
    saveSummaryState(summarySessionId, summaryPinned, false)
    setState({ summaryPinned, summaryPopoverOpen: false })
  }
}

export function closeSummaryPopover(summarySessionId = state.summarySessionId): void {
  if (state.summaryPopoverOpen) {
    saveSummaryState(summarySessionId, state.summaryPinned, false)
    setState({ summaryPopoverOpen: false })
  }
}

export function setSummaryPinned(summaryPinned: boolean): void {
  saveSummaryState(state.summarySessionId, summaryPinned, state.summaryPopoverOpen)
  setState({ summaryPinned })
}

export function setSummaryPopoverOpen(summaryPopoverOpen: boolean): void {
  saveSummaryState(state.summarySessionId, state.summaryPinned, summaryPopoverOpen)
  setState({ summaryPopoverOpen })
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
