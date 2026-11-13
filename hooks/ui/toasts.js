import { describeEvent } from '../core/events.js'

// Toasts : une ligne par événement de jeu qui mérite d'être annoncé.

/**
 * @param {import('../core/events.js').GameEvent} event
 * @returns {boolean}
 */
function isAnnounced(event) {
  // Sous Multi Exp, toute la box peut monter de niveau : seul le compagnon actif est annoncé
  if (event.type === 'level-up') return event.active
  // Le résultat d'un lancer et l'activation d'un boost sont déjà la réponse de la commande
  return event.type !== 'starter' && event.type !== 'boost-start'
}

/**
 * @param {import('../types.js').Host} io
 * @param {import('../core/events.js').GameEvent[]} events
 */
export function toastEvents(io, events) {
  for (const event of events) if (isAnnounced(event)) io.ui.toast(describeEvent(event))
}
