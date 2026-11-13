import { ACHIEVEMENT_LIST } from '../../data/achievements.js'
import { ITEMS } from '../../data/items.js'
import { textLines } from './widgets.js'

// Onglet Succès : débloqués d'abord, avec leur récompense.

/**
 * @param {import('../../store/schema.js').Save} save
 * @returns {string[]}
 */
export function achievementLines(save) {
  const unlocked = ACHIEVEMENT_LIST.filter((achievement) => achievement.id in save.achievements)
  const locked = ACHIEVEMENT_LIST.filter((achievement) => !(achievement.id in save.achievements))
  const line = (
    /** @type {import('../../data/achievements.js').Achievement} */ achievement,
    /** @type {string} */ mark,
  ) =>
    `${mark} ${achievement.name} · ${achievement.description} (${ITEMS[achievement.reward.item].name} ×${achievement.reward.count})`
  return [
    `Succès : ${unlocked.length}/${ACHIEVEMENT_LIST.length}`,
    ...unlocked.map((achievement) => line(achievement, '★')),
    ...locked.map((achievement) => line(achievement, '☆')),
  ]
}

/**
 * @param {import('./index.js').PaneContext} context
 * @returns {import('../../types.js').UiNode[]}
 */
export function achievementsTab(context) {
  const [title, ...lines] = achievementLines(context.save)
  const unlocked = Object.keys(context.save.achievements).length
  return [
    ...textLines(context, [title], { bold: true }),
    ...textLines(context, lines.slice(0, unlocked)),
    ...textLines(context, lines.slice(unlocked), { dim: true }),
  ]
}
