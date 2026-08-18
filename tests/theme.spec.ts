import { afterEach, describe, expect, it } from 'vitest'
import { CODEX_THEME_CSS } from '../src/client/theme.ts'

afterEach(() => {
  document.head.replaceChildren()
  document.body.replaceChildren()
})

describe('Codex workbench resize theme', () => {
  it('disables the host grid animation for the duration of right-panel drag', () => {
    const style = document.createElement('style')
    style.textContent = CODEX_THEME_CSS
    document.head.appendChild(style)

    const frame = document.createElement('div')
    frame.setAttribute('data-codex-files-frame', 'true')
    frame.setAttribute('data-codex-files-right-panel-resizing', 'true')
    frame.style.transition = 'grid-template-columns 300ms ease'
    document.body.appendChild(frame)

    expect(getComputedStyle(frame).transition).toBe('none')
  })

  it('keeps the complete resize hit area inside the panel edge', () => {
    expect(CODEX_THEME_CSS).toContain('.cfx-panel-resize-handle {')
    expect(CODEX_THEME_CSS).not.toContain('transform: translateX(-8px)')
  })

  it('balances the conversation against a pinned summary in shift mode', () => {
    const style = document.createElement('style')
    style.textContent = CODEX_THEME_CSS
    document.head.appendChild(style)

    const frame = document.createElement('div')
    frame.setAttribute('data-codex-files-frame', 'true')
    frame.setAttribute('data-codex-files-summary-mode', 'shift')
    frame.setAttribute('data-codex-files-summary-visible', '')
    const flow = document.createElement('div')
    flow.setAttribute('data-chat-flow', '')
    const composer = document.createElement('div')
    composer.setAttribute('data-composer-card', 'true')
    frame.append(flow, composer)
    document.body.appendChild(frame)

    expect(getComputedStyle(flow).transform).toBe('translateX(-158px)')
    expect(getComputedStyle(composer).transform).toBe('translateX(-158px)')
  })

  it('keeps the new-session hero centered when summary compensation is active', () => {
    const style = document.createElement('style')
    style.textContent = CODEX_THEME_CSS
    document.head.appendChild(style)

    const frame = document.createElement('div')
    frame.setAttribute('data-codex-files-frame', 'true')
    frame.setAttribute('data-codex-files-summary-mode', 'shift')
    frame.setAttribute('data-codex-files-summary-visible', '')
    const hero = document.createElement('div')
    hero.setAttribute('data-phase', 'hero')
    const flow = document.createElement('div')
    flow.setAttribute('data-chat-flow', '')
    const composer = document.createElement('div')
    composer.setAttribute('data-composer-card', 'true')
    hero.append(flow, composer)
    frame.append(hero)
    document.body.appendChild(frame)

    expect(getComputedStyle(flow).transform).toBe('none')
    expect(getComputedStyle(composer).transform).toBe('none')
    expect(getComputedStyle(composer).transition).toBe('none')
  })
})
