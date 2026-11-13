import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ENCOUNTER_EVERY, WILD_DURATION_MS } from '../../hooks/config.js'
import { activateBoost } from '../../hooks/core/boosts.js'
import {
  encounterChance,
  expireWild,
  rollEncounters,
  shinyChance,
  spawnWeight,
  spawnWild,
} from '../../hooks/core/encounter.js'
import { applyTurn, housekeeping, needsHousekeeping } from '../../hooks/core/turn.js'
import { rarityOf } from '../../hooks/data/rarity.js'
import { SPECIES } from '../../hooks/data/species.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

const gen1 = (/** @type {string} */ id) => SPECIES[id].gen === 1

test('poids de spawn : rareté, divisé par 3 au stade 2 et par 9 au stade 3, partagé entre les formes', () => {
  assert.equal(spawnWeight('pidgey'), 60)
  assert.equal(spawnWeight('pidgeotto'), 20)
  assert.ok(Math.abs(spawnWeight('pidgeot') - 60 / 9) < 1e-9)
  assert.equal(spawnWeight('mewtwo'), 1)
  assert.equal(spawnWeight('dragonite'), 4 / 9)
  assert.equal(spawnWeight('unown_a'), 25 / 28)
  assert.equal(spawnWeight('inconnu'), 0)
})

test('raretés : légendaires, lignées et défaut', () => {
  for (const id of ['articuno', 'zapdos', 'moltres', 'mewtwo', 'mew']) assert.equal(rarityOf(id), 'legendary')
  assert.equal(rarityOf('dragonair'), 'epic', 'la lignée hérite')
  assert.equal(rarityOf('charizard'), 'rare')
  assert.equal(rarityOf('rattata'), 'common')
  assert.equal(rarityOf('inconnu'), 'common')
})

test('35 % par palier, doublé sous Encens ; shiny 1/512, triplé sous Charme Chroma', () => {
  const save = emptySave()
  assert.equal(encounterChance(save, NOW), 0.35)
  assert.equal(shinyChance(save, NOW), 1 / 512)
  activateBoost(save, 'incense', NOW)
  activateBoost(save, 'shiny-charm', NOW)
  assert.equal(encounterChance(save, NOW), 0.7)
  assert.equal(shinyChance(save, NOW), 3 / 512)
})

test('un tirage tous les 5 000 tokens cumulés', () => {
  const { save } = startedSave()
  assert.deepEqual(rollEncounters(save, ENCOUNTER_EVERY - 1, testCtx({ rolls: [0] })), [], 'palier non atteint')
  assert.equal(save.state.counters.sinceEncounter, ENCOUNTER_EVERY - 1)
  // Tirages : rencontre (0,1 < 0,35), espèce, shiny (0,9 : non), niveau
  const events = rollEncounters(save, 1, testCtx({ rolls: [0.1, 0.5, 0.9, 0.5], available: gen1 }))
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'encounter')
  assert.equal(save.state.counters.sinceEncounter, 0)
  assert.ok(save.state.wild)
  assert.equal(save.state.wild.shiny, false)
  assert.equal(save.state.wild.expiresAt, NOW + WILD_DURATION_MS)
  assert.equal(save.state.stats.encounters, 1)
  assert.equal(save.dex[save.state.wild.species].seen, 1)
  assert.equal(save.dex[save.state.wild.species].caught, 0)
})

test('tirage raté, mon déjà présent, starter non choisi : pas de rencontre mais le palier est consommé', () => {
  const { save } = startedSave()
  assert.deepEqual(rollEncounters(save, ENCOUNTER_EVERY, testCtx({ rolls: [0.9] })), [])
  assert.equal(save.state.counters.sinceEncounter, 0)
  spawnWild(save, testCtx(), { species: 'pidgey' })
  assert.deepEqual(rollEncounters(save, 3 * ENCOUNTER_EVERY, testCtx({ rolls: [0, 0, 0] })), [])
  assert.equal(save.state.wild?.species, 'pidgey')
  const fresh = emptySave()
  assert.deepEqual(rollEncounters(fresh, ENCOUNTER_EVERY, testCtx({ rolls: [0] })), [])
  assert.equal(fresh.state.wild, null)
})

test('plusieurs paliers dans un tour : un seul mon sauvage à la fois', () => {
  const { save } = startedSave()
  const events = rollEncounters(save, 4 * ENCOUNTER_EVERY + 10, testCtx({ seed: 5, available: gen1 }))
  assert.ok(events.length <= 1)
  assert.equal(save.state.counters.sinceEncounter, 10)
})

test('le pool ne contient que les espèces dont les sprites sont en local', () => {
  const { save } = startedSave()
  const ctx = testCtx({ seed: 9, available: gen1 })
  for (let i = 0; i < 300; i++) {
    save.state.wild = null
    spawnWild(save, ctx)
    assert.equal(SPECIES[/** @type {any} */ (save.state.wild).species].gen, 1)
  }
  save.state.wild = null
  assert.deepEqual(spawnWild(save, testCtx({ available: () => false })), [])
  assert.equal(save.state.wild, null)
})

test('distribution : les communs dominent, les légendaires sont rarissimes', () => {
  const { save } = startedSave()
  const ctx = testCtx({ seed: 21, available: gen1 })
  /** @type {Record<string, number>} */
  const counts = {}
  for (let i = 0; i < 4000; i++) {
    save.state.wild = null
    const [event] = spawnWild(save, ctx)
    if (event.type === 'encounter') counts[event.rarity] = (counts[event.rarity] ?? 0) + 1
  }
  assert.ok(counts.common > counts.uncommon && counts.uncommon > counts.rare && counts.rare > counts.epic)
  assert.ok((counts.legendary ?? 0) < 40)
})

test('shiny : compté et niveau dans la fourchette de la rareté', () => {
  const { save } = startedSave()
  const [event] = spawnWild(save, testCtx({ rolls: [0, 0.999] }), { species: 'mewtwo' })
  assert.deepEqual(event, { type: 'encounter', species: 'mewtwo', shiny: true, level: 70, rarity: 'legendary' })
  assert.equal(save.state.stats.shinySeen, 1)
  save.state.wild = null
  spawnWild(save, testCtx({ rolls: [0] }), { species: 'rattata', shiny: false })
  assert.equal(/** @type {any} */ (save.state.wild).level, 2)
})

test('le mon sauvage s’enfuit après 10 minutes', () => {
  const { save } = startedSave()
  spawnWild(save, testCtx(), { species: 'pidgey', shiny: false })
  assert.deepEqual(expireWild(save, NOW + WILD_DURATION_MS - 1), [])
  assert.equal(needsHousekeeping(save, NOW + WILD_DURATION_MS - 1), false)
  assert.equal(needsHousekeeping(save, NOW + WILD_DURATION_MS), true)
  assert.deepEqual(housekeeping(save, testCtx({ now: NOW + WILD_DURATION_MS })), [
    { type: 'fled', species: 'pidgey', reason: 'timeout' },
  ])
  assert.equal(save.state.wild, null)
  assert.equal(save.state.stats.fled, 1)
  assert.deepEqual(expireWild(save, NOW + WILD_DURATION_MS), [])
})

test('applyTurn déclenche les rencontres', () => {
  const { save } = startedSave()
  const outcome = applyTurn(
    save,
    { key: 't', tokens: ENCOUNTER_EVERY, approximate: false },
    testCtx({ rolls: [0.1], available: gen1 }),
  )
  assert.ok(outcome.events.some((event) => event.type === 'encounter'))
  assert.equal(save.history.events.at(-1)?.type, 'encounter')
})
