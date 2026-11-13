import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captureChance, throwBall } from '../../hooks/core/capture.js'
import { spawnWild } from '../../hooks/core/encounter.js'
import { xpForLevel } from '../../hooks/core/levels.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

/** @param {Record<string, number>} bag @param {string} species @param {boolean} [shiny] */
function withWild(bag, species, shiny = false) {
  const started = startedSave({ bag })
  spawnWild(started.save, testCtx({ rolls: [0.5] }), { species, shiny })
  return started.save
}

test('probabilité = taux de base de la rareté × multiplicateur de la Ball, plafonnée à 100 %', () => {
  assert.equal(captureChance('common', 'poke-ball'), 0.8)
  assert.equal(captureChance('common', 'great-ball'), 1, '0,8 × 1,5 plafonné')
  assert.equal(captureChance('uncommon', 'great-ball'), 0.6 * 1.5)
  assert.equal(captureChance('rare', 'ultra-ball'), 0.8)
  assert.equal(captureChance('epic', 'poke-ball'), 0.2)
  assert.equal(captureChance('legendary', 'ultra-ball'), 0.1)
  assert.equal(captureChance('legendary', 'master-ball'), 1, 'capture garantie')
  assert.equal(captureChance('common', 'pierre'), 0)
})

test('capture réussie : le mon rejoint la box et le Pokédex', () => {
  const save = withWild({ 'poke-ball': 2 }, 'pidgey')
  const level = /** @type {any} */ (save.state.wild).level
  const result = throwBall(save, '', testCtx({ rolls: [0.79] }))
  assert.equal(result.ok, true)
  assert.equal(result.events[0].type, 'captured')
  assert.equal(save.state.wild, null)
  assert.equal(save.bag['poke-ball'], 1)
  const caught = save.box.at(-1)
  assert.deepEqual(caught, {
    id: 2,
    species: 'pidgey',
    nickname: null,
    level,
    xp: xpForLevel(level),
    shiny: false,
    caughtAt: NOW,
  })
  assert.deepEqual(save.dex.pidgey, { seen: 1, caught: 1, shiny: 0 })
  assert.deepEqual([save.state.stats.throws, save.state.stats.captures, save.state.stats.itemsUsed], [1, 1, 1])
  assert.equal(save.state.activeMonId, 1, 'le compagnon ne change pas')
})

test('échec : le mon reste, puis fuit au 3ᵉ lancer raté', () => {
  const save = withWild({ 'poke-ball': 5 }, 'pidgey')
  const first = throwBall(save, 'poke', testCtx({ rolls: [0.8] }))
  assert.deepEqual(first.events, [{ type: 'throw-failed', species: 'pidgey', ball: 'poke-ball', left: 2 }])
  assert.match(first.message, /Encore 2 essais/)
  assert.match(throwBall(save, '', testCtx({ rolls: [0.99] })).message, /Encore 1 essai\./)
  const last = throwBall(save, '', testCtx({ rolls: [0.99] }))
  assert.deepEqual(
    last.events.map((event) => event.type),
    ['throw-failed', 'fled'],
  )
  assert.equal(save.state.wild, null)
  assert.equal(save.bag['poke-ball'], 2)
  assert.deepEqual([save.state.stats.throws, save.state.stats.captures, save.state.stats.fled], [3, 0, 1])
  assert.equal(save.box.length, 1)
})

test('choix de la Ball : la plus simple par défaut, ou celle demandée', () => {
  const save = withWild({ 'ultra-ball': 1, 'great-ball': 1 }, 'mewtwo')
  throwBall(save, '', testCtx({ rolls: [0.99] }))
  assert.equal(save.bag['great-ball'], undefined, 'Super Ball avant Hyper Ball')
  assert.equal(save.bag['ultra-ball'], 1)
  assert.match(throwBall(save, 'master', testCtx()).message, /Tu n'as pas de Master Ball/)
  assert.match(throwBall(save, 'bonbon', testCtx()).message, /n'est pas une Ball/)
  assert.match(throwBall(save, 'hyper ball', testCtx({ rolls: [0.99] })).message, /Raté/)
  assert.match(throwBall(save, '', testCtx()).message, /plus de Ball/)
})

test('Master Ball : capture garantie, même un légendaire shiny', () => {
  const save = withWild({ 'master-ball': 1 }, 'mewtwo', true)
  const result = throwBall(save, 'master', testCtx({ rolls: [0.999999] }))
  assert.equal(result.ok, true)
  assert.equal(save.box.at(-1)?.shiny, true, 'un shiny capturé reste shiny')
  assert.equal(save.dex.mewtwo.shiny, 1)
  assert.equal(save.state.stats.shinyCaught, 1)
  assert.equal(save.state.stats.masterBallsUsed, 1)
})

test('sans mon sauvage, rien à lancer', () => {
  const { save } = startedSave({ bag: { 'poke-ball': 1 } })
  assert.equal(throwBall(save, '', testCtx()).ok, false)
  assert.equal(save.bag['poke-ball'], 1)
})

test('taux observé conforme sur 4 000 lancers (rare × Super Ball = 60 %)', () => {
  const ctx = testCtx({ seed: 33 })
  let caught = 0
  for (let i = 0; i < 4000; i++) {
    const save = withWild({ 'great-ball': 1 }, 'charmander')
    if (throwBall(save, 'super', ctx).events[0].type === 'captured') caught++
  }
  assert.ok(Math.abs(caught / 4000 - 0.6) < 0.03)
})
