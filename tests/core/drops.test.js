import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DROP_EVERY, MASTER_BALL_MILESTONE } from '../../hooks/config.js'
import { hasBoost } from '../../hooks/core/boosts.js'
import { dropItem, milestoneDrops, rollDrops } from '../../hooks/core/drops.js'
import { spawnWild } from '../../hooks/core/encounter.js'
import { useItem } from '../../hooks/core/items.js'
import { applyTurn } from '../../hooks/core/turn.js'
import { xpForTokens } from '../../hooks/core/xp.js'
import { ITEM_LIST } from '../../hooks/data/items.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

test('un tirage à 15 % tous les 2 000 tokens cumulés', () => {
  const { save } = startedSave()
  assert.deepEqual(rollDrops(save, DROP_EVERY - 1, testCtx({ rolls: [0] })), [])
  assert.deepEqual(rollDrops(save, 1, testCtx({ rolls: [0.15] })), [], '0,15 n’est pas < 0,15')
  assert.equal(save.state.counters.sinceDrop, 0)
  const events = rollDrops(save, DROP_EVERY, testCtx({ rolls: [0.149, 0] }))
  assert.deepEqual(events, [{ type: 'drop', item: 'poke-ball', count: 1, reason: 'drop' }])
  assert.equal(save.bag['poke-ball'], 1)
  assert.equal(save.state.stats.itemsFound, 1)
})

test('plusieurs paliers dans un tour : plusieurs tirages', () => {
  const { save } = startedSave()
  const events = rollDrops(save, 3 * DROP_EVERY + 5, testCtx({ rolls: [0, 0, 0.9, 0, 0.999999] }))
  assert.equal(events.length, 2)
  assert.equal(save.state.counters.sinceDrop, 5)
  assert.equal(events[1].type === 'drop' && events[1].item, 'shiny-charm', 'fin de table')
})

test('pas de drop avant le choix du starter', () => {
  const save = emptySave()
  assert.deepEqual(rollDrops(save, 5 * DROP_EVERY, testCtx({ rolls: [0, 0, 0, 0, 0] })), [])
  assert.deepEqual(milestoneDrops(save, 0, MASTER_BALL_MILESTONE), [])
  assert.deepEqual(save.bag, {})
})

test('table pondérée : fréquences conformes aux poids', () => {
  const { save } = startedSave()
  const ctx = testCtx({ seed: 77 })
  const total = ITEM_LIST.reduce((sum, item) => sum + item.dropWeight, 0)
  const draws = 30_000
  for (let i = 0; i < draws; i++) dropItem(save, ctx)
  for (const [id, weight] of [
    ['poke-ball', 30],
    ['great-ball', 12],
    ['fire-stone', 3],
    ['rare-candy', 6],
  ]) {
    assert.ok(Math.abs((save.bag[id] ?? 0) / draws - Number(weight) / total) < 0.012, String(id))
  }
  assert.ok((save.bag['master-ball'] ?? 0) < draws * 0.008, 'Master Ball rarissime')
  assert.equal(Math.round(total * 10) / 10, 90.2)
})

test('Master Ball garantie à chaque million de tokens cumulés', () => {
  const { save } = startedSave()
  assert.deepEqual(milestoneDrops(save, 0, 999_999), [])
  assert.deepEqual(milestoneDrops(save, 999_999, 1_000_000), [
    { type: 'drop', item: 'master-ball', count: 1, reason: 'milestone' },
  ])
  assert.deepEqual(milestoneDrops(save, 1_000_000, 1_500_000), [])
  assert.deepEqual(milestoneDrops(save, 1_900_000, 4_100_000), [
    { type: 'drop', item: 'master-ball', count: 3, reason: 'milestone' },
  ])
  assert.equal(save.bag['master-ball'], 4)
  save.state.totals.outputTokens = MASTER_BALL_MILESTONE - 10
  const outcome = applyTurn(save, { key: 'm', tokens: 20, approximate: false }, testCtx())
  assert.ok(outcome.events.some((event) => event.type === 'drop' && event.reason === 'milestone'))
})

