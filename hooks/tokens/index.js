import { TRANSCRIPT_SLACK_MS } from '../config.js'
import { tokensFromEstimate } from './estimate.js'
import { tokensFromPayload } from './payload.js'
import { tokensFromTranscript } from './transcript.js'

// Point d'entrée unique pour connaître les output tokens d'un tour.
// Cascade : payload de turn.complete → transcript JSONL → estimation.
// Résultat de l'investigation du Lot 0 : docs/token-source.md.

/** @typedef {'payload' | 'transcript' | 'estimate'} TokenSource */

/**
 * @typedef {object} TokenReading
 * @property {number} tokens
 * @property {TokenSource} source
 * @property {boolean} approximate vrai quand la valeur est une estimation (à signaler dans l'UI)
 */

/**
 * @typedef {object} TokenContext
 * @property {() => Promise<string | undefined>} [readTranscript] lit le transcript JSONL de la session
 * @property {number} [now] horloge injectée (ms), pour borner la lecture du transcript au tour courant
 */

/**
 * @param {import('../types.js').TurnEvent} turn payload de `turn.complete`
 * @param {TokenContext} [context]
 * @returns {Promise<TokenReading>}
 */
export async function getOutputTokens(turn, context = {}) {
  const real = tokensFromPayload(turn)
  if (real !== null) return { tokens: real, source: 'payload', approximate: false }

  // Un tour interrompu ou en erreur n'a pas d'usage : inutile de lire le transcript d'un subagent,
  // dont le fichier n'est pas celui de la session.
  if (context.readTranscript && turn.agentId === undefined) {
    try {
      const text = await context.readTranscript()
      if (text !== undefined) {
        const sinceMs =
          context.now !== undefined && turn.durationMs !== undefined
            ? context.now - turn.durationMs - TRANSCRIPT_SLACK_MS
            : 0
        const fromFile = tokensFromTranscript(text, { sinceMs })
        if (fromFile !== null) return { tokens: fromFile, source: 'transcript', approximate: false }
      }
    } catch {
      // transcript illisible : on retombe sur l'estimation
    }
  }

  return { tokens: tokensFromEstimate(turn), source: 'estimate', approximate: true }
}
