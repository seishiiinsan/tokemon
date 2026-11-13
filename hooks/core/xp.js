import { EXP_SHARE_RATIO, LUCKY_EGG_XP_MULTIPLIER, MAX_LEVEL, XP_PER_TOKEN } from '../config.js'
import { hasBoost } from './boosts.js'
import { activeMon, monName } from './context.js'
import { levelForXp, xpForLevel } from './levels.js'

// XP : proportionnelle aux output tokens, avec les multiplicateurs des boosts.

/** @typedef {import('./context.js').Save} Save */
/** @typedef {import('./context.js').Mon} Mon */
/** @typedef {import('./events.js').GameEvent} GameEvent */

/**
 * @param {number} tokens output tokens du tour
 * @param {Save} save
 * @param {number} now
 * @returns {number} XP gagnée par le mon actif
 */
export function xpForTokens(tokens, save, now) {
  const multiplier = hasBoost(save, 'lucky-egg', now) ? LUCKY_EGG_XP_MULTIPLIER : 1
  return Math.floor(Math.max(0, tokens) * XP_PER_TOKEN * multiplier)
}

/**
 * Donne de l'XP à un mon et le fait monter de niveau si besoin.
 * @param {Save} save
 * @param {Mon} mon
 * @param {number} amount
 * @returns {GameEvent[]}
 */
export function grantXp(save, mon, amount) {
  if (amount <= 0 || mon.level >= MAX_LEVEL) return []
  const from = mon.level
  mon.xp = Math.min(xpForLevel(MAX_LEVEL), mon.xp + amount)
  mon.level = levelForXp(mon.xp)
  if (mon.level === from) return []
  return [
    {
      type: 'level-up',
      monId: mon.id,
      name: monName(mon),
      from,
      to: mon.level,
      active: mon.id === save.state.activeMonId,
    },
  ]
}

/**
 * Monte un mon d'un ou plusieurs niveaux d'un coup (Super Bonbon).
 * @param {Save} save
 * @param {Mon} mon
 * @param {number} levels
 * @returns {GameEvent[]}
 */
export function grantLevels(save, mon, levels) {
  if (mon.level >= MAX_LEVEL) return []
  return grantXp(save, mon, xpForLevel(Math.min(MAX_LEVEL, mon.level + levels)) - mon.xp)
}

/**
 * Applique le gain d'XP d'un tour : le mon actif, puis la box sous Multi Exp.
 * @param {Save} save
 * @param {number} tokens
 * @param {number} now
 * @returns {{ xp: number, events: GameEvent[] }}
 */
export function applyTurnXp(save, tokens, now) {
  const mon = activeMon(save)
  if (!mon) return { xp: 0, events: [] }
  const xp = xpForTokens(tokens, save, now)
  const events = grantXp(save, mon, xp)
  if (hasBoost(save, 'exp-share', now)) {
    const share = Math.floor(xp * EXP_SHARE_RATIO)
    for (const other of save.box) if (other.id !== mon.id) events.push(...grantXp(save, other, share))
  }
  save.state.totals.xp += xp
  return { xp, events }
}
