// Stratégie 1 (retenue) : l'usage réel porté par le payload de `turn.complete`.
// Vérifié en live sur Claude Code 2.1.323, voir docs/token-source.md.

/**
 * @param {import('../types.js').TurnEvent} turn
 * @returns {number | null} les output tokens réels du tour, ou null si le payload n'en porte pas
 */
export function tokensFromPayload(turn) {
  const value = turn.usage?.output_tokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}
