import {
  ENCOUNTER_CHANCE,
  ENCOUNTER_EVERY,
  INCENSE_ENCOUNTER_MULTIPLIER,
  RARITIES,
  SHINY_CHANCE,
  SHINY_CHARM_MULTIPLIER,
  STAGE_WEIGHT_DIVISORS,
  WILD_DURATION_MS,
} from '../config.js'
import { formCount } from '../data/lookup.js'
import { rarityOf } from '../data/rarity.js'
import { SPECIES } from '../data/species.js'
import { hasBoost } from './boosts.js'
import { isAvailable, markDex } from './context.js'
import { chance, pickWeighted, randomInt } from './rng.js'

// Rencontres sauvages : un tirage tous les ENCOUNTER_EVERY output tokens cumulés.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * Poids de spawn d'une espèce : rareté, divisé par le stade d'évolution et par le nombre de
 * formes qui partagent son numéro de Pokédex (les 28 Zarbi pèsent ensemble comme une espèce).
 * @param {string} speciesId
 */
export function spawnWeight(speciesId) {
  const species = SPECIES[speciesId]
  if (!species) return 0
  const divisor = STAGE_WEIGHT_DIVISORS[Math.min(species.stage, STAGE_WEIGHT_DIVISORS.length) - 1]
  return RARITIES[rarityOf(speciesId)].spawnWeight / divisor / formCount(speciesId)
}

/**
 * @param {Save} save
 * @param {number} now
 */
export function encounterChance(save, now) {
  return Math.min(1, ENCOUNTER_CHANCE * (hasBoost(save, 'incense', now) ? INCENSE_ENCOUNTER_MULTIPLIER : 1))
}

/**
 * @param {Save} save
 * @param {number} now
 */
export function shinyChance(save, now) {
  return SHINY_CHANCE * (hasBoost(save, 'shiny-charm', now) ? SHINY_CHARM_MULTIPLIER : 1)
}

/**
 * Fait apparaître un mon sauvage (tiré dans le pool des sprites disponibles, ou imposé).
 * @param {Save} save
 * @param {Ctx} ctx
 * @param {{ species?: string, shiny?: boolean }} [forced] pour /tokemon debug encounter
 * @returns {GameEvent[]}
 */
export function spawnWild(save, ctx, forced = {}) {
  const pool = Object.keys(SPECIES).filter((id) => isAvailable(ctx, id))
  const species = forced.species ?? pickWeighted(ctx.rng, pool, spawnWeight)
  if (!species) return []
  const rarity = rarityOf(species)
  const shiny = forced.shiny ?? chance(ctx.rng, shinyChance(save, ctx.now))
  const [minLevel, maxLevel] = RARITIES[rarity].levelRange
  const level = randomInt(ctx.rng, minLevel, maxLevel)
  save.state.wild = {
    species,
    shiny,
    level,
    appearedAt: ctx.now,
    expiresAt: ctx.now + WILD_DURATION_MS,
    failedThrows: 0,
  }
  save.state.stats.encounters += 1
  if (shiny) save.state.stats.shinySeen += 1
  markDex(save, species, { seen: true })
  return [{ type: 'encounter', species, shiny, level, rarity }]
}

/**
 * Le mon sauvage s'enfuit une fois son temps écoulé.
 * @param {Save} save
 * @param {number} now
 * @returns {GameEvent[]}
 */
export function expireWild(save, now) {
  const wild = save.state.wild
  if (!wild || wild.expiresAt > now) return []
  save.state.wild = null
  save.state.stats.fled += 1
  return [{ type: 'fled', species: wild.species, reason: 'timeout' }]
}

/**
 * Ajoute les tokens du tour au compteur et tire une rencontre à chaque palier franchi.
 * Aucun tirage tant qu'un mon sauvage est présent ou que le starter n'est pas choisi.
 * @param {Save} save
 * @param {number} tokens
 * @param {Ctx} ctx
 * @returns {GameEvent[]}
 */
export function rollEncounters(save, tokens, ctx) {
  const counters = save.state.counters
  counters.sinceEncounter += tokens
  /** @type {GameEvent[]} */
  const events = []
  while (counters.sinceEncounter >= ENCOUNTER_EVERY) {
    counters.sinceEncounter -= ENCOUNTER_EVERY
    if (save.state.wild || !save.state.starterChosen) continue
    if (chance(ctx.rng, encounterChance(save, ctx.now))) events.push(...spawnWild(save, ctx))
  }
  return events
}
