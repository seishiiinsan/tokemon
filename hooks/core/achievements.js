import { ACHIEVEMENT_LIST } from '../data/achievements.js'
import { rarityOf } from '../data/rarity.js'
import { addItem } from './context.js'
import { dexCompletion } from './stats.js'

// Succès : chaque condition est une fonction pure de la sauvegarde.
// Un succès débloqué donne sa récompense une seule fois.

/** @typedef {import('./context.js').Save} Save */

/** @param {Save} save */
const speciesCaught = (save) => dexCompletion(save).reduce((sum, gen) => sum + gen.caught, 0)
/** @param {Save} save @param {number} level */
const hasLevel = (save, level) => save.box.some((mon) => mon.level >= level)

/** @type {Record<string, (save: Save) => boolean>} */
export const CONDITIONS = {
  'first-catch': (save) => save.state.stats.captures >= 1,
  'catch-10': (save) => save.state.stats.captures >= 10,
  'catch-50': (save) => save.state.stats.captures >= 50,
  'catch-151': (save) => save.state.stats.captures >= 151,
  'dex-25': (save) => speciesCaught(save) >= 25,
  'dex-100': (save) => speciesCaught(save) >= 100,
  'first-shiny': (save) => save.state.stats.shinyCaught >= 1,
  'first-legendary': (save) =>
    Object.entries(save.dex).some(([id, entry]) => entry.caught > 0 && rarityOf(id) === 'legendary'),
  'tokens-100k': (save) => save.state.totals.outputTokens >= 100_000,
  'tokens-1m': (save) => save.state.totals.outputTokens >= 1_000_000,
  'tokens-10m': (save) => save.state.totals.outputTokens >= 10_000_000,
  'first-evolution': (save) => save.state.stats.evolutions >= 1,
  'stone-evolution': (save) => save.state.stats.stoneEvolutions >= 1,
  'trade-evolution': (save) => save.state.stats.tradeEvolutions >= 1,
  'level-50': (save) => hasLevel(save, 50),
  'level-100': (save) => hasLevel(save, 100),
  'streak-7': (save) => save.state.streak.best >= 7,
  'master-ball-used': (save) => save.state.stats.masterBallsUsed >= 1,
  'items-25': (save) => save.state.stats.itemsFound >= 25,
  'eevee-evolution': (save) => save.box.some((mon) => mon.evolvedFrom === 'eevee'),
}

/**
 * Débloque les succès dont la condition vient d'être remplie et donne leur récompense.
 * @param {Save} save
 * @param {number} now
 * @returns {import('./events.js').GameEvent[]}
 */
export function checkAchievements(save, now) {
  /** @type {import('./events.js').GameEvent[]} */
  const events = []
  if (!save.state.starterChosen) return events
  for (const achievement of ACHIEVEMENT_LIST) {
    if (achievement.id in save.achievements || !CONDITIONS[achievement.id]?.(save)) continue
    save.achievements[achievement.id] = now
    addItem(save, achievement.reward.item, achievement.reward.count)
    events.push(
      { type: 'achievement', id: achievement.id },
      { type: 'drop', item: achievement.reward.item, count: achievement.reward.count, reason: 'achievement' },
    )
  }
  return events
}
