import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CONDITIONS, checkAchievements } from '../../hooks/core/achievements.js'
import { throwBall } from '../../hooks/core/capture.js'
import { addMon } from '../../hooks/core/context.js'
import { spawnWild } from '../../hooks/core/encounter.js'
import { describeEvent } from '../../hooks/core/events.js'
import { evolveActive } from '../../hooks/core/evolution.js'
import { useItem } from '../../hooks/core/items.js'
import { touchStreak } from '../../hooks/core/stats.js'
import { applyTurn, settle } from '../../hooks/core/turn.js'
import { ACHIEVEMENT_LIST } from '../../hooks/data/achievements.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

const DAY = 24 * 3600 * 1000
/** @param {import('../../hooks/core/events.js').GameEvent[]} events */
const unlocked = (events) => events.flatMap((event) => (event.type === 'achievement' ? [event.id] : []))

test('chaque succès a une condition, et inversement', () => {
  assert.deepEqual(Object.keys(CONDITIONS).sort(), ACHIEVEMENT_LIST.map((achievement) => achievement.id).sort())
  assert.ok(ACHIEVEMENT_LIST.length >= 20)
})

test('rien avant le starter, rien de débloqué au départ', () => {
  assert.deepEqual(checkAchievements(emptySave(), NOW), [])
  const { save } = startedSave()
  assert.deepEqual(checkAchievements(save, NOW), [])
})

test('première capture : succès, récompense, une seule fois', () => {
  const { save } = startedSave({ bag: { 'poke-ball': 1 } })
  spawnWild(save, testCtx(), { species: 'pidgey', shiny: false })
  const result = throwBall(save, '', testCtx({ rolls: [0] }))
  const events = settle(save, result.events, testCtx())
  assert.deepEqual(unlocked(events), ['first-catch'])
  assert.deepEqual(events.at(-1), { type: 'drop', item: 'poke-ball', count: 5, reason: 'achievement' })
  assert.equal(save.bag['poke-ball'], 5)
  assert.equal(save.achievements['first-catch'], NOW)
  assert.deepEqual(checkAchievements(save, NOW + 1), [], 'pas de second déblocage')
  assert.deepEqual(
    save.history.events.map((entry) => entry.type),
    ['captured', 'achievement', 'drop'],
  )
})

test('paliers de captures, shiny, légendaire, Master Ball', () => {
  const { save } = startedSave({ bag: { 'master-ball': 1 } })
  // Un légendaire sauvage est au moins niveau 50 : ce succès tombe avec les autres
  spawnWild(save, testCtx(), { species: 'mewtwo', shiny: true })
  throwBall(save, 'master', testCtx())
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), [
    'first-catch',
    'first-shiny',
    'first-legendary',
    'level-50',
    'master-ball-used',
  ])
  save.state.stats.captures = 50
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['catch-10', 'catch-50'])
  save.state.stats.captures = 151
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['catch-151'])
})

test('Pokédex : espèces distinctes capturées', () => {
  const { save } = startedSave()
  const ids = [
    'pidgey',
    'rattata',
    'spearow',
    'ekans',
    'sandshrew',
    'vulpix',
    'zubat',
    'oddish',
    'paras',
    'venonat',
    'diglett',
    'meowth',
    'psyduck',
    'mankey',
    'growlithe',
    'poliwag',
    'abra',
    'machop',
    'bellsprout',
    'tentacool',
    'geodude',
    'ponyta',
    'slowpoke',
    'magnemite',
  ]
  for (const id of ids) addMon(save, { species: id, level: 3 }, NOW)
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['dex-25'], '24 + le starter')
  addMon(save, { species: 'pikachu_female', level: 3 }, NOW)
  addMon(save, { species: 'pikachu', level: 3 }, NOW)
  assert.equal(CONDITIONS['dex-100'](save), false)
})

