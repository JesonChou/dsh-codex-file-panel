/**
 * The details column's live geometry fact, shared by the panel toggle and
 * its tests. The AppFrame marks the frame element with
 * `data-details-collapsed` whenever the column solves to zero width, so the
 * DOM attribute is the single source of truth the toggle reads — it can
 * never drift out of sync with the real layout, unlike a plugin-local flag.
 */

/** True while the right details column is collapsed (zero width). */
export function isDetailsCollapsed(): boolean {
  return document.querySelector('[data-details-collapsed]') !== null
}

/** The layout action a toggle click should take for one collapsed fact. */
export function detailsAction(collapsed: boolean): 'open' | 'close' {
  return collapsed ? 'open' : 'close'
}
