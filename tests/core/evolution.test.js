import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EVOLUTION_DELAY_MS } from '../../hooks/config.js'
import { addMon } from '../../hooks/core/context.js'
import {
  cancelEvolution,
  describeMethod,
  evolutionsOf,
  evolveActive,
  evolveWithItem,
  readyLevelEvolution,
  requiredLevel,
  resolvePendingEvolution,
  startLevelEvolution,
} from '../../hooks/core/evolution.js'
import { parseUse, useItem } from '../../hooks/core/items.js'
import { xpForLevel } from '../../hooks/core/levels.js'
import { applyTurn, housekeeping, needsHousekeeping } from '../../hooks/core/turn.js'
import { NOW, startedSave, testCtx } from '../helpers/save.js'

const gen1Only = (/** @type {string} */ id) =>
  !['espeon', 'umbreon', 'leafeon', 'glaceon', 'crobat', 'steelix', 'magnezone'].includes(id)

test('niveau requis : officiel, ou repli configurable pour les méthodes hors V1', () => {
  assert.equal(requiredLevel({ to: 'ivysaur', type: 'level', level: 16 }), 16)
  assert.equal(requiredLevel({ to: 'raichu', type: 'stone', item: 'thunder-stone' }), null)
  assert.equal(requiredLevel({ to: 'alakazam', type: 'trade' }), null)
  assert.equal(requiredLevel({ to: 'pikachu', type: 'special', after: 0, baby: true }), 15)
  assert.equal(requiredLevel({ to: 'espeon', type: 'special', after: 0 }), 30)
  assert.equal(
    requiredLevel({ to: 'x', type: 'special', after: 25 }),
    35,
    'au moins 10 niveaux après le stade précédent',
  )
  assert.equal(describeMethod({ to: 'raichu', type: 'stone', item: 'thunder-stone' }), 'Pierre Foudre')
  assert.equal(describeMethod({ to: 'alakazam', type: 'trade' }), 'Link Cable')
  assert.equal(describeMethod({ to: 'ivysaur', type: 'level', level: 16 }), 'niveau 16')
})

