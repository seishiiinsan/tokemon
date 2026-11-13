import { BERRY_XP, MAX_LEVEL, RARE_CANDY_LEVELS } from '../config.js'
import { findItem, ITEMS } from '../data/items.js'
import { activateBoost, formatRemaining } from './boosts.js'
import { activeMon, done, fail, monName, takeItem } from './context.js'
import { evolveWithItem, startLevelEvolution } from './evolution.js'
import { findMon } from './team.js'
import { grantLevels, grantXp } from './xp.js'

// Utilisation d'un item du sac : /tokemon use <item> [mon].

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Ctx} Ctx */
/** @typedef {import('./context.js').ActionResult} ActionResult */

/**
 * Sépare « pierre feu évoli » en item et cible : le plus long début qui nomme un item.
 * @param {string} text
 * @returns {{ item: import('../data/items.js').Item, target: string } | null}
 */
export function parseUse(text) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  for (let count = words.length; count >= 1; count--) {
    const item = findItem(words.slice(0, count).join(' '))
    if (item) return { item, target: words.slice(count).join(' ') }
  }
  return null
}

/**
 * @param {Save} save
 * @param {string} text ce qui suit /tokemon use
 * @param {Ctx} ctx
 * @returns {ActionResult}
 */
export function useItem(save, text, ctx) {
  const parsed = parseUse(text)
  if (!parsed)
    return fail(
      text.trim()
        ? `Item inconnu : « ${text.trim()} ». /tokemon bag pour voir ton sac.`
        : 'Précise un item : /tokemon use <item> [mon]',
    )
  const { item, target } = parsed
  if ((save.bag[item.id] ?? 0) <= 0) return fail(`Tu n'as pas de ${item.name}.`)
  if (item.kind === 'ball')
    return fail(`Une ${item.name} se lance sur un Pokémon sauvage : /tokemon catch ${item.aliases[0]}`)

  if (item.kind === 'boost') {
    takeItem(save, item.id)
    save.state.stats.itemsUsed += 1
    const events = activateBoost(save, /** @type {import('../config.js').BoostId} */ (item.id), ctx.now)
    const boost = save.boosts.find((candidate) => candidate.id === item.id)
    return done(
      `${item.name} activé : ${item.effect} (reste ${formatRemaining((boost?.expiresAt ?? ctx.now) - ctx.now)}).`,
      events,
    )
  }

  const mon = target ? findMon(save, target) : activeMon(save)
  if (!mon)
    return fail(
      target ? `Aucun « ${target} » dans ta box.` : 'Pas de compagnon actif. /tokemon start <mon> pour commencer.',
    )

  if (item.kind === 'stone' || item.kind === 'trade') return evolveWithItem(save, mon, item.id, ctx)

  if (mon.level >= MAX_LEVEL) return fail(`${monName(mon)} est déjà au niveau ${MAX_LEVEL}.`)
  takeItem(save, item.id)
  save.state.stats.itemsUsed += 1
  const before = mon.level
  const events =
    item.kind === 'candy'
      ? grantLevels(save, mon, RARE_CANDY_LEVELS)
      : grantXp(save, mon, /** @type {Record<string, number>} */ (BERRY_XP)[item.id] ?? 0)
  // Un niveau gagné par un item peut déclencher l'évolution du compagnon
  if (mon.id === save.state.activeMonId) events.push(...startLevelEvolution(save, ctx))
  const gained = mon.level > before ? ` Niveau ${mon.level} !` : ''
  return done(
    `${monName(mon)} ${item.kind === 'candy' ? 'croque un' : 'mange une'} ${ITEMS[item.id].name}.${gained}`,
    events,
  )
}
