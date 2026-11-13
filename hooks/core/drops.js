import { DROP_CHANCE, DROP_EVERY, MASTER_BALL_MILESTONE } from '../config.js'
import { ITEM_LIST } from '../data/items.js'
import { addItem } from './context.js'
import { chance, pickWeighted } from './rng.js'

// Drops d'items : un tirage tous les DROP_EVERY output tokens cumulés, selon une table pondérée,
// et une Master Ball garantie à chaque palier de tokens.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * Donne un item tiré dans la table de drop (ou imposé).
 * @param {Save} save
 * @param {Ctx} ctx
 * @param {string} [forcedId] pour /tokemon debug drop
 * @returns {GameEvent[]}
 */
export function dropItem(save, ctx, forcedId) {
  const id = forcedId ?? pickWeighted(ctx.rng, ITEM_LIST, (item) => item.dropWeight)?.id
  if (!id) return []
  addItem(save, id)
  save.state.stats.itemsFound += 1
  return [{ type: 'drop', item: id, count: 1, reason: 'drop' }]
}

/**
 * Ajoute les tokens du tour au compteur et tire un drop à chaque palier franchi.
 * @param {Save} save
 * @param {number} tokens
 * @param {Ctx} ctx
 * @returns {GameEvent[]}
 */
export function rollDrops(save, tokens, ctx) {
  const counters = save.state.counters
  counters.sinceDrop += tokens
  /** @type {GameEvent[]} */
  const events = []
  while (counters.sinceDrop >= DROP_EVERY) {
    counters.sinceDrop -= DROP_EVERY
    if (!save.state.starterChosen) continue
    if (chance(ctx.rng, DROP_CHANCE)) events.push(...dropItem(save, ctx))
  }
  return events
}

/**
 * Une Master Ball par palier de MASTER_BALL_MILESTONE tokens cumulés franchi pendant le tour.
 * @param {Save} save
 * @param {number} totalBefore total des output tokens avant le tour
 * @param {number} totalAfter total après le tour
 * @returns {GameEvent[]}
 */
export function milestoneDrops(save, totalBefore, totalAfter) {
  const count = Math.floor(totalAfter / MASTER_BALL_MILESTONE) - Math.floor(totalBefore / MASTER_BALL_MILESTONE)
  if (count <= 0 || !save.state.starterChosen) return []
  addItem(save, 'master-ball', count)
  save.state.stats.itemsFound += count
  return [{ type: 'drop', item: 'master-ball', count, reason: 'milestone' }]
}
