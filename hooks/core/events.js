import { RARITIES } from '../config.js'
import { ACHIEVEMENTS } from '../data/achievements.js'
import { ITEMS } from '../data/items.js'
import { speciesName } from '../data/lookup.js'

// Les événements de jeu produits par le core, et leur texte français (toasts et journal).

/**
 * @typedef {{ type: 'starter', species: string }
 *   | { type: 'level-up', monId: number, name: string, from: number, to: number, active: boolean }
 *   | { type: 'evolution-start', monId: number, name: string, to: string }
 *   | { type: 'evolution-cancelled', name: string }
 *   | { type: 'evolved', monId: number, name: string, from: string, to: string, method: 'level' | 'stone' | 'trade' }
 *   | { type: 'encounter', species: string, shiny: boolean, level: number, rarity: import('../config.js').Rarity }
 *   | { type: 'captured', species: string, shiny: boolean, level: number, ball: string, monId: number }
 *   | { type: 'throw-failed', species: string, ball: string, left: number }
 *   | { type: 'fled', species: string, reason: 'timeout' | 'throws' }
 *   | { type: 'drop', item: string, count: number, reason: 'drop' | 'milestone' | 'achievement' }
 *   | { type: 'boost-start', boost: string, expiresAt: number }
 *   | { type: 'boost-end', boost: string }
 *   | { type: 'achievement', id: string }} GameEvent
 */

/** Les événements gardés dans le journal des 50 derniers */
const LOGGED = new Set(['starter', 'evolved', 'captured', 'fled', 'drop', 'achievement', 'encounter'])

/** @param {GameEvent} event */
export const isLogged = (event) => LOGGED.has(event.type)

/** @param {string} id */
const itemName = (id) => ITEMS[id]?.name ?? id

/**
 * @param {GameEvent} event
 * @returns {string} une ligne en français
 */
export function describeEvent(event) {
  switch (event.type) {
    case 'starter':
      return `${speciesName(event.species)} te rejoint. L'aventure commence !`
    case 'level-up':
      return `${event.name} passe au niveau ${event.to} !`
    case 'evolution-start':
      return `Hein ? ${event.name} évolue ! (/tokemon stop pour annuler)`
    case 'evolution-cancelled':
      return `L'évolution de ${event.name} est annulée. /tokemon evolve pour la relancer.`
    case 'evolved':
      return `${event.name} évolue en ${speciesName(event.to)} !`
    case 'encounter':
      return `Un ${speciesName(event.species)}${event.shiny ? ' ✨ shiny' : ''} sauvage apparaît ! (${RARITIES[event.rarity].label}, niv. ${event.level}) /tokemon catch`
    case 'captured':
      return `${speciesName(event.species)}${event.shiny ? ' ✨' : ''} est capturé avec une ${itemName(event.ball)} !`
    case 'throw-failed':
      return `Raté ! ${speciesName(event.species)} sort de la ${itemName(event.ball)}. ${event.left > 0 ? `Encore ${event.left} essai${event.left > 1 ? 's' : ''}.` : ''}`.trim()
    case 'fled':
      return `${speciesName(event.species)} sauvage s'enfuit${event.reason === 'timeout' ? ' (temps écoulé)' : ''}.`
    case 'drop': {
      const what = `${itemName(event.item)}${event.count > 1 ? ` ×${event.count}` : ''}`
      if (event.reason === 'milestone') return `Palier de tokens atteint : ${what} !`
      if (event.reason === 'achievement') return `Récompense : ${what}`
      return `Tu trouves : ${what}`
    }
    case 'boost-start':
      return `${itemName(event.boost)} activé.`
    case 'boost-end':
      return `${itemName(event.boost)} : effet terminé.`
    case 'achievement':
      return `Succès débloqué : ${ACHIEVEMENTS[event.id]?.name ?? event.id}`
  }
}
