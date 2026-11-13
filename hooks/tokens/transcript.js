// Stratégie 3 (fallback) : somme des `message.usage.output_tokens` du transcript JSONL.
// Une même réponse occupe plusieurs lignes (une par bloc de contenu) qui répètent le même
// `message.id` et le même usage : on garde donc le maximum par id avant de sommer.

/**
 * @param {string} text contenu JSONL du transcript de la session
 * @param {{ sinceMs?: number }} [options] ne compte que les messages horodatés après `sinceMs`
 * @returns {number | null} null si aucune ligne exploitable n'a été trouvée
 */
export function tokensFromTranscript(text, { sinceMs = 0 } = {}) {
  /** @type {Map<string, number>} */
  const byMessage = new Map()
  let anonymous = 0
  for (const line of text.split('\n')) {
    if (!line.includes('"output_tokens"')) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry?.type !== 'assistant' || entry.isSidechain === true) continue
    const tokens = entry.message?.usage?.output_tokens
    if (typeof tokens !== 'number' || !Number.isFinite(tokens)) continue
    const at = Date.parse(entry.timestamp ?? '')
    if (Number.isFinite(at) && at < sinceMs) continue
    const id = entry.message.id ?? `anonymous-${anonymous++}`
    byMessage.set(id, Math.max(byMessage.get(id) ?? 0, tokens))
  }
  if (byMessage.size === 0) return null
  let total = 0
  for (const tokens of byMessage.values()) total += tokens
  return total
}
