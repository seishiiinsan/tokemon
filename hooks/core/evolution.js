import { EVOLUTION_DELAY_MS, FALLBACK_BABY_EVOLUTION_LEVEL, FALLBACK_EVOLUTION_LEVEL } from '../config.js'
import { EVOLUTIONS } from '../data/evolutions.js'
import { ITEMS, normalize } from '../data/items.js'
import { findSpecies, speciesName } from '../data/lookup.js'
import { SPECIES } from '../data/species.js'
import { activeMon, done, fail, isAvailable, markDex, monName, takeItem } from './context.js'

// Évolutions : par niveau (automatique, annulable), par pierre, par échange (Link Cable),
// et au choix pour les espèces à plusieurs branches (Évoli).

/** @typedef {import('../data/evolutions.js').Evolution} Evolution */
/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Mon} Mon */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./context.js').ActionResult} ActionResult */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * Niveau requis par une évolution, ou null si elle ne se fait pas par niveau.
 * Les méthodes absentes de la V1 (`special`) se replient sur un niveau configurable.
 * @param {Evolution} evolution
 * @returns {number | null}
 */
export function requiredLevel(evolution) {
  if (evolution.type === 'level') return evolution.level
  if (evolution.type !== 'special') return null
  if (evolution.baby) return FALLBACK_BABY_EVOLUTION_LEVEL
  return Math.max(FALLBACK_EVOLUTION_LEVEL, evolution.after + 10)
}

/**
 * Les évolutions d'une espèce dont les sprites sont disponibles en local.
 * @param {string} speciesId
 * @param {Ctx} ctx
 * @returns {Evolution[]}
 */
export function evolutionsOf(speciesId, ctx) {
  return (EVOLUTIONS[speciesId] ?? []).filter((evolution) => isAvailable(ctx, evolution.to))
}

/**
 * @param {Evolution} evolution
 * @returns {string} la condition, en clair
 */
export function describeMethod(evolution) {
  if (evolution.type === 'stone') return ITEMS[evolution.item]?.name ?? evolution.item
  if (evolution.type === 'trade') return ITEMS['link-cable'].name
  return `niveau ${requiredLevel(evolution)}`
}

/**
 * La première évolution par niveau que le mon peut faire maintenant.
 * @param {Mon} mon
 * @param {Ctx} ctx
 * @returns {Evolution | undefined}
 */
export function readyLevelEvolution(mon, ctx) {
  return evolutionsOf(mon.species, ctx).find((evolution) => {
    const level = requiredLevel(evolution)
    return level !== null && mon.level >= level
  })
}

/**
 * Transforme le mon. Le surnom, le niveau, l'XP et le caractère shiny sont conservés.
 * @param {Save} save
 * @param {Mon} mon
 * @param {Evolution} evolution
 * @returns {GameEvent[]}
 */
function evolve(save, mon, evolution) {
  const name = monName(mon)
  const from = mon.species
  mon.evolvedFrom = from
  mon.species = evolution.to
  delete mon.noEvolve
  markDex(save, evolution.to, { caught: true, shiny: mon.shiny })
  const method = evolution.type === 'stone' ? 'stone' : evolution.type === 'trade' ? 'trade' : 'level'
  save.state.stats.evolutions += 1
  if (method === 'stone') save.state.stats.stoneEvolutions += 1
  if (method === 'trade') save.state.stats.tradeEvolutions += 1
  if (save.state.pendingEvolution?.monId === mon.id) save.state.pendingEvolution = null
  return [{ type: 'evolved', monId: mon.id, name, from, to: evolution.to, method }]
}

/**
 * Après un gain de niveau : annonce l'évolution du mon actif s'il a atteint le niveau requis.
 * Elle sera appliquée par `resolvePendingEvolution` après EVOLUTION_DELAY_MS, sauf /tokemon stop.
 * @param {Save} save
 * @param {Ctx} ctx
 * @returns {GameEvent[]}
 */
export function startLevelEvolution(save, ctx) {
  const mon = activeMon(save)
  if (!mon || mon.noEvolve || save.state.pendingEvolution) return []
  const evolution = readyLevelEvolution(mon, ctx)
  if (!evolution) return []
  save.state.pendingEvolution = { monId: mon.id, to: evolution.to, startedAt: ctx.now }
  return [{ type: 'evolution-start', monId: mon.id, name: monName(mon), to: evolution.to }]
}

/**
 * Applique l'évolution annoncée une fois son délai écoulé.
 * @param {Save} save
 * @param {Ctx} ctx
 * @returns {GameEvent[]}
 */
