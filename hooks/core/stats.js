import { HISTORY_DAYS_MAX, HISTORY_EVENTS_MAX, STATS_DAYS } from '../config.js'
import { DEX_SIZE_BY_GEN } from '../data/lookup.js'
import { SPECIES } from '../data/species.js'
import { describeEvent, isLogged } from './events.js'

// Historique (tokens et XP par jour, journal des événements), série de jours et tableau de bord.

/** @typedef {import('./context.js').Save} Save */

/**
 * @param {number} now horodatage (ms)
 * @returns {string} la date locale, au format AAAA-MM-JJ
 */
export function dayKey(now) {
  const date = new Date(now)
  const pad = (/** @type {number} */ value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Ajoute les tokens et l'XP d'un tour au total du jour.
 * @param {Save} save
 * @param {number} outputTokens
 * @param {number} xp
 * @param {number} now
 */
export function recordDay(save, outputTokens, xp, now) {
  const date = dayKey(now)
  const days = save.history.days
  let day = days.find((entry) => entry.date === date)
  if (!day) {
    day = { date, outputTokens: 0, xp: 0 }
    days.push(day)
    days.sort((a, b) => a.date.localeCompare(b.date))
    if (days.length > HISTORY_DAYS_MAX) days.splice(0, days.length - HISTORY_DAYS_MAX)
  }
  day.outputTokens += outputTokens
  day.xp += xp
}

/**
 * Ajoute au journal les événements notables (les 50 derniers sont gardés).
 * @param {Save} save
 * @param {import('./events.js').GameEvent[]} events
 * @param {number} now
 */
export function logEvents(save, events, now) {
  for (const event of events) {
    if (isLogged(event)) save.history.events.push({ at: now, type: event.type, text: describeEvent(event) })
  }
  const extra = save.history.events.length - HISTORY_EVENTS_MAX
  if (extra > 0) save.history.events.splice(0, extra)
}

/**
 * Met à jour la série de jours consécutifs avec une session.
 * @param {Save} save
 * @param {number} now
 */
export function touchStreak(save, now) {
  const streak = save.state.streak
  const today = dayKey(now)
  if (streak.lastDay === today) return
  // Midi de la veille locale : insensible aux changements d'heure
  const noon = new Date(now)
  noon.setHours(12, 0, 0, 0)
  const yesterday = dayKey(noon.getTime() - 24 * 3600 * 1000)
  streak.count = streak.lastDay === yesterday ? streak.count + 1 : 1
  streak.lastDay = today
  streak.best = Math.max(streak.best, streak.count)
}

/**
 * Les tokens des `count` derniers jours, du plus ancien à aujourd'hui (0 pour un jour sans activité).
 * @param {Save} save
 * @param {number} now
 * @param {number} [count]
 * @returns {{ date: string, outputTokens: number }[]}
 */
export function lastDays(save, now, count = STATS_DAYS) {
  const byDate = new Map(save.history.days.map((day) => [day.date, day.outputTokens]))
  const noon = new Date(now)
  noon.setHours(12, 0, 0, 0)
  const out = []
  for (let back = count - 1; back >= 0; back--) {
    const date = dayKey(noon.getTime() - back * 24 * 3600 * 1000)
    out.push({ date, outputTokens: byDate.get(date) ?? 0 })
  }
  return out
}

const SPARKS = '▁▂▃▄▅▆▇█'

/**
 * @param {number[]} values
 * @returns {string} une barre par valeur, mise à l'échelle sur le maximum
 */
export function sparkline(values) {
  const max = Math.max(0, ...values)
  if (max <= 0) return SPARKS[0].repeat(values.length)
  return values
    .map((value) =>
      value <= 0 ? SPARKS[0] : SPARKS[Math.min(SPARKS.length - 1, Math.ceil((value / max) * (SPARKS.length - 1)))],
    )
    .join('')
}

/**
 * @param {number} value
 * @returns {string} « 950 », « 12,3 k », « 1,25 M »
 */
export function compactNumber(value) {
  const format = (/** @type {number} */ scaled, /** @type {string} */ unit) =>
    `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2).replace('.', ',')} ${unit}`
  if (value >= 1_000_000) return format(value / 1_000_000, 'M')
  if (value >= 10_000) return format(value / 1_000, 'k')
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Complétion du Pokédex par génération (par numéro de Pokédex : les formes comptent une fois).
 * @param {Save} save
 * @returns {{ gen: number, seen: number, caught: number, total: number }[]}
 */
export function dexCompletion(save) {
  /** @type {Record<number, { seen: Set<number>, caught: Set<number> }>} */
  const byGen = {}
  for (const [id, entry] of Object.entries(save.dex)) {
    const species = SPECIES[id]
    if (!species) continue
    const sets = (byGen[species.gen] ??= { seen: new Set(), caught: new Set() })
    if (entry.seen > 0 || entry.caught > 0) sets.seen.add(species.dex)
    if (entry.caught > 0) sets.caught.add(species.dex)
  }
  return Object.entries(DEX_SIZE_BY_GEN).map(([gen, total]) => ({
    gen: Number(gen),
    seen: byGen[Number(gen)]?.seen.size ?? 0,
    caught: byGen[Number(gen)]?.caught.size ?? 0,
    total,
  }))
}

/**
 * Les chiffres du tableau de bord.
 * @param {Save} save
 * @param {number} now
 */
export function dashboard(save, now) {
  const { stats, totals, streak } = save.state
  const days = lastDays(save, now)
  return {
    days,
    sparkline: sparkline(days.map((day) => day.outputTokens)),
    tokensToday: days[days.length - 1].outputTokens,
    tokensPeriod: days.reduce((sum, day) => sum + day.outputTokens, 0),
    totalTokens: totals.outputTokens,
    approximateTokens: totals.approximateTokens,
    totalXp: totals.xp,
    encounters: stats.encounters,
    captures: stats.captures,
    throws: stats.throws,
    captureRate: stats.throws > 0 ? stats.captures / stats.throws : 0,
    fled: stats.fled,
    shinySeen: stats.shinySeen,
    shinyCaught: stats.shinyCaught,
    itemsFound: stats.itemsFound,
    itemsUsed: stats.itemsUsed,
    evolutions: stats.evolutions,
    turns: stats.turns,
    boxSize: save.box.length,
    streak: streak.count,
    bestStreak: streak.best,
  }
}