test('applyTurn alimente le sac', () => {
  const { save } = startedSave()
  const outcome = applyTurn(save, { key: 'd', tokens: DROP_EVERY, approximate: false }, testCtx({ rolls: [0, 0.5] }))
  const drop = outcome.events.find((event) => event.type === 'drop')
  assert.ok(drop && drop.type === 'drop')
  assert.equal(save.bag[drop.item], 1)
  assert.equal(save.history.events.at(-1)?.type, 'drop')
})

test('drop imposé (debug)', () => {
  const { save } = startedSave()
  dropItem(save, testCtx(), 'lucky-egg')
  assert.equal(save.bag['lucky-egg'], 1)
})

test('consommables : baies (+XP fixe) sur le compagnon ou un mon de la box', () => {
  const { save, mon } = startedSave({ level: 20, bag: { 'oran-berry': 2, 'sitrus-berry': 1 } })
  assert.equal(useItem(save, 'baie oran', testCtx()).ok, true)
  assert.equal(mon.xp, 8000 + 500)
  assert.equal(useItem(save, 'sitrus #1', testCtx()).ok, true)
  assert.equal(mon.xp, 8000 + 2500)
  assert.equal(mon.level, 21)
  assert.deepEqual(save.bag, { 'oran-berry': 1 })
  assert.equal(save.state.stats.itemsUsed, 2)
})

test('boosts : Lucky Egg, Encens, Multi Exp, Charme Chroma modifient le jeu puis expirent', () => {
  const { save } = startedSave({ bag: { 'lucky-egg': 2, incense: 1, 'exp-share': 1, 'shiny-charm': 1 } })
  const egg = useItem(save, 'lucky egg', testCtx())
  assert.equal(egg.ok, true)
  assert.match(egg.message, /Lucky Egg activé : XP ×2 pendant 1 h \(reste 1 h 00\)/)
  assert.equal(xpForTokens(100, save, NOW), 200)
  useItem(save, 'egg', testCtx())
  assert.equal(save.boosts.length, 1, 'un second œuf prolonge le premier')
  assert.equal(hasBoost(save, 'lucky-egg', NOW + 119 * 60_000), true)
  for (const item of ['encens', 'multi exp', 'charme chroma']) assert.equal(useItem(save, item, testCtx()).ok, true)
  assert.deepEqual(save.boosts.map((boost) => boost.id).sort(), ['exp-share', 'incense', 'lucky-egg', 'shiny-charm'])
  assert.deepEqual(save.bag, {})

  // Après 31 minutes, seul l'Encens a expiré : un tour le signale
  const outcome = applyTurn(save, { key: 'x', tokens: 10, approximate: false }, testCtx({ now: NOW + 31 * 60_000 }))
  assert.deepEqual(
    outcome.events.filter((event) => event.type === 'boost-end'),
    [{ type: 'boost-end', boost: 'incense' }],
  )
  assert.equal(save.boosts.length, 3)
})

test('Charme Chroma : les shiny sont trois fois plus fréquents', () => {
  const count = (/** @type {boolean} */ charm) => {
    const { save } = startedSave({ bag: { 'shiny-charm': 1 } })
    if (charm) useItem(save, 'charme', testCtx())
    const ctx = testCtx({ seed: 4 })
    let shiny = 0
    for (let i = 0; i < 60_000; i++) {
      save.state.wild = null
      spawnWild(save, ctx, { species: 'pidgey' })
      if (/** @type {any} */ (save.state.wild).shiny) shiny++
    }
    return shiny
  }
  const [base, boosted] = [count(false), count(true)]
  assert.ok(Math.abs(base / 60_000 - 1 / 512) < 0.001)
  assert.ok(boosted > base * 2.2 && boosted < base * 3.8)
})
