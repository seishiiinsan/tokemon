import assert from 'node:assert/strict'
import { test } from 'node:test'
import { levelForXp, levelProgress, xpForLevel } from '../../hooks/core/levels.js'

test('courbe medium fast : niveau n = n³', () => {
  assert.equal(xpForLevel(1), 1)
  assert.equal(xpForLevel(50), 125_000)
  assert.equal(xpForLevel(100), 1_000_000)
  assert.equal(xpForLevel(250), 1_000_000, 'plafonné au niveau max')
})

test('levelForXp est la réciproque exacte de xpForLevel', () => {
  for (let level = 1; level <= 100; level++) {
    assert.equal(levelForXp(xpForLevel(level)), level)
    if (level > 1) assert.equal(levelForXp(xpForLevel(level) - 1), level - 1)
  }
  assert.equal(levelForXp(0), 1)
  assert.equal(levelForXp(-5), 1)
  assert.equal(levelForXp(5_000_000), 100)
})

test('levelProgress : progression dans le niveau courant', () => {
  assert.deepEqual(levelProgress({ level: 5, xp: 125 }), { current: 0, needed: 91, ratio: 0 })
  const half = levelProgress({ level: 10, xp: 1000 + 165 })
  assert.equal(half.needed, 331)
  assert.equal(half.current, 165)
  assert.ok(Math.abs(half.ratio - 165 / 331) < 1e-9)
  assert.deepEqual(levelProgress({ level: 100, xp: 1_000_000 }), { current: 0, needed: 0, ratio: 1 })
})
