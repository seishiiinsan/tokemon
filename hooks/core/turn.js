import { SEEN_TURNS_MAX } from '../config.js'
import { expireBoosts } from './boosts.js'
import { logEvents, recordDay } from './stats.js'
import { applyTurnXp } from './xp.js'

// Orchestration d'une fin de tour : la seule porte d'entrée des output tokens dans le jeu.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * @typedef {object} TurnInput
 * @property {string} key identifiant unique du tour (turnId, préfixé par l'agent), pour la déduplication
 * @property {number} tokens output tokens du tour
 * @property {boolean} approximate vrai si `tokens` est une estimation
 */

/**
 * Entretien indépendant des tokens : fins de boosts, fuite du mon sauvage, évolution en attente.
 * Appelé à chaque tour, à chaque commande et périodiquement par l'animation.
 * @param {Save} save
 * @param {Ctx} ctx
 * @returns {GameEvent[]}
 */
export function housekeeping(save, ctx) {
  const events = [...expireBoosts(save, ctx.now)]
  logEvents(save, events, ctx.now)
  return events
}

/**
 * Vrai si l'entretien a quelque chose à faire (évite une écriture du store à chaque tick).
 * @param {Save} save
 * @param {number} now
 */
export function needsHousekeeping(save, now) {
  return save.boosts.some((boost) => boost.expiresAt <= now)
}

/**
 * Applique un tour terminé. Un tour déjà compté (même clé) est ignoré.
 * @param {Save} save
 * @param {TurnInput} turn
 * @param {Ctx} ctx
 * @returns {{ counted: boolean, xp: number, events: GameEvent[] }}
 */
export function applyTurn(save, turn, ctx) {
  const state = save.state
  if (state.seenTurns.includes(turn.key)) return { counted: false, xp: 0, events: [] }
  state.seenTurns.push(turn.key)
  if (state.seenTurns.length > SEEN_TURNS_MAX) state.seenTurns.splice(0, state.seenTurns.length - SEEN_TURNS_MAX)

  const events = housekeeping(save, ctx)
  const tokens = Math.max(0, Math.floor(turn.tokens))
  state.totals.outputTokens += tokens
  if (turn.approximate) state.totals.approximateTokens += tokens
  state.stats.turns += 1

  const gained = applyTurnXp(save, tokens, ctx.now)
  /** @type {GameEvent[]} */
  const turnEvents = [...gained.events]

  recordDay(save, tokens, gained.xp, ctx.now)
  logEvents(save, turnEvents, ctx.now)
  events.push(...turnEvents)
  return { counted: true, xp: gained.xp, events }
}