test('seules les évolutions dont les sprites sont en local sont proposées', () => {
  const all = evolutionsOf('eevee', testCtx()).map((evolution) => evolution.to)
  assert.deepEqual(all, ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon'])
  const local = evolutionsOf('eevee', testCtx({ available: gen1Only })).map((evolution) => evolution.to)
  assert.deepEqual(local, ['vaporeon', 'jolteon', 'flareon'])
  assert.deepEqual(evolutionsOf('mew', testCtx()), [])
})

test('évolution par niveau : annoncée au niveau requis, appliquée après le délai', () => {
  const { save, mon } = startedSave({ species: 'bulbasaur', level: 15 })
  assert.deepEqual(startLevelEvolution(save, testCtx()), [], 'niveau 15 : rien')
  const outcome = applyTurn(save, { key: 't1', tokens: xpForLevel(16) - mon.xp, approximate: false }, testCtx())
  assert.equal(mon.level, 16)
  assert.ok(outcome.events.some((event) => event.type === 'evolution-start' && event.to === 'ivysaur'))
  assert.deepEqual(save.state.pendingEvolution, { monId: mon.id, to: 'ivysaur', startedAt: NOW })
  assert.equal(mon.species, 'bulbasaur', "pas encore évolué : la fenêtre d'annulation court")
  assert.deepEqual(startLevelEvolution(save, testCtx()), [], 'pas de seconde annonce')

  assert.equal(needsHousekeeping(save, NOW + EVOLUTION_DELAY_MS - 1), false)
  assert.deepEqual(resolvePendingEvolution(save, testCtx({ now: NOW + EVOLUTION_DELAY_MS - 1 })), [])
  assert.equal(needsHousekeeping(save, NOW + EVOLUTION_DELAY_MS), true)
  const events = housekeeping(save, testCtx({ now: NOW + EVOLUTION_DELAY_MS }))
  assert.deepEqual(events.slice(0, 2), [
    { type: 'evolved', monId: mon.id, name: 'Bulbizarre', from: 'bulbasaur', to: 'ivysaur', method: 'level' },
    { type: 'achievement', id: 'first-evolution' },
  ])
  assert.equal(mon.species, 'ivysaur')
  assert.equal(mon.evolvedFrom, 'bulbasaur')
  assert.equal(mon.level, 16, 'le niveau est conservé')
  assert.equal(save.state.pendingEvolution, null)
  assert.equal(save.dex.ivysaur.caught, 1)
  assert.equal(save.state.stats.evolutions, 1)
  assert.ok(save.history.events.some((entry) => entry.type === 'evolved'))
})

test('/tokemon stop annule et bloque, /tokemon evolve relance', () => {
  const { save, mon } = startedSave({ species: 'charmander', level: 16 })
  assert.equal(cancelEvolution(save).ok, false, 'rien à annuler')
  assert.equal(startLevelEvolution(save, testCtx()).length, 1)
  const cancelled = cancelEvolution(save)
  assert.equal(cancelled.ok, true)
  assert.deepEqual(cancelled.events, [{ type: 'evolution-cancelled', name: 'Salamèche' }])
  assert.equal(mon.noEvolve, true)
  assert.equal(save.state.pendingEvolution, null)
  // Les niveaux suivants ne relancent pas l'évolution
  applyTurn(save, { key: 't2', tokens: 5000, approximate: false }, testCtx())
  assert.equal(save.state.pendingEvolution, null)
  assert.equal(mon.species, 'charmander')

  const result = evolveActive(save, '', testCtx())
  assert.equal(result.ok, true)
  assert.equal(mon.species, 'charmeleon')
  assert.equal(mon.noEvolve, undefined)
})

test("l'évolution en attente tombe si le mon a disparu ou si la cible n'est plus disponible", () => {
  const { save, mon } = startedSave({ species: 'bulbasaur', level: 16 })
  startLevelEvolution(save, testCtx())
  assert.deepEqual(
    resolvePendingEvolution(save, testCtx({ now: NOW + EVOLUTION_DELAY_MS, available: () => false })),
    [],
  )
  assert.equal(save.state.pendingEvolution, null)
  assert.equal(mon.species, 'bulbasaur')
  save.state.pendingEvolution = { monId: 999, to: 'ivysaur', startedAt: NOW }
  assert.deepEqual(resolvePendingEvolution(save, testCtx({ now: NOW + EVOLUTION_DELAY_MS })), [])
})

test('pierre : /tokemon use consomme la pierre et fait évoluer', () => {
  const { save, mon } = startedSave({ species: 'pikachu', level: 8, bag: { 'thunder-stone': 1, 'fire-stone': 1 } })
  assert.equal(useItem(save, 'pierre feu', testCtx()).ok, false, 'mauvaise pierre')
  assert.equal(save.bag['fire-stone'], 1, 'pierre non consommée')
  const result = useItem(save, 'pierre foudre', testCtx())
  assert.equal(result.ok, true)
  assert.equal(mon.species, 'raichu')
  assert.equal(save.bag['thunder-stone'], undefined)
  assert.equal(save.state.stats.stoneEvolutions, 1)
  assert.equal(save.state.stats.itemsUsed, 1)
  assert.equal(result.events[0].type === 'evolved' && result.events[0].method, 'stone')
})

test('échange : le Link Cable fait évoluer Kadabra, y compris dans la box', () => {
  const { save } = startedSave({ bag: { 'link-cable': 1 } })
  const kadabra = addMon(save, { species: 'kadabra', level: 20 }, NOW)
  assert.equal(useItem(save, 'link cable', testCtx()).ok, false, 'sans effet sur Bulbizarre')
  assert.equal(save.bag['link-cable'], 1)
  const result = useItem(save, 'link cable kadabra', testCtx())
  assert.equal(result.ok, true)
  assert.equal(kadabra.species, 'alakazam')
  assert.equal(save.state.stats.tradeEvolutions, 1)
  assert.equal(evolveWithItem(save, kadabra, 'link-cable', testCtx()).ok, false, 'plus de câble ni d’évolution')
})

test('Évoli : choix de la forme, avec la pierre correspondante', () => {
  const ctx = testCtx({ available: gen1Only })
  const { save, mon } = startedSave({ species: 'eevee', level: 10, bag: { 'water-stone': 1 } })
  assert.match(evolveActive(save, '', ctx).message, /Précise la forme.*Aquali \(Pierre Eau\).*Voltali.*Pyroli/)
  assert.match(evolveActive(save, 'dracaufeu', ctx).message, /ne peut pas évoluer/)
  assert.match(evolveActive(save, 'voltali', ctx).message, /Pierre Foudre/)
  assert.match(evolveActive(save, 'mentali', ctx).message, /ne peut pas évoluer/, 'sprites gen 2 absents')
  const result = evolveActive(save, 'aquali', ctx)
  assert.equal(result.ok, true)
  assert.equal(mon.species, 'vaporeon')
  assert.equal(save.bag['water-stone'], undefined)
})

test('Évoli : les formes des gens suivantes par niveau quand leurs sprites sont là', () => {
  const { save, mon } = startedSave({ species: 'eevee', level: 29 })
  assert.match(evolveActive(save, 'mentali', testCtx()).message, /niveau 30/)
  mon.level = 30
  assert.equal(readyLevelEvolution(mon, testCtx())?.to, 'espeon')
  assert.equal(evolveActive(save, 'noctali', testCtx()).ok, true)
  assert.equal(mon.species, 'umbreon')
})

test('evolve : cas sans évolution, sprites manquants, sans compagnon', () => {
  const { save, mon } = startedSave({ species: 'mew', level: 50 })
  assert.match(evolveActive(save, '', testCtx()).message, /n'a pas d'évolution/)
  mon.species = 'golbat'
  assert.match(evolveActive(save, '', testCtx({ available: gen1Only })).message, /download gen2/)
  mon.species = 'abra'
  mon.level = 10
  assert.match(evolveActive(save, '', testCtx()).message, /niveau 16/)
  save.state.activeMonId = null
  assert.equal(evolveActive(save, '', testCtx()).ok, false)
})

test('use : analyse des arguments et cas refusés', () => {
  assert.equal(parseUse('pierre feu évoli')?.item.id, 'fire-stone')
  assert.equal(parseUse('pierre feu évoli')?.target, 'évoli')
  assert.equal(parseUse('Super Bonbon #2')?.target, '#2')
  assert.equal(parseUse('truc'), null)
  const { save } = startedSave({ bag: { 'poke-ball': 1, 'rare-candy': 1 } })
  assert.match(useItem(save, '', testCtx()).message, /Précise/)
  assert.match(useItem(save, 'truc', testCtx()).message, /inconnu/)
  assert.match(useItem(save, 'hyper ball', testCtx()).message, /Tu n'as pas/)
  assert.match(useItem(save, 'poke ball', testCtx()).message, /catch/)
  assert.match(useItem(save, 'bonbon mewtwo', testCtx()).message, /Aucun/)
  save.state.activeMonId = null
  assert.match(useItem(save, 'bonbon', testCtx()).message, /Pas de compagnon/)
})

test('Super Bonbon : +1 niveau, peut déclencher une évolution', () => {
  const { save, mon } = startedSave({ species: 'bulbasaur', level: 15, bag: { 'rare-candy': 2 } })
  const result = useItem(save, 'bonbon', testCtx())
  assert.equal(result.ok, true)
  assert.equal(mon.level, 16)
  assert.deepEqual(
    result.events.map((event) => event.type),
    ['level-up', 'evolution-start'],
  )
  mon.level = 100
  mon.xp = 1_000_000
  assert.match(useItem(save, 'bonbon', testCtx()).message, /déjà au niveau 100/)
  assert.equal(save.bag['rare-candy'], 1)
})
