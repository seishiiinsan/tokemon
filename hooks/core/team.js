import { NICKNAME_MAX_LENGTH, STARTER_BAG, STARTER_LEVEL, STARTERS } from '../config.js'
import { normalize } from '../data/items.js'
import { findSpecies, speciesName } from '../data/lookup.js'
import { activeMon, addItem, addMon, done, fail, monName } from './context.js'

// Starter, changement de mon actif, surnom et variante d'affichage.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Mon} Mon */
/** @typedef {import('./context.js').ActionResult} ActionResult */

/**
 * @param {Save} save
 * @param {string} query
 * @param {number} now
 * @returns {ActionResult}
 */
export function chooseStarter(save, query, now) {
  if (save.state.starterChosen) return fail('Tu as déjà choisi ton starter. /tokemon switch pour changer de compagnon.')
  const species = findSpecies(query)
  if (!species || !STARTERS.includes(species)) {
    return fail(
      `Choisis ton starter : ${STARTERS.map((id) => speciesName(id)).join(', ')}. Exemple : /tokemon start ${speciesName(STARTERS[0])}`,
    )
  }
  const mon = addMon(save, { species, level: STARTER_LEVEL }, now)
  save.state.activeMonId = mon.id
  save.state.starterChosen = true
  for (const [item, count] of Object.entries(STARTER_BAG)) addItem(save, item, count)
  return done(`${speciesName(species)} devient ton compagnon !`, [{ type: 'starter', species }])
}

/**
 * Retrouve un mon de la box : « #3 » (numéro affiché par /tokemon box), surnom ou nom d'espèce.
 * @param {Save} save
 * @param {string} query
 * @returns {Mon | undefined}
 */
export function findMon(save, query) {
  const text = query.trim()
  const byIndex = /^#?(\d+)$/.exec(text)
  if (byIndex) return save.box[Number(byIndex[1]) - 1]
  const wanted = normalize(text)
  if (!wanted) return undefined
  const species = findSpecies(text)
  return (
    save.box.find((mon) => mon.nickname !== null && normalize(mon.nickname) === wanted) ??
    save.box.find((mon) => mon.species === species) ??
    save.box.find((mon) => normalize(speciesName(mon.species)).startsWith(wanted))
  )
}

/**
 * @param {Save} save
 * @param {string} query
 * @returns {ActionResult}
 */
export function switchActive(save, query) {
  if (!save.state.starterChosen) return fail("Choisis d'abord ton starter : /tokemon start <mon>")
  const mon = findMon(save, query)
  if (!mon) return fail(`Aucun « ${query.trim()} » dans ta box. /tokemon box pour la liste.`)
  if (mon.id === save.state.activeMonId) return done(`${monName(mon)} est déjà ton compagnon.`)
  save.state.activeMonId = mon.id
  // Une évolution en attente appartenait à l'ancien mon actif
  save.state.pendingEvolution = null
  return done(`${monName(mon)} (niv. ${mon.level}) devient ton compagnon.`)
}

/**
 * @param {Save} save
 * @param {string} nickname chaîne vide pour retirer le surnom
 * @returns {ActionResult}
 */
export function setNickname(save, nickname) {
  const mon = activeMon(save)
  if (!mon) return fail('Pas de compagnon actif. /tokemon start <mon> pour commencer.')
  const clean = nickname.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX_LENGTH)
  mon.nickname = clean || null
  return done(
    clean
      ? `Ton ${speciesName(mon.species)} s'appelle maintenant ${clean}.`
      : `${speciesName(mon.species)} retrouve son nom.`,
  )
}

/**
 * Variante d'affichage d'un mon shiny.
 * @param {Save} save
 * @param {'default' | 'shiny'} variant
 * @returns {ActionResult}
 */
export function setVariant(save, variant) {
  const mon = activeMon(save)
  if (!mon) return fail('Pas de compagnon actif.')
  if (!mon.shiny) return fail(`${monName(mon)} n'est pas shiny : seule sa forme normale est disponible.`)
  mon.variant = variant
  return done(`${monName(mon)} s'affiche en forme ${variant === 'shiny' ? 'shiny ✨' : 'normale'}.`)
}

/**
 * @param {Mon} mon
 * @returns {'default' | 'shiny'} la variante de sprite à dessiner
 */
export const variantOf = (mon) => (mon.shiny ? (mon.variant ?? 'shiny') : 'default')
