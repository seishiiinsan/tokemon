import { EVOLUTION_DELAY_MS, SEEN_TURNS_MAX } from '../config.js'
import { checkAchievements } from './achievements.js'
import { expireBoosts } from './boosts.js'
import { milestoneDrops, rollDrops } from './drops.js'
import { expireWild, rollEncounters } from './encounter.js'
import { resolvePendingEvolution, startLevelEvolution } from './evolution.js'
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
  return settle(
    save,
    [...expireBoosts(save, ctx.now), ...expireWild(save, ctx.now), ...resolvePendingEvolution(save, ctx)],
    ctx,
  )
}

/**
 * Clôt une action ou un tour : débloque les succès que ses événements ont rendus possibles,
 * puis inscrit le tout au journal.
 * @param {Save} save
 * @param {GameEvent[]} events les événements produits jusque-là
 * @param {Ctx} ctx
 * @returns {GameEvent[]} les mêmes, suivis des succès et de leurs récompenses
 */
export function settle(save, events, ctx) {
  const all = [...events, ...checkAchievements(save, ctx.now)]
  logEvents(save, all, ctx.now)
  return all
}

/**
 * Vrai si l'entretien a quelque chose à faire (évite une écriture du store à chaque tick).
 * @param {Save} save
 * @param {number} now
 */
export function needsHousekeeping(save, now) {
  const { pendingEvolution: pending, wild } = save.state
  return (
    save.boosts.some((boost) => boost.expiresAt <= now) ||
    (wild !== null && wild.expiresAt <= now) ||
    (pending !== null && now >= pending.startedAt + EVOLUTION_DELAY_MS)
  )
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
  const totalBefore = state.totals.outputTokens
  state.totals.outputTokens += tokens
  if (turn.approximate) state.totals.approximateTokens += tokens
  state.stats.turns += 1

  const gained = applyTurnXp(save, tokens, ctx.now)
  /** @type {GameEvent[]} */
  const turnEvents = [
    ...gained.events,
    ...startLevelEvolution(save, ctx),
    ...rollEncounters(save, tokens, ctx),
    ...rollDrops(save, tokens, ctx),
    ...milestoneDrops(save, totalBefore, state.totals.outputTokens),
  ]

  recordDay(save, tokens, gained.xp, ctx.now)
  events.push(...settle(save, turnEvents, ctx))
  return { counted: true, xp: gained.xp, events }
}
