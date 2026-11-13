import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tokensFromEstimate } from '../../hooks/tokens/estimate.js'
import { getOutputTokens } from '../../hooks/tokens/index.js'
import { tokensFromPayload } from '../../hooks/tokens/payload.js'
import { tokensFromTranscript } from '../../hooks/tokens/transcript.js'

// Payload réel capturé sur Claude Code 2.1.323 (voir docs/token-source.md)
const REAL_TURN = {
  answer: 'done',
  durationMs: 4792,
  isAborted: false,
  turnId: '475004e3-9823-4b8f-af94-9f2741abb11c',
  reason: 'answer',
  usage: {
    input_tokens: 4,
    output_tokens: 141,
    cache_read_input_tokens: 65062,
    cache_creation_input_tokens: 10497,
    model: 'claude-opus-5-5',
  },
}

/** @param {Record<string, unknown>} entry */
const line = (entry) => JSON.stringify(entry)
const assistant = (
  /** @type {string} */ id,
  /** @type {number} */ tokens,
  timestamp = '2026-01-15T12:00:10.000Z',
  extra = {},
) =>
  line({
    type: 'assistant',
    timestamp,
    message: { id, role: 'assistant', usage: { input_tokens: 3, output_tokens: tokens } },
    ...extra,
  })

test('payload : lit usage.output_tokens du turn.complete réel', () => {
  assert.equal(tokensFromPayload(REAL_TURN), 141)
  assert.equal(tokensFromPayload({ answer: 'x' }), null)
  assert.equal(tokensFromPayload({ usage: null }), null)
  assert.equal(tokensFromPayload({ usage: { output_tokens: Number.NaN } }), null)
  assert.equal(tokensFromPayload({ usage: { output_tokens: -1 } }), null)
})

test('transcript : somme par message, sans double compte des lignes répétées', () => {
  const text = [
    line({ type: 'user', timestamp: '2026-01-15T12:00:00.000Z', message: { role: 'user', content: 'salut' } }),
    assistant('msg_1', 120),
    assistant('msg_1', 120),
    assistant('msg_2', 30),
    assistant('msg_side', 999, '2026-01-15T12:00:10.000Z', { isSidechain: true }),
    'ligne corrompue "output_tokens"',
    '',
  ].join('\n')
  assert.equal(tokensFromTranscript(text), 150)
})

test('transcript : ne compte que les messages postérieurs à sinceMs', () => {
  const text = [
    assistant('old', 500, '2026-01-15T11:00:00.000Z'),
    assistant('new', 70, '2026-01-15T12:00:10.000Z'),
  ].join('\n')
  assert.equal(tokensFromTranscript(text, { sinceMs: Date.parse('2026-01-15T12:00:00.000Z') }), 70)
  assert.equal(tokensFromTranscript('rien ici'), null)
})

test('estimation : longueur de la réponse / 4, arrondie au supérieur', () => {
  assert.equal(tokensFromEstimate({ answer: 'a'.repeat(41) }), 11)
  assert.equal(tokensFromEstimate({}), 0)
})

test('getOutputTokens : le payload réel passe en premier', async () => {
  const reading = await getOutputTokens(REAL_TURN, { readTranscript: async () => assistant('m', 999) })
  assert.deepEqual(reading, { tokens: 141, source: 'payload', approximate: false })
})

test('getOutputTokens : sans usage, lit le transcript borné au tour', async () => {
  const text = [
    assistant('old', 500, '2026-01-15T11:00:00.000Z'),
    assistant('new', 70, '2026-01-15T12:00:10.000Z'),
  ].join('\n')
  const now = Date.parse('2026-01-15T12:00:11.000Z')
  const reading = await getOutputTokens({ answer: 'x', durationMs: 5000 }, { readTranscript: async () => text, now })
  assert.deepEqual(reading, { tokens: 70, source: 'transcript', approximate: false })
  const whole = await getOutputTokens({ answer: 'x' }, { readTranscript: async () => text })
  assert.equal(whole.tokens, 570)
})

test("getOutputTokens : dernier recours, l'estimation est signalée approximative", async () => {
  const turn = { answer: 'a'.repeat(400) }
  assert.deepEqual(await getOutputTokens(turn), { tokens: 100, source: 'estimate', approximate: true })
  const failing = await getOutputTokens(turn, {
    readTranscript: async () => {
      throw new Error('illisible')
    },
  })
  assert.equal(failing.source, 'estimate')
  assert.equal((await getOutputTokens(turn, { readTranscript: async () => undefined })).source, 'estimate')
  assert.equal((await getOutputTokens(turn, { readTranscript: async () => 'vide' })).source, 'estimate')
  // Un subagent n'a pas son transcript dans le fichier de la session
  const sub = await getOutputTokens({ ...turn, agentId: 'a1' }, { readTranscript: async () => assistant('m', 9) })
  assert.equal(sub.source, 'estimate')
})
