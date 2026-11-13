import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activateBoost } from '../../hooks/core/boosts.js'
import { addMon } from '../../hooks/core/context.js'
import { xpForLevel } from '../../hooks/core/levels.js'
import { applyTurnXp, grantLevels, grantXp, xpForTokens } from '../../hooks/core/xp.js'
import { NOW, startedSave } from '../helpers/save.js'

test("l'XP est proportionnelle aux output tokens", () => {
  const { save } = startedSave()
  assert.equal(xpForTokens(1234, save, NOW), 1234)
  assert.equal(xpForTokens(0, save, NOW), 0)
  assert.equal(xpForTokens(-10, save, NOW), 0)
})

test('Lucky Egg double l’XP pendant sa durée seulement', () => {
  const { save } = startedSave()
  activateBoost(save, 'lucky-egg', NOW)
  assert.equal(xpForTokens(1000, save, NOW + 59 * 60_000), 2000)
  assert.equal(xpForTokens(1000, save, NOW + 61 * 60_000), 1000)
})

test('grantXp fait monter de niveau et le signale', () => {
  const { save, mon } = startedSave({ level: 5 })
  assert.deepEqual(grantXp(save, mon, 10), [])
  assert.equal(mon.level, 5)
  const events = grantXp(save, mon, xpForLevel(8) - mon.xp)
  assert.equal(mon.level, 8)
  assert.deepEqual(events, [{ type: 'level-up', monId: mon.id, name: 'Bulbizarre', from: 5, to: 8, active: true }])
})

test("grantXp plafonne au niveau 100 et n'accorde plus rien ensuite", () => {
  const { save, mon } = startedSave({ level: 99 })
  grantXp(save, mon, 10_000_000)
  assert.equal(mon.level, 100)
  assert.equal(mon.xp, 1_000_000)
  assert.deepEqual(grantXp(save, mon, 500), [])
  assert.deepEqual(grantLevels(save, mon, 1), [])
  assert.deepEqual(grantXp(save, mon, 0), [])
})

test('grantLevels monte exactement du nombre de niveaux demandé', () => {
  const { save, mon } = startedSave({ level: 5 })
  mon.xp += 40
  const events = grantLevels(save, mon, 1)
  assert.equal(mon.level, 6)
  assert.equal(mon.xp, xpForLevel(6))
  assert.equal(events.length, 1)
})

test('applyTurnXp : seul le mon actif gagne, sauf sous Multi Exp', () => {
  const { save, mon } = startedSave()
  const other = addMon(save, { species: 'pidgey', level: 3 }, NOW)
  assert.equal(applyTurnXp(save, 1000, NOW).xp, 1000)
  assert.equal(mon.xp, 125 + 1000)
  assert.equal(other.xp, 27)
  assert.equal(save.state.totals.xp, 1000)

  activateBoost(save, 'exp-share', NOW)
  const { events } = applyTurnXp(save, 1000, NOW)
  assert.equal(other.xp, 27 + 250, 'chaque autre mon reçoit 25 % en bonus')
  assert.equal(mon.xp, 125 + 2000, "l'actif garde 100 %")
  assert.ok(events.some((event) => event.type === 'level-up' && event.monId === other.id && !event.active))
})

test('applyTurnXp sans compagnon ne fait rien', () => {
  const { save } = startedSave()
  save.state.activeMonId = null
  assert.deepEqual(applyTurnXp(save, 1000, NOW), { xp: 0, events: [] })
})
