import { COMMAND_NAME } from './config.js'
import { getOutputTokens } from './tokens/index.js'

// Point d'entrée du mod : routage des événements de l'hôte uniquement.
// Lot 0 : la commande est enregistrée et chaque fin de tour mesure ses output tokens.

/** @typedef {import('./types.js').Host} Host */

/** @type {import('./tokens/index.js').TokenReading | null} */
let lastReading = null

/**
 * @param {(event: string, ...rest: any[]) => unknown} on
 */
export function register(on) {
  on('session.start', async (/** @type {Host} */ $, /** @type {unknown} */ e, /** @type {Function} */ next) => {
    await $.command.register({
      name: COMMAND_NAME,
      description: 'Tokemon : ton compagnon Pokémon nourri aux output tokens',
    })
    return next(e)
  })

  on(
    'turn.complete',
    async (/** @type {Host} */ $, /** @type {import('./types.js').TurnEvent} */ e, /** @type {Function} */ next) => {
      lastReading = await getOutputTokens(e, { now: await $.clock.now() })
      return next(e)
    },
  )

  on('command.run', { command: COMMAND_NAME }, async () => ({
    text: lastReading
      ? `Dernier tour : ${lastReading.approximate ? '≈ ' : ''}${lastReading.tokens} output tokens (source : ${lastReading.source}).`
      : 'Tokemon est chargé. Aucun tour mesuré pour le moment.',
  }))
}
