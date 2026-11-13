import { createApp } from './app.js'
import { runCommand } from './commands/index.js'
import { COMMAND_NAME } from './config.js'

// Point d'entrée du mod : routage des événements de l'hôte vers le runtime (app.js),
// rien d'autre. La logique de jeu est dans core/, le dessin dans ui/.

/** @typedef {import('./types.js').Host} Host */
/** @typedef {(e: any) => Promise<any>} Next */

/**
 * @param {(event: string, ...rest: any[]) => unknown} on
 */
export function register(on) {
  const app = createApp()

  on('session.start', async (/** @type {Host} */ $, /** @type {unknown} */ e, /** @type {Next} */ next) => {
    await app.start($)
    return next(e)
  })

  on(
    'turn.complete',
    async (/** @type {Host} */ $, /** @type {import('./types.js').TurnEvent} */ e, /** @type {Next} */ next) => {
      await app.onTurn($, e)
      return next(e)
    },
  )

  on(
    'command.run',
    { command: COMMAND_NAME },
    async (/** @type {Host} */ _$, /** @type {import('./types.js').CommandEvent} */ e) => ({
      text: await runCommand(app, e.args ?? ''),
    }),
  )

  on(
    'ui.render',
    { component: 'AbovePrompt' },
    (/** @type {Host} */ $, /** @type {import('./types.js').RenderEvent} */ e, /** @type {Next} */ next) => {
      return app.drawBand($, e) ?? next(e)
    },
  )
}
