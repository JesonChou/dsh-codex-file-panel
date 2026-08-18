/**
 * Layout contracts measured from the locally installed Codex Desktop shell.
 * Keep these values in one place so the portal surfaces and the details slot
 * cannot drift apart when the DSH sidebar or browser window changes size.
 */
export const RIGHT_PANEL_MIN_WIDTH = 320
export const RIGHT_PANEL_MIN_MAIN_WIDTH = 352
export const RIGHT_PANEL_CLOSE_THRESHOLD = 160
export const SUMMARY_WIDTH = 316
export const TERMINAL_MIN_HEIGHT = 160
export const TERMINAL_DEFAULT_HEIGHT = 280
export const TERMINAL_CLOSE_THRESHOLD = 80
export const TERMINAL_MAX_HEIGHT_RATIO = 0.5

export type SummaryDisplayMode = 'overlay' | 'shift' | 'gutter'

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function parseSidebarWidth(gridTemplateColumns: string, fallback = 0): number {
  const match = /^\s*([\d.]+)px(?:\s|$)/.exec(gridTemplateColumns)
  if (match === null) return fallback
  const width = Number.parseFloat(match[1] ?? '')
  return Number.isFinite(width) ? width : fallback
}

export function rightPanelMaximumWidth(mainContentWidth: number): number {
  return Math.max(RIGHT_PANEL_MIN_WIDTH, mainContentWidth - RIGHT_PANEL_MIN_MAIN_WIDTH)
}

/** Codex's dynamic default before the user explicitly resizes the panel. */
export function defaultRightPanelWidth(mainContentWidth: number, shellHeight: number): number {
  const maximum = rightPanelMaximumWidth(mainContentWidth)
  const preferred = Math.max(
    RIGHT_PANEL_MIN_WIDTH,
    Math.min(shellHeight * 1.6, mainContentWidth - 500),
    Math.min(640, mainContentWidth - RIGHT_PANEL_MIN_MAIN_WIDTH),
  )
  return clamp(preferred, RIGHT_PANEL_MIN_WIDTH, maximum)
}

export function rightPanelWidthFromRatio(ratio: number, mainContentWidth: number): number {
  const maximum = rightPanelMaximumWidth(mainContentWidth)
  if (maximum <= RIGHT_PANEL_MIN_WIDTH) return RIGHT_PANEL_MIN_WIDTH
  return RIGHT_PANEL_MIN_WIDTH + clamp(ratio, 0, 1) * (maximum - RIGHT_PANEL_MIN_WIDTH)
}

export function rightPanelRatioFromWidth(width: number, mainContentWidth: number): number {
  const maximum = rightPanelMaximumWidth(mainContentWidth)
  if (maximum <= RIGHT_PANEL_MIN_WIDTH) return 0
  return clamp((width - RIGHT_PANEL_MIN_WIDTH) / (maximum - RIGHT_PANEL_MIN_WIDTH), 0, 1)
}

/**
 * Native summary breakpoints are derived from `(width - 736) / 2` rather
 * than CSS viewport breakpoints. This is why maximizing a window must not be
 * treated as a separate UI mode.
 */
export function summaryDisplayMode(mainContentTargetWidth: number): SummaryDisplayMode {
  const gutter = (mainContentTargetWidth - 736) / 2
  if (gutter < 180) return 'overlay'
  if (gutter < 400) return 'shift'
  return 'gutter'
}

export function clampTerminalHeight(height: number, shellHeight: number): number {
  const maximum = Math.max(TERMINAL_MIN_HEIGHT, shellHeight * TERMINAL_MAX_HEIGHT_RATIO)
  return clamp(height, TERMINAL_MIN_HEIGHT, maximum)
}
