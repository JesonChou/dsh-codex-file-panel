/**
 * Panel toggle tests: the decision function maps the frame's collapsed
 * fact onto the layout action, and the DOM probe reads the AppFrame's
 * data-details-collapsed marker.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { detailsAction, isDetailsCollapsed } from '../src/client/panel-toggle.ts'

describe('detailsAction', () => {
  it('opens when the column is collapsed', () => {
    expect(detailsAction(true)).toBe('open')
  })

  it('closes when the column is open', () => {
    expect(detailsAction(false)).toBe('close')
  })
})

describe('isDetailsCollapsed', () => {
  afterEach(() => {
    document.querySelector('[data-details-collapsed]')?.remove()
  })

  it('reads the frame marker when present', () => {
    const frame = document.createElement('div')
    frame.setAttribute('data-details-collapsed', '')
    document.body.appendChild(frame)
    expect(isDetailsCollapsed()).toBe(true)
  })

  it('reports open when no marker exists', () => {
    expect(isDetailsCollapsed()).toBe(false)
  })
})
