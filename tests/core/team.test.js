import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addMon } from '../../hooks/core/context.js'
import { chooseStarter, findMon, setNickname, setVariant, switchActive, variantOf } from '../../hooks/core/team.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW, startedSave } from '../helpers/save.js'

test('starter : choix parmi les quatre, inventaire de départ, une seule fois', () => {
  const save = emptySave()
  assert.equal(chooseStarter(save, 'mewtwo', NOW).ok, false)
  assert.equal(chooseStarter(save, '', NOW).ok, false)
  const result = chooseStarter(save, 'Salamèche', NOW)
  assert.equal(result.ok, true)
  assert.deepEqual(result.events, [{ type: 'starter', species: 'charmander' }])
  assert.equal(save.box.length, 1)
  assert.equal(save.box[0].level, 5)
  assert.equal(save.state.activeMonId, save.box[0].id)
  assert.deepEqual(save.bag, { 'poke-ball': 10, 'rare-candy': 1 })
  assert.deepEqual(save.dex.charmander, { seen: 1, caught: 1, shiny: 0 })
  assert.equal(chooseStarter(save, 'pikachu', NOW).ok, false, 'pas de second starter')
  assert.equal(save.box.length, 1)
})

test('switch : libre, par nom, surnom ou numéro', () => {
  const { save, mon } = startedSave()
  const pidgey = addMon(save, { species: 'pidgey', level: 3 }, NOW)
  const eevee = addMon(save, { species: 'eevee', level: 9 }, NOW)
  eevee.nickname = 'Caramel'
  assert.equal(switchActive(save, 'roucool').ok, true)
  assert.equal(save.state.activeMonId, pidgey.id)
  assert.equal(switchActive(save, 'caramel').ok, true)
  assert.equal(save.state.activeMonId, eevee.id)
  assert.equal(switchActive(save, '#1').ok, true)
  assert.equal(save.state.activeMonId, mon.id)
  assert.match(switchActive(save, 'bulbizarre').message, /déjà/)
  assert.equal(switchActive(save, 'dracaufeu').ok, false)
  assert.equal(findMon(save, 'évo')?.id, eevee.id, 'préfixe du nom')
  assert.equal(findMon(save, '   '), undefined)
  assert.equal(findMon(save, '#9'), undefined)
})

test("switch annule l'évolution en attente et exige un starter", () => {
  assert.equal(switchActive(emptySave(), 'pikachu').ok, false)
  const { save } = startedSave()
  const other = addMon(save, { species: 'pidgey', level: 3 }, NOW)
  save.state.pendingEvolution = { monId: save.box[0].id, to: 'ivysaur', startedAt: NOW }
  switchActive(save, 'roucool')
  assert.equal(save.state.pendingEvolution, null)
  assert.equal(save.state.activeMonId, other.id)
})

test('surnom : posé, tronqué, retiré', () => {
  const { save, mon } = startedSave()
  assert.equal(setNickname(save, '  Bulbi   le   grand et magnifique ').ok, true)
  assert.equal(mon.nickname, 'Bulbi le grand e')
  setNickname(save, '')
  assert.equal(mon.nickname, null)
  save.state.activeMonId = null
  assert.equal(setNickname(save, 'x').ok, false)
})

test("variante d'affichage : réservée aux shiny", () => {
  const { save, mon } = startedSave()
  assert.equal(setVariant(save, 'shiny').ok, false)
  assert.equal(variantOf(mon), 'default')
  mon.shiny = true
  assert.equal(variantOf(mon), 'shiny')
  assert.equal(setVariant(save, 'default').ok, true)
  assert.equal(variantOf(mon), 'default')
  assert.equal(setVariant(save, 'shiny').ok, true)
  assert.equal(variantOf(mon), 'shiny')
  save.state.activeMonId = null
  assert.equal(setVariant(save, 'shiny').ok, false)
})
