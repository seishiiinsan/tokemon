import { BOOST_DURATIONS } from '../config.js'

// Boosts temporaires, horodatés par l'horloge injectée.

/** @typedef {import('../config.js').BoostId} BoostId */
/** @typedef {import('./context.js').Save} Save */

/**
 * @param {Save} save
 * @param {BoostId} id
 * @param {number} now
 */
export function hasBoost(save, id, now) {
  return save.boosts.some((boost) => boost.id === id && boost.expiresAt > now)
}

/**
 * Active un boost. S'il est déjà actif, sa durée s'ajoute au temps restant.
 * @param {Save} save
 * @param {BoostId} id
 * @param {number} now
 * @returns {import('./events.js').GameEvent[]}
 */
export function activateBoost(save, id, now) {
  const current = save.boosts.find((boost) => boost.id === id)
  const base = current && current.expiresAt > now ? current.expiresAt : now
  const expiresAt = base + BOOST_DURATIONS[id]
  if (current) current.expiresAt = expiresAt
  else save.boosts.push({ id, expiresAt })
  return [{ type: 'boost-start', boost: id, expiresAt }]
}

/**
 * Retire les boosts expirés.
 * @param {Save} save
 * @param {number} now
 * @returns {import('./events.js').GameEvent[]}
 */
export function expireBoosts(save, now) {
  /** @type {import('./events.js').GameEvent[]} */
  const events = []
  save.boosts = save.boosts.filter((boost) => {
    if (boost.expiresAt > now) return true
    events.push({ type: 'boost-end', boost: boost.id })
    return false
  })
  return events
}

/**
 * @param {number} ms
 * @returns {string} durée lisible : « 1 h 05 », « 12 min », « 40 s »
 */
export function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
