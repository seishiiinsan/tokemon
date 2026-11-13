import { LEVEL_CURVE_EXPONENT, MAX_LEVEL } from '../config.js'

// Courbe de niveaux « medium fast » : XP totale pour le niveau n = n³.

/**
 * @param {number} level
 * @returns {number} XP totale requise pour atteindre ce niveau
 */
export function xpForLevel(level) {
  return Math.round(Math.max(1, Math.min(MAX_LEVEL, level)) ** LEVEL_CURVE_EXPONENT)
}

/**
 * @param {number} xp XP totale
 * @returns {number} niveau correspondant, entre 1 et MAX_LEVEL
 */
export function levelForXp(xp) {
  let level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Math.max(0, xp) ** (1 / LEVEL_CURVE_EXPONENT))))
  // La racine flottante peut tomber juste à côté d'un palier exact
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++
  while (level > 1 && xpForLevel(level) > xp) level--
  return level
}

/**
 * Progression dans le niveau courant.
 * @param {{ level: number, xp: number }} mon
 * @returns {{ current: number, needed: number, ratio: number }}
 */
export function levelProgress(mon) {
  if (mon.level >= MAX_LEVEL) return { current: 0, needed: 0, ratio: 1 }
  const floor = xpForLevel(mon.level)
  const needed = xpForLevel(mon.level + 1) - floor
  const current = Math.max(0, Math.min(needed, mon.xp - floor))
  return { current, needed, ratio: needed > 0 ? current / needed : 1 }
}
