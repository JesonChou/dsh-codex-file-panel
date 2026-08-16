/**
 * Minimal dsh bundle plugin. It logs once on load and registers a dispose
 * effect, demonstrating the two rules every plugin follows:
 *
 * - a plugin is a named module exporting `apply(ctx)`;
 * - registrations are reversible effects.
 *
 * For real work, replace `PluginContext` with the framework type:
 *   import type { Context } from '@deepseek-ai/cordis'
 * and declare service dependencies with `export const inject = [...]`.
 */
export const name = 'hello-plugin'

/** A deliberately minimal context view; real plugins use the cordis Context. */
export interface PluginContext {
  effect: (callback: () => () => void, label?: string) => () => void
}

export function apply(ctx: PluginContext): void {
  console.log('[hello-plugin] loaded')
  ctx.effect(() => () => {
    console.log('[hello-plugin] unloaded')
  }, 'hello-plugin: greeting')
}
