import { describe, expect, it } from 'vitest'
import {
  clampTerminalHeight, defaultRightPanelWidth, parseSidebarWidth,
  rightPanelMaximumWidth, rightPanelRatioFromWidth, rightPanelWidthFromRatio,
  summaryDisplayMode,
} from '../src/client/workbench-layout.ts'

describe('Codex Desktop layout contract', () => {
  it('parses the host inline sidebar track instead of a CSS-overridden box', () => {
    expect(parseSidebarWidth('280px minmax(0, 1fr) 360px')).toBe(280)
    expect(parseSidebarWidth('56px minmax(0, 1fr) 0px')).toBe(56)
    expect(parseSidebarWidth('minmax(0, 1fr)', 77)).toBe(77)
  })

  it('uses Codex dynamic defaults and normalized right-panel widths', () => {
    expect(defaultRightPanelWidth(1400, 900)).toBe(900)
    const maximum = rightPanelMaximumWidth(1400)
    expect(maximum).toBe(1048)
    expect(rightPanelWidthFromRatio(0, 1400)).toBe(320)
    expect(rightPanelWidthFromRatio(1, 1400)).toBe(maximum)
    expect(rightPanelRatioFromWidth(maximum, 1400)).toBe(1)
  })

  it('matches native summary breakpoints exactly', () => {
    expect(summaryDisplayMode(1095)).toBe('overlay')
    expect(summaryDisplayMode(1096)).toBe('shift')
    expect(summaryDisplayMode(1535)).toBe('shift')
    expect(summaryDisplayMode(1536)).toBe('gutter')
  })

  it('clamps the terminal to 160px through half the shell height', () => {
    expect(clampTerminalHeight(20, 1000)).toBe(160)
    expect(clampTerminalHeight(280, 1000)).toBe(280)
    expect(clampTerminalHeight(900, 1000)).toBe(500)
  })
})