export function resolvePendingEvolution(save, ctx) {
  const pending = save.state.pendingEvolution
  if (!pending || ctx.now < pending.startedAt + EVOLUTION_DELAY_MS) return []
  const mon = save.box.find((candidate) => candidate.id === pending.monId)
  const evolution = mon && evolutionsOf(mon.species, ctx).find((candidate) => candidate.to === pending.to)
  save.state.pendingEvolution = null
  return mon && evolution ? evolve(save, mon, evolution) : []
}

/**
 * /tokemon stop : annule l'évolution annoncée et bloque les suivantes jusqu'à /tokemon evolve.
 * @param {Save} save
 * @returns {ActionResult}
 */
export function cancelEvolution(save) {
  const pending = save.state.pendingEvolution
  const mon = pending && save.box.find((candidate) => candidate.id === pending.monId)
  if (!pending || !mon) return fail('Aucune évolution en cours à annuler.')
  mon.noEvolve = true
  save.state.pendingEvolution = null
  const name = monName(mon)
  return done(`L'évolution de ${name} est annulée.`, [{ type: 'evolution-cancelled', name }])
}

/**
 * Vérifie la condition d'une évolution et consomme l'item qu'elle demande.
 * @param {Save} save
 * @param {Mon} mon
 * @param {Evolution} evolution
 * @returns {string | null} le motif du refus, ou null si la condition est remplie
 */
function payFor(save, mon, evolution) {
  const level = requiredLevel(evolution)
  if (level !== null) {
    return mon.level >= level
      ? null
      : `${monName(mon)} doit atteindre le niveau ${level} pour évoluer en ${speciesName(evolution.to)}.`
  }
  const item = evolution.type === 'stone' ? evolution.item : 'link-cable'
  if (!takeItem(save, item))
    return `Il te faut : ${ITEMS[item].name} pour faire évoluer ${monName(mon)} en ${speciesName(evolution.to)}.`
  save.state.stats.itemsUsed += 1
  return null
}

/**
 * /tokemon evolve [forme] : relance une évolution annulée, ou choisit une branche (Évoli).
 * @param {Save} save
 * @param {string} formQuery nom de la forme voulue, ou chaîne vide
 * @param {Ctx} ctx
 * @returns {ActionResult}
 */
export function evolveActive(save, formQuery, ctx) {
  const mon = activeMon(save)
  if (!mon) return fail('Pas de compagnon actif.')
  const options = evolutionsOf(mon.species, ctx)
  if (options.length === 0) {
    const missing = (EVOLUTIONS[mon.species] ?? []).length > 0
    return fail(
      missing
        ? `Les sprites de l'évolution de ${monName(mon)} ne sont pas téléchargés (/tokemon download gen${SPECIES[EVOLUTIONS[mon.species][0].to].gen}).`
        : `${monName(mon)} n'a pas d'évolution.`,
    )
  }
  /** @type {Evolution | undefined} */
  let evolution
  if (formQuery.trim()) {
    const wanted = findSpecies(formQuery)
    evolution =
      options.find((option) => option.to === wanted) ??
      options.find((option) => normalize(speciesName(option.to)).startsWith(normalize(formQuery)))
    if (!evolution)
      return fail(
        `${monName(mon)} ne peut pas évoluer en « ${formQuery.trim()} ». Possibles : ${listOptions(options)}.`,
      )
  } else {
    evolution = readyLevelEvolution(mon, ctx) ?? (options.length === 1 ? options[0] : undefined)
    if (!evolution) return fail(`Précise la forme : /tokemon evolve <forme>. Possibles : ${listOptions(options)}.`)
  }
  const refusal = payFor(save, mon, evolution)
  if (refusal) return fail(refusal)
  const events = evolve(save, mon, evolution)
  return done(
    `${events[0].type === 'evolved' ? events[0].name : monName(mon)} évolue en ${speciesName(evolution.to)} !`,
    events,
  )
}

/** @param {Evolution[]} options */
const listOptions = (options) =>
  options.map((option) => `${speciesName(option.to)} (${describeMethod(option)})`).join(', ')

/**
 * /tokemon use <pierre|link cable> : évolution par item.
 * @param {Save} save
 * @param {Mon} mon
 * @param {string} itemId
 * @param {Ctx} ctx
 * @returns {ActionResult}
 */
export function evolveWithItem(save, mon, itemId, ctx) {
  const evolution = evolutionsOf(mon.species, ctx).find((option) =>
    itemId === 'link-cable' ? option.type === 'trade' : option.type === 'stone' && option.item === itemId,
  )
  if (!evolution) return fail(`${ITEMS[itemId].name} n'a aucun effet sur ${monName(mon)}.`)
  const refusal = payFor(save, mon, evolution)
  if (refusal) return fail(refusal)
  const events = evolve(save, mon, evolution)
  return done(`${events[0].type === 'evolved' ? events[0].name : ''} évolue en ${speciesName(evolution.to)} !`, events)
}
