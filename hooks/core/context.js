import { speciesName } from '../data/lookup.js'
import { SPECIES } from '../data/species.js'
import { xpForLevel } from './levels.js'

// Contexte injecté dans le core (aléa, horloge, sprites disponibles) et accès de base à la box.
// Convention du core : aucune E/S, aucun accès à `$`, à Date.now() ni à Math.random().
// Les fonctions modifient le `Save` qu'on leur passe (toujours relu du store juste avant par
// store/repo.js) et renvoient les événements de jeu produits.

/**
 * @typedef {object} Ctx
 * @property {import('./rng.js').Rng} rng
 * @property {number} now horodatage courant (ms)
 * @property {(speciesId: string) => boolean} [available] vrai si les sprites de l'espèce sont en local
 */

/** @typedef {import('../store/schema.js').Save} Save */
/** @typedef {import('../store/schema.js').Mon} Mon */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * Résultat d'une action déclenchée par une commande.
 * @typedef {object} ActionResult
 * @property {boolean} ok
 * @property {string} message ligne affichée en réponse à la commande
 * @property {GameEvent[]} events
 */

/**
 * @param {string} message
 * @returns {ActionResult}
 */
export const fail = (message) => ({ ok: false, message, events: [] })

/**
 * @param {string} message
 * @param {GameEvent[]} [events]
 * @returns {ActionResult}
 */
export const done = (message, events = []) => ({ ok: true, message, events })

/**
 * @param {Ctx} ctx
 * @param {string} speciesId
 */
export const isAvailable = (ctx, speciesId) => (speciesId in SPECIES ? (ctx.available?.(speciesId) ?? true) : false)

/** @param {Mon} mon */
export const monName = (mon) => mon.nickname ?? speciesName(mon.species)

/**
 * @param {Save} save
 * @returns {Mon | undefined}
 */
export const activeMon = (save) => save.box.find((mon) => mon.id === save.state.activeMonId)

/**
 * Ajoute un mon à la box et le marque capturé dans le Pokédex.
 * @param {Save} save
 * @param {{ species: string, level: number, shiny?: boolean }} spec
 * @param {number} now
 * @returns {Mon}
 */
export function addMon(save, { species, level, shiny = false }, now) {
  /** @type {Mon} */
  const mon = {
    id: save.state.nextMonId++,
    species,
    nickname: null,
    level,
    xp: xpForLevel(level),
    shiny,
    caughtAt: now,
  }
  save.box.push(mon)
  markDex(save, species, { caught: true, shiny })
  return mon
}

/**
 * @param {Save} save
 * @param {string} species
 * @param {{ seen?: boolean, caught?: boolean, shiny?: boolean }} what
 */
export function markDex(save, species, { seen = false, caught = false, shiny = false }) {
  const entry = (save.dex[species] ??= { seen: 0, caught: 0, shiny: 0 })
  if (seen) entry.seen += 1
  // Un mon obtenu sans rencontre (starter, évolution) compte aussi comme vu
  if (caught && entry.seen === 0) entry.seen = 1
  if (caught) entry.caught += 1
  if (caught && shiny) entry.shiny += 1
}

/**
 * @param {Save} save
 * @param {string} itemId
 * @param {number} [count]
 */
export function addItem(save, itemId, count = 1) {
  save.bag[itemId] = (save.bag[itemId] ?? 0) + count
}

/**
 * @param {Save} save
 * @param {string} itemId
 * @returns {boolean} faux si le sac n'en contient pas
 */
export function takeItem(save, itemId) {
  const have = save.bag[itemId] ?? 0
  if (have <= 0) return false
  if (have === 1) delete save.bag[itemId]
  else save.bag[itemId] = have - 1
  return true
}
