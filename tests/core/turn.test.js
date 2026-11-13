import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SEEN_TURNS_MAX } from '../../hooks/config.js'
import { activateBoost } from '../../hooks/core/boosts.js'
import { dayKey } from '../../hooks/core/stats.js'
import { applyTurn, housekeeping, needsHousekeeping } from '../../hooks/core/turn.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

test("un tour donne de l'XP au mon actif et alimente totaux et historique", () => {
  const { save, mon } = startedSave()
  const outcome = applyTurn(save, { key: 'main:t1', tokens: 1500, approximate: false }, testCtx())
  assert.equal(outcome.counted, true)
  assert.equal(outcome.xp, 1500)
  assert.equal(mon.xp, 125 + 1500)
  assert.equal(mon.level, 11)
  assert.ok(outcome.events.some((event) => event.type === 'level-up'))
  assert.equal(save.state.totals.outputTokens, 1500)
  assert.equal(save.state.totals.approximateTokens, 0)
  assert.equal(save.state.stats.turns, 1)
  assert.deepEqual(save.history.days, [{ date: dayKey(NOW), outputTokens: 1500, xp: 1500 }])
})

test('un même tour n’est compté qu’une fois (déduplication)', () => {
  const { save, mon } = startedSave()
  applyTurn(save, { key: 'main:t1', tokens: 1000, approximate: false }, testCtx())
  const again = applyTurn(save, { key: 'main:t1', tokens: 1000, approximate: false }, testCtx())
  assert.deepEqual(again, { counted: false, xp: 0, events: [] })
  assert.equal(mon.xp, 125 + 1000)
  assert.equal(save.state.totals.outputTokens, 1000)
  // Le tour d'un subagent a sa propre clé : il compte
  applyTurn(save, { key: 'agent-1:t1', tokens: 200, approximate: false }, testCtx())
  assert.equal(save.state.totals.outputTokens, 1200)
})

test('la mémoire des tours vus est bornée', () => {
  const { save } = startedSave()
  for (let i = 0; i < SEEN_TURNS_MAX + 10; i++)
    applyTurn(save, { key: 'main:' + i, tokens: 1, approximate: false }, testCtx())
  assert.equal(save.state.seenTurns.length, SEEN_TURNS_MAX)
  assert.equal(save.state.seenTurns[0], 'main:10')
})

test('les tokens estimés sont comptés à part', () => {
  const { save } = startedSave()
  applyTurn(save, { key: 'a', tokens: 100.9, approximate: true }, testCtx())
  applyTurn(save, { key: 'b', tokens: -5, approximate: false }, testCtx())
  assert.equal(save.state.totals.outputTokens, 100)
  assert.equal(save.state.totals.approximateTokens, 100)
})

test("l'entretien retire les boosts expirés", () => {
  const { save } = startedSave()
  activateBoost(save, 'incense', NOW)
  assert.equal(needsHousekeeping(save, NOW), false)
  assert.deepEqual(housekeeping(save, testCtx()), [])
  const later = NOW + 31 * 60_000
  assert.equal(needsHousekeeping(save, later), true)
  assert.deepEqual(housekeeping(save, testCtx({ now: later })), [{ type: 'boost-end', boost: 'incense' }])
  assert.deepEqual(save.boosts, [])
})
