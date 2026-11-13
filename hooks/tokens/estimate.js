import { ESTIMATE_CHARS_PER_TOKEN } from '../config.js'

// Stratégie 4 (dernier recours) : estimation à partir du texte visible de la réponse.
// Sous-estime fortement (ni la réflexion ni les appels d'outils ne sont visibles) : l'UI
// la signale par un « ≈ ».

/**
 * @param {import('../types.js').TurnEvent} turn
 * @returns {number}
 */
export function tokensFromEstimate(turn) {
  return Math.ceil((turn.answer ?? '').length / ESTIMATE_CHARS_PER_TOKEN)
}
