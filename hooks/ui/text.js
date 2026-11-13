import { RARITIES, XP_BAR_WIDTH } from '../config.js'
import { formatRemaining } from '../core/boosts.js'
import { monName } from '../core/context.js'
import { levelProgress } from '../core/levels.js'
import { compactNumber } from '../core/stats.js'
import { ITEMS } from '../data/items.js'
import { speciesName } from '../data/lookup.js'
import { rarityOf } from '../data/rarity.js'

// Mises en forme de texte partagées par la bande, le panneau et les commandes.

/** @typedef {import('../store/schema.js').Save} Save */
/** @typedef {import('../store/schema.js').Mon} Mon */

/**
 * @param {number} ratio entre 0 et 1
 * @param {number} [width]
 * @returns {string} « ████░░░░ »
 */
export function bar(ratio, width = XP_BAR_WIDTH) {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** @param {Mon} mon */
export const monTitle = (mon) => `${monName(mon)}${mon.shiny ? ' ✨' : ''} · niv. ${mon.level}`

/** @param {Mon} mon */
export function xpLine(mon) {
  const progress = levelProgress(mon)
  if (progress.needed === 0) return `${bar(1)} niveau max`
  return `${bar(progress.ratio)} ${compactNumber(progress.current)}/${compactNumber(progress.needed)} XP`
}

/**
 * @param {Save} save
 * @param {number} now
 * @returns {string} les boosts actifs avec leur temps restant, ou une chaîne vide
 */
export function boostsLine(save, now) {
  return save.boosts
    .filter((boost) => boost.expiresAt > now)
    .map(
      (boost) =>
        `${ITEMS[boost.id]?.icon ?? '•'} ${ITEMS[boost.id]?.name ?? boost.id} ${formatRemaining(boost.expiresAt - now)}`,
    )
    .join('  ')
}

/**
 * @param {import('../store/schema.js').Wild} wild
 * @param {number} now
 */
export function wildLine(wild, now) {
  const rarity = RARITIES[rarityOf(wild.species)].label
  return `Sauvage : ${speciesName(wild.species)}${wild.shiny ? ' ✨' : ''} niv. ${wild.level} (${rarity}) · ${formatRemaining(wild.expiresAt - now)} · /tokemon catch`
}
