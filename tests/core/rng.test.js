import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chance, createRng, pickWeighted, randomInt } from '../../hooks/core/rng.js'

test('createRng : même seed, même séquence', () => {
  const a = createRng(42)
  const b = createRng(42)
  const first = Array.from({ length: 20 }, () => a())
  assert.deepEqual(
    first,
    Array.from({ length: 20 }, () => b()),
  )
  assert.notDeepEqual(first, Array.from({ length: 20 }, createRng(43)))
})

test('createRng : valeurs dans [0, 1) et à peu près uniformes', () => {
  const rng = createRng(7)
  let sum = 0
  for (let i = 0; i < 20_000; i++) {
    const value = rng()
    assert.ok(value >= 0 && value < 1)
    sum += value
  }
  assert.ok(Math.abs(sum / 20_000 - 0.5) < 0.02)
})

test('chance : respecte la probabilité', () => {
  const rng = createRng(1)
  let hits = 0
  for (let i = 0; i < 20_000; i++) if (chance(rng, 0.35)) hits++
  assert.ok(Math.abs(hits / 20_000 - 0.35) < 0.02)
  assert.equal(
    chance(() => 0.99, 1),
    true,
  )
  assert.equal(
    chance(() => 0, 0),
    false,
  )
})

test('randomInt : bornes incluses', () => {
  const rng = createRng(3)
  const seen = new Set()
  for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 2, 5))
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5])
})

test('pickWeighted : proportionnel aux poids, ignore les poids nuls', () => {
  const rng = createRng(11)
  const items = [
    { id: 'a', weight: 60 },
    { id: 'b', weight: 30 },
    { id: 'c', weight: 10 },
    { id: 'never', weight: 0 },
  ]
  /** @type {Record<string, number>} */
  const counts = {}
  for (let i = 0; i < 20_000; i++) {
    const picked = pickWeighted(rng, items, (item) => item.weight)
    assert.ok(picked)
    counts[picked.id] = (counts[picked.id] ?? 0) + 1
  }
  assert.equal(counts.never, undefined)
  assert.ok(Math.abs(counts.a / 20_000 - 0.6) < 0.02)
  assert.ok(Math.abs(counts.c / 20_000 - 0.1) < 0.02)
  assert.equal(
    pickWeighted(rng, [], () => 1),
    undefined,
  )
  assert.equal(
    pickWeighted(rng, items.slice(3), (item) => item.weight),
    undefined,
  )
  assert.equal(
    pickWeighted(
      () => 0.999999,
      items.slice(0, 2),
      (item) => item.weight,
    )?.id,
    'b',
  )
})
