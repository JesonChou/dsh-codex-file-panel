/**
 * Codex theme + Files panel stylesheet (browser half), injected as one
 * <style> tag by the client apply (index.tsx). Kept as a string so the
 * bundle carries no CSS asset. DeepSeek brand elements (whale mark, brand
 * blue) stay untouched; the palette override only recolors the token
 * layers that drive the app chrome.
 */

/** The injected stylesheet body. */
export const CODEX_THEME_CSS = String.raw`/**
 * Codex Desktop-style dark theme for the dsh web UI, plus the Files panel's
 * own styles. The theme overrides the design-token layer (--dsw-static-*
 * scales that every --dsw-alias-* resolves to) under the dark-theme body
 * marker, so the whole app — sidebar, chat, composer, tool cards — inherits
 * the Codex palette without touching component CSS. Light mode is untouched.
 *
 * Palette (Codex dark, approximated): near-black base #0a0a0a, layered
 * panels #111/#151515/#1a1a1a, hairline borders on the #222→#3a ramp, text
 * #e8e8e8/#9c9c9c/#707070, accent blue #4d8fff.
 */

/* ── Design-token override: Codex palette ─────────────────────────────── */
body[data-ds-dark-theme] {
  /* Neutral bluish ramp (the alias layer's fuel). */
  --dsw-static-neutral-bluish-1000: #0a0a0a;
  --dsw-static-neutral-bluish-950: #0a0a0a;
  --dsw-static-neutral-bluish-900: #0d0d0d;
  --dsw-static-neutral-bluish-875: #111111;
  --dsw-static-neutral-bluish-850: #151515;
  --dsw-static-neutral-bluish-800: #1a1a1a;
  --dsw-static-neutral-bluish-750: #2e2e2e;
  --dsw-static-neutral-bluish-700: #9c9c9c;
  --dsw-static-neutral-bluish-600: #707070;
  --dsw-static-neutral-bluish-500: #666666;
  --dsw-static-neutral-bluish-400: #5a5a5a;
  --dsw-static-neutral-bluish-300: #505050;
  --dsw-static-neutral-bluish-200: #454545;
  --dsw-static-neutral-bluish-100: #e8e8e8;
  --dsw-static-neutral-bluish-75: #1e1e1e;
  --dsw-static-neutral-bluish-50: #e8e8e8;
  --dsw-static-neutral-bluish-60: #1a1a1a;

  /* Neutral ramp used by a few components directly. */
  --dsw-static-neutral-1000: #0a0a0a;
  --dsw-static-neutral-900: #0d0d0d;
  --dsw-static-neutral-800: #1a1a1a;
  --dsw-static-neutral-750: #222222;
  --dsw-static-neutral-700: #2e2e2e;
  --dsw-static-neutral-600: #3a3a3a;
  --dsw-static-neutral-500: #454545;
  --dsw-static-neutral-400: #5a5a5a;
  --dsw-static-neutral-300: #707070;
  --dsw-static-neutral-250: #9c9c9c;
  --dsw-static-neutral-200: #c0c0c0;
  --dsw-static-neutral-150: #e8e8e8;
  --dsw-static-neutral-100: #f0f0f0;

  /* Brand/state blue → Codex accent. */
  --dsw-static-deepseek-400: #4d8fff;
  --dsw-static-deepseek-450: #5b96ff;
  --dsw-static-deepseek-500: #3b82f6;
  --dsw-static-deepseek-600: #2f6fe0;
  --dsw-static-deepseek-100: #16335f;
  --dsw-static-deepseek-200: #1d3f75;
  --dsw-static-deepseek-300: #27508f;
  --dsw-static-deepseek-50: #0f1f3a;
  --dsw-static-blue-500: #3b82f6;
  --dsw-static-blue-600: #2f6fe0;
  --dsw-static-blue-450: #4d8fff;

  /* Success/warn/error → Codex (GitHub-dark-like) hues. */
  --dsw-static-green-400: #3fb950;
  --dsw-static-green-500: #2ea043;
  --dsw-static-amber-500: #d29922;
  --dsw-static-red-400: #f85149;
  --dsw-static-red-500: #f85149;

  /* Borders: alias level for components that read it directly. */
  --dsw-alias-border-l1: rgba(255, 255, 255, 0.06);
  --dsw-alias-border-l2-darkmode-thin: rgba(255, 255, 255, 0.06);
  --dsw-alias-border-l2: rgba(255, 255, 255, 0.09);
  --dsw-alias-border-l3: rgba(255, 255, 255, 0.13);
  --dsw-alias-border-l4: rgba(255, 255, 255, 0.18);
  --dsw-alias-border-inverted: rgba(255, 255, 255, 0.06);
  --dsw-alias-border-inverted2: rgba(255, 255, 255, 0.08);
}

/* Slim Codex-style scrollbars. */
body[data-ds-dark-theme] {
  --dsw-alias-scrollbar-bg-l2: rgba(255, 255, 255, 0.04);
  --dsw-alias-scrollbar-hover-l2: rgba(255, 255, 255, 0.1);
  --dsw-alias-scrollbar-bg-l3: rgba(255, 255, 255, 0.04);
  --dsw-alias-scrollbar-hover-l3: rgba(255, 255, 255, 0.1);
}

/* ── Light-mode Codex palette ────────────────────────────────────────────
 * Codex light: white canvas, #f1f3f9 sidebar, #26292e text, hairline
 * borders, blue accent. Overrides the same static token fuel so the alias
 * layer inherits it app-wide; dark mode stays on the block above. */
body:not([data-ds-dark-theme]) {
  --dsw-static-neutral-bluish-1000: #26292e;
  --dsw-static-neutral-bluish-950: #2b2f36;
  --dsw-static-neutral-bluish-900: #33373e;
  --dsw-static-neutral-bluish-875: #ffffff;
  --dsw-static-neutral-bluish-850: #ffffff;
  --dsw-static-neutral-bluish-800: #ffffff;
  --dsw-static-neutral-bluish-750: #8a8f96;
  --dsw-static-neutral-bluish-700: #5e6268;
  --dsw-static-neutral-bluish-600: #8a8f96;
  --dsw-static-neutral-bluish-500: #9ba0a6;
  --dsw-static-neutral-bluish-400: #aeb2b8;
  --dsw-static-neutral-bluish-300: #c3c6ca;
  --dsw-static-neutral-bluish-200: #d4d7db;
  --dsw-static-neutral-bluish-100: #dfe3ea;
  --dsw-static-neutral-bluish-75: #e4e7ee;
  --dsw-static-neutral-bluish-60: #e9ecf1;
  --dsw-static-neutral-bluish-50: #f1f3f9;
  --dsw-static-neutral-bluish-00: #ffffff;

  --dsw-static-neutral-1000: #26292e;
  --dsw-static-neutral-900: #2b2f36;
  --dsw-static-neutral-800: #33373e;
  --dsw-static-neutral-700: #3c4046;
  --dsw-static-neutral-600: #5e6268;
  --dsw-static-neutral-500: #8a8f96;
  --dsw-static-neutral-400: #aeb2b8;
  --dsw-static-neutral-300: #c3c6ca;
  --dsw-static-neutral-250: #d4d7db;
  --dsw-static-neutral-200: #dfe3ea;
  --dsw-static-neutral-150: #e4e7ee;
  --dsw-static-neutral-100: #e9ecf1;

  /* Brand/state blue → Codex accent (light). */
  --dsw-static-deepseek-400: #3b82f6;
  --dsw-static-deepseek-450: #4d8fff;
  --dsw-static-deepseek-500: #2563eb;
  --dsw-static-deepseek-600: #1d4ed8;
  --dsw-static-deepseek-100: #dbeafe;
  --dsw-static-deepseek-200: #bfdbfe;
  --dsw-static-deepseek-300: #93c5fd;
  --dsw-static-deepseek-50: #eff6ff;
  --dsw-static-blue-500: #3b82f6;
  --dsw-static-blue-600: #2563eb;
  --dsw-static-blue-450: #4d8fff;

  --dsw-static-green-400: #16a34a;
  --dsw-static-green-500: #15803d;
  --dsw-static-amber-500: #d97706;
  --dsw-static-red-400: #dc2626;
  --dsw-static-red-500: #dc2626;

  --dsw-alias-border-l1: rgba(0, 0, 0, 0.06);
  --dsw-alias-border-l2-darkmode-thin: rgba(0, 0, 0, 0.06);
  --dsw-alias-border-l2: rgba(0, 0, 0, 0.09);
  --dsw-alias-border-l3: rgba(0, 0, 0, 0.13);
  --dsw-alias-border-l4: rgba(0, 0, 0, 0.18);
  --dsw-alias-border-inverted: rgba(0, 0, 0, 0.06);
  --dsw-alias-border-inverted2: rgba(0, 0, 0, 0.08);

  --dsw-alias-scrollbar-bg-l2: rgba(0, 0, 0, 0.06);
  --dsw-alias-scrollbar-hover-l2: rgba(0, 0, 0, 0.14);
  --dsw-alias-scrollbar-bg-l3: rgba(0, 0, 0, 0.06);
  --dsw-alias-scrollbar-hover-l3: rgba(0, 0, 0, 0.14);
}

/* ── Codex Files panel ────────────────────────────────────────────────── */

.cfx-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
  container-type: inline-size;
}

.cfx-panel-resize-handle {
  position: absolute;
  z-index: 30;
  top: 0;
  bottom: 0;
  left: 0;
  width: 16px;
  transform: translateX(-8px);
  border: 0;
  outline: none;
  cursor: ew-resize;
  touch-action: none;
}

.cfx-panel-resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7.5px;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--dsw-alias-border-l4) 12%, var(--dsw-alias-border-l4) 88%, transparent);
  opacity: 0;
  transition: opacity 120ms ease;
}

.cfx-panel-resize-handle:hover::after,
.cfx-panel-resize-handle:focus-visible::after,
[data-codex-files-right-panel-resizing] .cfx-panel-resize-handle::after {
  opacity: 1;
}

.cfx-panel-expanded {
  height: 100%;
}

.cfx-native-tabs {
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow-x: auto;
  scrollbar-width: none;
  flex: none;
}

.cfx-native-tabs::-webkit-scrollbar {
  display: none;
}

.cfx-native-tab {
  min-width: 0;
  max-width: 220px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  flex: 0 1 auto;
}

.cfx-native-tab:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}

.cfx-native-tab-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-native-tab > svg {
  flex: none;
}

.cfx-native-tab-add {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}

.cfx-native-tab-add:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-file-type-mark {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-state-business-primary);
  font: 700 7px/1 var(--ds-font-family-code);
}

.cfx-files-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 36%);
  background: var(--dsw-alias-bg-base);
}

.cfx-editor-pane,
.cfx-explorer-pane {
  min-width: 0;
  min-height: 0;
}

.cfx-editor-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cfx-explorer-pane {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}

.cfx-explorer-header {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.cfx-explorer-header > span:first-of-type {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.cfx-explorer-header > span:last-child {
  flex: none;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
}

.cfx-file-home {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 18px;
}

.cfx-file-home-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 600;
}

.cfx-file-home-title > span:last-child {
  color: var(--dsw-alias-label-caption);
  font-weight: 400;
}

@container (max-width: 899px) {
  .cfx-files-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .cfx-files-workspace:not(.cfx-files-workspace-has-file) .cfx-editor-pane,
  .cfx-files-workspace-has-file .cfx-explorer-pane {
    display: none;
  }
}

/* The host keeps a separate 300–520px details preference and places its
   visible pill from that stale value. Codex owns the actual edge and stores a
   normalized width, so hide only the host handle and solve the tracks here. */
[data-codex-files-frame] > [data-side='details'] {
  display: none !important;
}

/* DSH keeps the details React tree mounted at a zero-width track. Without
   clipping, the empty-state action list overflows hundreds of pixels back
   into the conversation after the user closes the panel. */
[data-codex-files-frame][data-details-collapsed] > :nth-child(3) {
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
}

[data-codex-files-frame]:not([data-details-collapsed]):not([data-codex-files-layout-expanded]) {
  grid-template-columns: var(--cfx-sidebar-width, 280px) minmax(0, 1fr) var(--cfx-right-panel-width, 600px) !important;
}

.cfx-summary-card {
  position: absolute;
  z-index: 40;
  top: 74px;
  right: 18px;
  display: block;
  width: min(316px, calc(100% - 36px));
  max-height: calc(100% - 96px);
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 18px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  box-shadow: 0 10px 28px var(--dsw-alias-bg-mask-2, rgba(0, 0, 0, 0.12));
  pointer-events: auto;
  scrollbar-width: none;
}

[data-codex-files-frame]:not([data-details-collapsed]) .cfx-summary-card {
  right: calc(var(--cfx-right-panel-width, 600px) + 18px);
}

.cfx-summary-card-overlay {
  box-shadow: 0 18px 48px var(--dsw-alias-bg-mask-2, rgba(0, 0, 0, 0.16));
}

.cfx-summary-card::-webkit-scrollbar {
  display: none;
}

.cfx-summary-section {
  padding: 16px 18px 14px;
}

.cfx-summary-section-divided {
  position: relative;
  padding-top: 15px;
}

.cfx-summary-section-divided::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18px;
  right: 18px;
  height: 1px;
  background: var(--dsw-alias-border-l1);
}

.cfx-summary-heading {
  min-height: 26px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 13px;
}

.cfx-summary-heading > span {
  flex: 1;
  min-width: 0;
}

.cfx-summary-heading > button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}

.cfx-summary-heading > button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-summary-heading > button svg {
  width: 16px;
  height: 16px;
}

.cfx-summary-rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cfx-summary-row,
.cfx-summary-source,
.cfx-summary-show-all {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
}

.cfx-summary-row {
  width: 100%;
  padding: 0 2px;
}

.cfx-summary-row-button,
.cfx-summary-source,
.cfx-summary-show-all {
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.cfx-summary-row-button {
  padding: 0 2px;
}

.cfx-summary-row-button:hover,
.cfx-summary-source:hover,
.cfx-summary-show-all:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-summary-row > svg,
.cfx-summary-show-all > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-summary-row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cfx-summary-row-meta {
  max-width: 42%;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cfx-summary-row-muted {
  color: var(--dsw-alias-label-caption);
}

.cfx-summary-chevron {
  width: 14px !important;
  height: 14px !important;
}

.cfx-summary-source,
.cfx-summary-show-all {
  width: 100%;
  padding: 2px;
}

.cfx-summary-source > span:last-child,
.cfx-summary-show-all > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cfx-summary-source-mark {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  display: grid;
  place-items: center;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-caption);
  font: 700 7px/1 var(--ds-font-family-code);
}

.cfx-workbench-new-tab {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  overflow: auto;
  background: var(--dsw-alias-bg-base);
}

.cfx-launcher-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 576px;
  min-height: 40px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 2.5%, transparent);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.cfx-launcher-action:hover,
.cfx-launcher-action:focus-visible,
.cfx-launcher-action-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  outline: none;
}

.cfx-launcher-action > svg {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-launcher-action > span {
  flex: 1;
}

.cfx-launcher-action kbd {
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  color: var(--dsw-alias-label-caption);
  font: 11px/18px var(--ds-font-family-code);
}

[data-codex-files-layout-expanded] {
  grid-template-columns: var(--cfx-sidebar-width, 280px) 0 minmax(0, 1fr) !important;
}

[data-codex-files-layout-expanded] [data-side='details'] {
  display: none !important;
}

.cfx-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.cfx-count {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
  border-radius: 999px;
  padding: 0 7px;
  line-height: 18px;
}

.cfx-spacer {
  flex: 1;
}

.cfx-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background 120ms var(--ds-ease-in-out), color 120ms var(--ds-ease-in-out);
}

.cfx-icon-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-icon-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.cfx-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cfx-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  width: 100%;
  font: inherit;
  transition: background 120ms var(--ds-ease-in-out);
}

.cfx-file-row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-file-row:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}

.cfx-file-icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-file-meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.cfx-file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-file-dir {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-file-op {
  flex: none;
  font-size: 10px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  font-weight: 600;
}

.cfx-file-op-write,
.cfx-file-op-edit {
  color: #d29922;
  background: rgba(210, 153, 34, 0.14);
}

.cfx-file-op-read {
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px 20px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-empty-icon {
  width: 28px;
  height: 28px;
  opacity: 0.5;
  margin-bottom: 4px;
}

.cfx-empty-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

.cfx-empty-hint {
  font-size: 12px;
}

/* ── File view: tabs + toolbar + content ── */

.cfx-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 6px 6px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  overflow-x: auto;
  scrollbar-width: none;
  flex: none;
}

.cfx-tabs::-webkit-scrollbar {
  display: none;
}

.cfx-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
  padding: 5px 8px;
  border: none;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  flex: none;
  transition: background 120ms var(--ds-ease-in-out), color 120ms var(--ds-ease-in-out);
}

.cfx-tab:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}

.cfx-tab-active {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

.cfx-tab-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  flex: none;
}

.cfx-tab-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-fileview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cfx-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-path {
  flex: 1;
  min-width: 0;
  font-family: var(--ds-font-family-code);
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
}

.cfx-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  flex: none;
  transition: background 120ms var(--ds-ease-in-out), border-color 120ms var(--ds-ease-in-out), color 120ms var(--ds-ease-in-out);
}

.cfx-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.cfx-btn-primary {
  background: var(--dsw-alias-state-business-primary);
  border-color: transparent;
  color: #ffffff;
}

.cfx-btn-primary:hover {
  background: var(--dsw-static-deepseek-500);
  color: #ffffff;
}

.cfx-btn-danger {
  color: var(--dsw-alias-label-error);
}

.cfx-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
}

.cfx-content .code-block {
  min-width: 100%;
}

.cfx-editor {
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code);
  font-size: 12.5px;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  box-sizing: border-box;
}

.cfx-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
  flex: none;
}

.cfx-status-dirty {
  color: #d29922;
}

.cfx-status-error {
  color: var(--dsw-alias-label-error);
}

.cfx-loading,
.cfx-error {
  padding: 24px 16px;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-error {
  color: var(--dsw-alias-label-error);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.cfx-reload-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}

/* Header toggle (session header action row). */
.cfx-header-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background 120ms var(--ds-ease-in-out), color 120ms var(--ds-ease-in-out);
}

.cfx-header-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-header-toggle-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* The left-sidebar panel glyph mirrored for the right column. */
.cfx-panel-right-icon {
  display: block;
  transform: scaleX(-1);
}

/* Unsaved-draft dot on a file tab. */
.cfx-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d29922;
  flex: none;
}

/* +N/-M change totals on a file row. */
.cfx-file-totals {
  flex: none;
  display: inline-flex;
  gap: 5px;
  font-family: var(--ds-font-family-code);
  font-size: 10.5px;
  font-weight: 600;
}

.cfx-file-added {
  color: #16a34a;
}

.cfx-file-removed {
  color: #dc2626;
}

body[data-ds-dark-theme] .cfx-file-added {
  color: #3fb950;
}

body[data-ds-dark-theme] .cfx-file-removed {
  color: #f85149;
}

/* Selected state of the Diff/Content toggle. */
.cfx-btn-selected {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l3);
}

/* Diff view body. */
.cfx-diff {
  padding: 2px 0 8px;
}

/* Status strip: git branch + repo, Codex-style. */
.cfx-branch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  padding: 1px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-repo {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Light-mode panel polish: sidebar and composer Codex accents ─────────
 * The app shell reads the alias layer above; these target the sidebar fill
 * and the composer surface to match Codex light (soft sidebar, clean
 * rounded input). */
body:not([data-ds-dark-theme]) [data-slot="sidebar"] {
  background: #f1f3f9;
}

body[data-ds-dark-theme] [data-slot="sidebar"] {
  background: #0d0d0d;
}

/* ── View tabs (Workspace / Activity) ─────────────────────────────────── */
.cfx-viewtabs {
  display: flex;
  gap: 2px;
  padding: 0 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-viewtab {
  padding: 7px 10px 6px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms var(--ds-ease-in-out), border-color 120ms var(--ds-ease-in-out);
}

.cfx-viewtab:hover {
  color: var(--dsw-alias-label-secondary);
}

.cfx-viewtab-active {
  color: var(--dsw-alias-label-primary);
  border-bottom-color: var(--dsw-alias-state-business-primary);
}

/* ── Workspace file tree ───────────────────────────────────────────────── */
.cfx-filetree {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cfx-tree-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 8px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  color: var(--dsw-alias-label-tertiary);
  flex: none;
}

.cfx-tree-search:focus-within {
  border-color: var(--dsw-alias-state-business-primary);
}

.cfx-tree-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}

.cfx-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 8px;
}

.cfx-tree-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding-top: 4.5px;
  padding-bottom: 4.5px;
  padding-right: 8px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;
  transition: background 100ms var(--ds-ease-in-out);
}

.cfx-tree-row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-tree-caret {
  flex: none;
  width: 10px;
  height: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
  transition: transform 120ms var(--ds-ease-in-out);
}

.cfx-tree-caret-open {
  transform: rotate(90deg);
}

.cfx-tree-row > svg {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-tree-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-tree-status {
  flex: none;
  font-family: var(--ds-font-family-code);
  font-size: 10px;
  font-weight: 700;
  min-width: 14px;
  text-align: center;
  border-radius: 4px;
  line-height: 15px;
}

.cfx-git-m { color: #b45309; background: rgba(217, 119, 6, 0.14); }
.cfx-git-a { color: #15803d; background: rgba(22, 163, 74, 0.14); }
.cfx-git-d { color: #b91c1c; background: rgba(220, 38, 38, 0.14); }
.cfx-git-r { color: #6d28d9; background: rgba(124, 58, 237, 0.14); }
.cfx-git-u { color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-interactive-bg-hover); }

body[data-ds-dark-theme] .cfx-git-m { color: #d29922; background: rgba(210, 153, 34, 0.16); }
body[data-ds-dark-theme] .cfx-git-a { color: #3fb950; background: rgba(63, 185, 80, 0.16); }
body[data-ds-dark-theme] .cfx-git-d { color: #f85149; background: rgba(248, 81, 73, 0.16); }
body[data-ds-dark-theme] .cfx-git-r { color: #a78bfa; background: rgba(167, 139, 250, 0.16); }

.cfx-tree-loading {
  cursor: default;
  color: var(--dsw-alias-label-tertiary);
  padding-left: 10px !important;
}

.cfx-tree-error {
  cursor: default;
  gap: 10px;
}

.cfx-tree-error .cfx-tree-name {
  flex: 1;
  color: var(--dsw-alias-label-error);
}

/* ── Empty-state hint card (Codex welcome posture) ────────────────────── */
.cfx-hints {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cfx-hint-row {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}

.cfx-hint-row kbd {
  display: inline-block;
  padding: 1px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1);
  font-family: var(--ds-font-family-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-primary);
}

/* ── Multi-format previews ─────────────────────────────────────────────── */
.cfx-md-preview {
  padding: 14px 16px 24px;
  overflow: auto;
}

.cfx-html-preview {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}

body[data-ds-dark-theme] .cfx-html-preview {
  background: #ffffff;
}

.cfx-binary-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--dsw-alias-bg-base);
}

.cfx-image-wrap {
  height: 100%;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
}

.cfx-image {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l1);
}

.cfx-audio {
  width: calc(100% - 24px);
  margin: 12px;
}

.cfx-binary-loading {
  padding: 24px 16px;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-binary-error {
  color: var(--dsw-alias-label-error);
}

.cfx-office-text {
  margin: 0;
  padding: 14px 16px 24px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dsw-font-family);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--dsw-alias-label-primary);
}

/* ── PDF canvas preview ────────────────────────────────────────────────── */
.cfx-pdf-wrap {
  height: 100%;
  overflow: auto;
  padding: 12px;
  box-sizing: border-box;
}

.cfx-pdf-pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.cfx-pdf-page {
  position: relative;
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l2), 0 2px 10px rgba(0, 0, 0, 0.12);
  border-radius: 3px;
  overflow: hidden;
  max-width: 100%;
  width: fit-content;
}

.cfx-pdf-page img {
  display: block;
  max-width: 100%;
  height: auto;
}

.cfx-pdf-page-number {
  position: absolute;
  bottom: 6px;
  right: 10px;
  font-size: 10.5px;
  font-weight: 600;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  padding: 1px 8px;
}

.cfx-pdf-truncated {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-pdf-reloading {
  position: sticky;
  bottom: 10px;
  width: max-content;
  margin: 0 auto;
  padding: 4px 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

/* ── CSV table preview ─────────────────────────────────────────────────── */
.cfx-csv-wrap {
  height: 100%;
  overflow: auto;
  padding: 12px;
  box-sizing: border-box;
}

.cfx-csv-table {
  border-collapse: collapse;
  font-size: 12px;
  font-family: var(--ds-font-family-code);
  min-width: 100%;
}

.cfx-csv-table td {
  border: 1px solid var(--dsw-alias-border-l1);
  padding: 3px 9px;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}

.cfx-csv-table tr:nth-child(even) td {
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-csv-truncated {
  padding: 10px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}

/* ── Codex workbench chrome ──────────────────────────────────────────── */
.cfx-icon-button-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-workbench-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 6px 6px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-workbench-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 52px;
  padding: 5px 8px;
  border: none;
  border-radius: 8px 8px 0 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: color 120ms var(--ds-ease-in-out), border-color 120ms var(--ds-ease-in-out), background 120ms var(--ds-ease-in-out);
}

.cfx-workbench-tab:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}

.cfx-workbench-tab-active {
  color: var(--dsw-alias-label-primary);
  border-bottom-color: var(--dsw-alias-state-business-primary);
}

.cfx-workbench-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Review pane */
.cfx-review {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cfx-review-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-review-section {
  flex: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  max-height: 42%;
  overflow: auto;
}

.cfx-review-section-title {
  padding: 7px 8px 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--dsw-alias-label-secondary);
  position: sticky;
  top: 0;
  background: var(--dsw-alias-bg-layer-1);
  z-index: 1;
}

.cfx-review-empty {
  padding: 8px 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-review-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 6px;
}

.cfx-review-row-active {
  background: var(--dsw-alias-interactive-bg-hover);
}

.cfx-review-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.cfx-review-badge {
  flex: none;
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-family: var(--ds-font-family-code);
  font-size: 9px;
  font-weight: 800;
}

.cfx-review-badge-staged {
  color: #15803d;
  background: rgba(22, 163, 74, 0.14);
}

.cfx-review-badge-unstaged {
  color: #b45309;
  background: rgba(217, 119, 6, 0.14);
}

body[data-ds-dark-theme] .cfx-review-badge-staged {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.16);
}

body[data-ds-dark-theme] .cfx-review-badge-unstaged {
  color: #d29922;
  background: rgba(210, 153, 34, 0.16);
}

.cfx-review-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.cfx-review-commit {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.cfx-review-commit-input {
  flex: 1;
  min-width: 0;
  height: 25px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  outline: none;
}

.cfx-review-commit-input:focus {
  border-color: var(--dsw-alias-state-business-primary);
}

.cfx-review-diff {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.cfx-review-diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cfx-review-diff-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
}

.cfx-review-diff-body {
  font-size: 12px;
}

/* Embedded browser */
.cfx-browser {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cfx-browser-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.cfx-browser-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #0d0d0d);
  color: var(--dsw-alias-label-primary);
  padding: 0 9px;
  font: inherit;
  font-size: 12px;
  outline: none;
}

.cfx-browser-input:focus {
  border-color: var(--dsw-alias-state-business-primary);
}

.cfx-browser-message {
  flex: none;
  padding: 6px 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-error);
}

.cfx-browser-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}

.cfx-browser-frame {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: none;
  background: #ffffff;
}

/* Terminal surfaces */
.cfx-terminal-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 8px;
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 0;
}

.cfx-terminal {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: none;
  border-radius: 0;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: none;
}

.cfx-terminal-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font-size: 11.5px;
  box-shadow: 0 4px 16px var(--dsw-alias-bg-mask-2);
}

/* Bottom panel */
.cfx-bottom-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2);
  border-radius: 0;
  overflow: visible;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: none;
}

.cfx-bottom-panel-resize-handle {
  position: absolute;
  z-index: 30;
  top: 0;
  left: 0;
  right: 0;
  height: 16px;
  transform: translateY(-8px);
  outline: none;
  cursor: ns-resize;
  touch-action: none;
}

.cfx-bottom-panel-resize-handle::after {
  content: '';
  position: absolute;
  top: 7.5px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--dsw-alias-border-l4) 12%, var(--dsw-alias-border-l4) 88%, transparent);
  opacity: 0;
  transition: opacity 120ms ease;
}

.cfx-bottom-panel-resize-handle:hover::after,
.cfx-bottom-panel-resize-handle:focus-visible::after,
[data-codex-files-bottom-panel-resizing] .cfx-bottom-panel-resize-handle::after {
  opacity: 1;
}

[data-codex-files-bottom-panel-open] {
  grid-template-rows: minmax(0, 1fr) var(--cfx-bottom-panel-height, 280px) !important;
  transition:
    grid-template-rows var(--ds-transition-duration-slow) var(--ds-ease-in-out),
    grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out);
}

[data-codex-files-bottom-panel-open][data-codex-files-bottom-panel-resizing] {
  transition: none;
}

[data-codex-files-bottom-panel-open] > div:first-child {
  grid-row: 1 / 3;
}

[data-codex-files-bottom-panel-open] > .cfx-bottom-panel {
  grid-column: 2 / 4;
  grid-row: 2;
  min-height: 0;
  height: 100%;
}

.cfx-terminal-session-rail {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 0 0 42px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}

.cfx-terminal-session-rail-list {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 5px 8px;
  scrollbar-width: none;
}

.cfx-terminal-session-rail-list::-webkit-scrollbar {
  display: none;
}

.cfx-terminal-session {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 140px;
  max-width: 240px;
  flex: 0 1 240px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
}

.cfx-terminal-session-active {
  border-color: transparent;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-terminal-session-select {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
  height: 30px;
  padding: 0 6px 0 8px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.cfx-terminal-session-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cfx-terminal-session-status {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: var(--dsw-alias-label-tertiary);
  opacity: 0.8;
}

.cfx-terminal-session-status-active {
  color: var(--dsw-alias-label-secondary);
  opacity: 1;
}

.cfx-terminal-session-status svg {
  width: 15px;
  height: 15px;
}

.cfx-terminal-session-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 2px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.cfx-terminal-session-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-terminal-tab-add,
.cfx-terminal-panel-close {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}

.cfx-terminal-tab-add:hover,
.cfx-terminal-panel-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.cfx-terminal-panel-close {
  margin-right: 8px;
}

.cfx-bottom-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--dsw-alias-bg-layer-1);
}

.cfx-bottom-panel-terminal {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
}

.cfx-bottom-panel-terminal-hidden {
  display: none;
}

/* xterm default styles (vendored from @xterm/xterm) */
.xterm {
  cursor: text;
  position: relative;
  user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
}

.xterm.focus,
.xterm:focus {
  outline: none;
}

.xterm .xterm-helpers {
  position: absolute;
  top: 0;
  z-index: 5;
}

.xterm .xterm-helper-textarea {
  padding: 0;
  border: 0;
  margin: 0;
  position: absolute;
  opacity: 0;
  left: -9999em;
  top: 0;
  width: 0;
  height: 0;
  z-index: -5;
  white-space: nowrap;
  overflow: hidden;
  resize: none;
}

.xterm .composition-view {
  background: #000;
  color: #FFF;
  display: none;
  position: absolute;
  white-space: nowrap;
  z-index: 1;
}

.xterm .composition-view.active {
  display: block;
}

.xterm .xterm-viewport {
  background-color: transparent;
  overflow-y: scroll;
  cursor: default;
  position: absolute;
  right: 0;
  left: 0;
  top: 0;
  bottom: 0;
}

.xterm .xterm-screen {
  position: relative;
}

.xterm .xterm-screen canvas {
  position: absolute;
  left: 0;
  top: 0;
}

.xterm .xterm-scroll-area {
  visibility: hidden;
}

.xterm-char-measure-element {
  display: inline-block;
  visibility: hidden;
  position: absolute;
  top: 0;
  left: -9999em;
  line-height: normal;
}

.xterm.enable-mouse-events {
  cursor: default;
}

.xterm.xterm-cursor-pointer,
.xterm .xterm-cursor-pointer {
  cursor: pointer;
}

.xterm.column-select.focus {
  cursor: crosshair;
}

.xterm .xterm-accessibility:not(.debug),
.xterm .xterm-message {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 10;
  color: transparent;
  pointer-events: none;
}

.xterm .xterm-accessibility-tree:not(.debug) *::selection {
  color: transparent;
}

.xterm .xterm-accessibility-tree {
  user-select: text;
  white-space: pre;
}

.xterm .live-region {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.xterm-dim {
  opacity: 1 !important;
}

.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }

.xterm-overline {
  text-decoration: overline;
}

.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }

.xterm-strikethrough {
  text-decoration: line-through;
}

.xterm-screen .xterm-decoration-container .xterm-decoration {
  z-index: 6;
  position: absolute;
}

.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
  z-index: 7;
}

.xterm-decoration-overview-ruler {
  z-index: 8;
  position: absolute;
  top: 0;
  right: 0;
  pointer-events: none;
}

.xterm-decoration-top {
  z-index: 2;
  position: relative;
}

`
