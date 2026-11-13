import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activateBoost, expireBoosts, formatRemaining, hasBoost } from '../../hooks/core/boosts.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW } from '../helpers/save.js'

const MINUTE = 60_000

test('un boost est actif pendant sa durée, puis expire avec un événement', () => {
  const save = emptySave()
  assert.deepEqual(activateBoost(save, 'incense', NOW), [
    { type: 'boost-start', boost: 'incense', expiresAt: NOW + 30 * MINUTE },
  ])
  assert.equal(hasBoost(save, 'incense', NOW + 29 * MINUTE), true)
  assert.equal(hasBoost(save, 'incense', NOW + 30 * MINUTE), false)
  assert.equal(hasBoost(save, 'lucky-egg', NOW), false)
  assert.deepEqual(expireBoosts(save, NOW + 10 * MINUTE), [])
  assert.deepEqual(expireBoosts(save, NOW + 30 * MINUTE), [{ type: 'boost-end', boost: 'incense' }])
  assert.deepEqual(save.boosts, [])
})

test('réactiver un boost actif prolonge sa durée', () => {
  const save = emptySave()
  activateBoost(save, 'lucky-egg', NOW)
  activateBoost(save, 'lucky-egg', NOW + 20 * MINUTE)
  assert.deepEqual(save.boosts, [{ id: 'lucky-egg', expiresAt: NOW + 120 * MINUTE }])
  // Expiré mais pas encore nettoyé : la durée repart de maintenant
  activateBoost(save, 'lucky-egg', NOW + 300 * MINUTE)
  assert.equal(save.boosts[0].expiresAt, NOW + 360 * MINUTE)
})

test('formatRemaining', () => {
  assert.equal(formatRemaining(40_000), '40 s')
  assert.equal(formatRemaining(12 * MINUTE), '12 min')
  assert.equal(formatRemaining(65 * MINUTE), '1 h 05')
  assert.equal(formatRemaining(-5), '0 s')
})
