# Codex Desktop workbench layout contract

This document records the observable layout and interaction contracts used by
`dsh-codex-files`. It intentionally contains no copied Codex source code.

## Evidence

- Installed package: `OpenAI.Codex 26.810.7004.0`
- `app.asar` SHA-256:
  `C7AC6D76CF5F30AA5CB92E1E46561933C06E94E3FE2D6582A04DAC18C76F3ED1`
- Full ASAR extraction: 8,463 files and 293,553,225 extracted bytes
- Renderer chunks inspected:
  - `app-initial-TxV8Ik1J.js`
  - `thread-app-shell-chrome-DAh0O3Ik.js`
  - `local-conversation-page-CJPDecXa.js`
  - `local-conversation-thread-DODK2h5u.js`
  - `toggle-thread-summary-panel-CVAZwbWD.js`
  - `open-sources-side-panel-tab-ChvP3Yrp.js`
  - `terminal-panel-BK67Pokf.js`

Official product documentation establishes the public Codex development
workflow but does not publish renderer pixel measurements. The installed
renderer and direct multi-size observation are therefore the implementation
source of truth for this plugin.

## Right panel

| Contract | Codex behavior | Plugin implementation |
| --- | --- | --- |
| Closed state | Panel is removed and main content immediately reclaims its width | Zero-width DSH details subtree is clipped and made non-interactive |
| Empty state | Actions render only inside an already-open panel | `WorkbenchActions` remains inside `CodexFilesPanel`; no closed-state launcher |
| Minimum width | 320px | `RIGHT_PANEL_MIN_WIDTH` |
| Close threshold | Dragging below 160px closes the panel | `RIGHT_PANEL_CLOSE_THRESHOLD` |
| Maximum width | Main content width minus 352px | `rightPanelMaximumWidth` |
| Default width | Dynamic from shell height and remaining main width | `defaultRightPanelWidth` |
| Persistence | Normalized min/max ratio, not fixed pixels | localStorage ratio with responsive recomputation |
| Resize target | 16px invisible hit area on the actual left edge | `.cfx-panel-resize-handle` |
| Resize decoration | 1px line visible only on hover, focus, or drag | CSS pseudo-element; no pill |
| Double click | Restore dynamic default | `resetRightPanelWidth` |
| Full width | Uses all width after the independent left sidebar | Three-column override: sidebar / 0 / panel |

The DSH host keeps a separate 300–520px details preference. Its stock handle
must stay hidden because its position no longer represents the rendered Codex
panel edge.

## Sidebar linkage

The DSH frame writes its intended column widths into the inline
`grid-template-columns`. Reading the rendered sidebar box after applying a
full-width override creates a feedback loop. The plugin parses the first inline
pixel track (normally 280px or 56px), observes frame size/attributes/style, and
recomputes the right panel from the resulting main-content width.

## Summary

The summary is independent from the right panel. Its width is 316px and the
display mode is derived from the available main-content target width:

| Available width | Mode | Behavior |
| ---: | --- | --- |
| `< 1096px` | overlay | Header entry opens a popover; no reserved space |
| `1096–1535px` | shift | Header entry pins/unpins the inline summary |
| `>= 1536px` | gutter | Header entry pins/unpins the gutter summary |

This width-derived state machine is used for maximized and restored windows;
there is no separate “maximized” breakpoint. The entry remains available in
all modes.

## Bottom terminal

| Contract | Value |
| --- | ---: |
| Default height | 280px |
| Minimum height | 160px |
| Maximum height | 50% of shell height |
| Close threshold | 80px |
| Resize target | 16px invisible hit area at the top edge |

The terminal spans the conversation and right-panel columns while excluding
the left sidebar. Height is persisted in pixels and clamped again against the
current shell height.

## Regression matrix

- Right panel open, close, resize, reset, and full-width restore
- Left sidebar 280px and collapsed 56px while the right panel is open/full
- Restored and maximized window widths across summary mode boundaries
- Right-panel closed state with no overflowing empty-state actions
- Bottom terminal default, minimum, maximum, close-threshold, and persistence
- Keyboard shortcuts: Review, Terminal, Browser, and Files