test('tokens cumulés : 100k, 1M, 10M', () => {
  const { save } = startedSave()
  const first = applyTurn(
    save,
    { key: 'a', tokens: 100_000, approximate: false },
    testCtx({ rolls: Array(200).fill(0.99) }),
  )
  assert.ok(unlocked(first.events).includes('tokens-100k'))
  save.state.totals.outputTokens = 10_000_000
  const ids = unlocked(checkAchievements(save, NOW))
  assert.ok(ids.includes('tokens-1m') && ids.includes('tokens-10m'))
})

test('évolutions : première, par pierre, par échange, Évoli', () => {
  const { save, mon } = startedSave({ species: 'eevee', level: 10, bag: { 'water-stone': 1, 'link-cable': 1 } })
  const evolved = evolveActive(save, 'aquali', testCtx())
  assert.deepEqual(unlocked(settle(save, evolved.events, testCtx())), [
    'first-evolution',
    'stone-evolution',
    'eevee-evolution',
  ])
  assert.equal(mon.evolvedFrom, 'eevee')
  addMon(save, { species: 'kadabra', level: 20 }, NOW)
  const traded = useItem(save, 'link cable kadabra', testCtx())
  assert.deepEqual(unlocked(settle(save, traded.events, testCtx())), ['trade-evolution'])
})

test('niveaux 50 et 100, série de 7 jours, 25 items', () => {
  const { save, mon } = startedSave()
  mon.level = 49
  assert.deepEqual(checkAchievements(save, NOW), [])
  mon.level = 50
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['level-50'])
  mon.level = 100
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['level-100'])
  for (let day = 0; day < 7; day++) touchStreak(save, NOW + day * DAY)
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['streak-7'])
  save.state.stats.itemsFound = 25
  assert.deepEqual(unlocked(checkAchievements(save, NOW)), ['items-25'])
})

test('chaque événement a son texte', () => {
  /** @type {import('../../hooks/core/events.js').GameEvent[]} */
  const events = [
    { type: 'starter', species: 'pikachu' },
    { type: 'level-up', monId: 1, name: 'Pikachu', from: 5, to: 6, active: true },
    { type: 'evolution-start', monId: 1, name: 'Pikachu', to: 'raichu' },
    { type: 'evolution-cancelled', name: 'Pikachu' },
    { type: 'evolved', monId: 1, name: 'Pikachu', from: 'pikachu', to: 'raichu', method: 'stone' },
    { type: 'encounter', species: 'mew', shiny: true, level: 50, rarity: 'legendary' },
    { type: 'captured', species: 'mew', shiny: true, level: 50, ball: 'master-ball', monId: 2 },
    { type: 'throw-failed', species: 'mew', ball: 'poke-ball', left: 1 },
    { type: 'throw-failed', species: 'mew', ball: 'poke-ball', left: 0 },
    { type: 'fled', species: 'mew', reason: 'timeout' },
    { type: 'fled', species: 'mew', reason: 'throws' },
    { type: 'drop', item: 'poke-ball', count: 3, reason: 'drop' },
    { type: 'drop', item: 'master-ball', count: 1, reason: 'milestone' },
    { type: 'drop', item: 'inconnu', count: 1, reason: 'achievement' },
    { type: 'boost-start', boost: 'incense', expiresAt: NOW },
    { type: 'boost-end', boost: 'incense' },
    { type: 'achievement', id: 'first-catch' },
    { type: 'achievement', id: 'inconnu' },
  ]
  const texts = events.map(describeEvent)
  for (const text of texts) assert.ok(text.length > 5)
  assert.equal(texts[5], 'Un Mew ✨ shiny sauvage apparaît ! (Légendaire, niv. 50) /tokemon catch')
  assert.equal(texts[6], 'Mew ✨ est capturé avec une Master Ball !')
  assert.equal(texts[7], 'Raté ! Mew sort de la Poké Ball. Encore 1 essai.')
  assert.equal(texts[11], 'Tu trouves : Poké Ball ×3')
  assert.equal(texts[12], 'Palier de tokens atteint : Master Ball !')
  assert.equal(texts[16], 'Succès débloqué : Premier pas')
})
