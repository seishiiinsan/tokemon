import { BALL_MULTIPLIERS, RARITIES, WILD_MAX_FAILED_THROWS } from '../config.js'
import { BALL_ORDER, findItem, ITEMS } from '../data/items.js'
import { speciesName } from '../data/lookup.js'
import { rarityOf } from '../data/rarity.js'
import { addMon, done, fail, takeItem } from './context.js'
import { chance } from './rng.js'

// Capture : probabilité = taux de base de la rareté × multiplicateur de la Ball, plafonnée à 100 %.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./context.js').ActionResult} ActionResult */

/**
 * @param {import('../config.js').Rarity} rarity
 * @param {string} ballId
 * @returns {number} probabilité de capture, entre 0 et 1
 */
export function captureChance(rarity, ballId) {
  const multiplier = /** @type {Record<string, number>} */ (BALL_MULTIPLIERS)[ballId] ?? 0
  return Math.min(1, RARITIES[rarity].catchRate * multiplier)
}

/**
 * /tokemon catch [ball] : lance une Ball sur le mon sauvage.
 * Sans précision, la Ball la plus simple du sac est utilisée.
 * @param {Save} save
 * @param {string} ballQuery
 * @param {Ctx} ctx
 * @returns {ActionResult}
 */
export function throwBall(save, ballQuery, ctx) {
  const wild = save.state.wild
  if (!wild) return fail('Aucun Pokémon sauvage en vue.')
  let ballId
  if (ballQuery.trim()) {
    const item = findItem(ballQuery) ?? findItem(ballQuery + 'ball')
    if (!item || item.kind !== 'ball')
      return fail(`« ${ballQuery.trim()} » n'est pas une Ball. Essaie : poke, super, hyper, master.`)
    ballId = item.id
  } else {
    ballId = BALL_ORDER.find((id) => (save.bag[id] ?? 0) > 0)
    if (!ballId) return fail("Tu n'as plus de Ball ! Elles tombent au fil des tokens.")
  }
  if (!takeItem(save, ballId)) return fail(`Tu n'as pas de ${ITEMS[ballId].name}.`)
  const stats = save.state.stats
  stats.throws += 1
  stats.itemsUsed += 1
  if (ballId === 'master-ball') stats.masterBallsUsed += 1

  if (chance(ctx.rng, captureChance(rarityOf(wild.species), ballId))) {
    const mon = addMon(save, { species: wild.species, level: wild.level, shiny: wild.shiny }, ctx.now)
    save.state.wild = null
    stats.captures += 1
    if (wild.shiny) stats.shinyCaught += 1
    return done(
      `Et hop ! ${speciesName(wild.species)}${wild.shiny ? ' ✨' : ''} (niv. ${wild.level}) rejoint ta box.`,
      [{ type: 'captured', species: wild.species, shiny: wild.shiny, level: wild.level, ball: ballId, monId: mon.id }],
    )
  }

  wild.failedThrows += 1
  const left = WILD_MAX_FAILED_THROWS - wild.failedThrows
  /** @type {import('./events.js').GameEvent[]} */
  const events = [{ type: 'throw-failed', species: wild.species, ball: ballId, left: Math.max(0, left) }]
  if (left > 0)
    return done(`Raté ! ${speciesName(wild.species)} s'est libéré. Encore ${left} essai${left > 1 ? 's' : ''}.`, events)
  save.state.wild = null
  stats.fled += 1
  events.push({ type: 'fled', species: wild.species, reason: 'throws' })
  return done(`Raté ! ${speciesName(wild.species)} s'enfuit.`, events)
}
