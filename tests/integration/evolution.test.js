import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { createStubHost, textOf } from '../../scripts/stub-host.mjs'

const boxOf = (/** @type {{ store: Map<string, unknown> }} */ host) =>
  /** @type {any[]} */ (host.store.get(STORE_PREFIX + 'box'))

test('évolution par niveau : toast, annonce dans la bande, puis sprite changé', async () => {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  await host.command('start bulbizarre')
  await host.turn(16 ** 3 - 125)
  assert.ok(host.ui.toasts.some((toast) => /Bulbizarre évolue ! \(\/tokemon stop pour annuler\)/.test(toast)))
  assert.match(textOf(await host.render('AbovePrompt')), /Évolution en Herbizarre/)
  assert.equal(boxOf(host)[0].species, 'bulbasaur')
  await host.advance(16_000)
  assert.equal(boxOf(host)[0].species, 'ivysaur')
  assert.ok(host.ui.toasts.some((toast) => /Bulbizarre évolue en Herbizarre/.test(toast)))
  assert.match(textOf(await host.render('AbovePrompt')), /Herbizarre · niv\. 16/)
})

test('/tokemon stop annule, /tokemon evolve relance', async () => {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  await host.command('start salamèche')
  assert.match(await host.command('debug xp 5000'), /niveau 17/)
  assert.match(await host.command('stop'), /annulée/)
  await host.advance(20_000)
  assert.equal(boxOf(host)[0].species, 'charmander')
  assert.match(await host.command('stop'), /Aucune évolution/)
  assert.match(await host.command('evolve'), /évolue en Reptincel/)
  assert.equal(boxOf(host)[0].species, 'charmeleon')
})

test('pierre et Link Cable via /tokemon use', async () => {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  await host.command('start pikachu')
  assert.match(await host.command('use pierre foudre'), /Tu n'as pas de Pierre Foudre/)
  await host.command('debug item pierre foudre')
  assert.match(await host.command('use pierre foudre'), /évolue en Raichu/)
  assert.equal(boxOf(host)[0].species, 'raichu')
  assert.match(await host.command('debug item link cable 2'), /\+2 Link Cable/)
  assert.match(await host.command('use link cable'), /aucun effet/)
})

test('les commandes de debug sont désactivées hors TOKEMON_DEBUG=1', async () => {
  const host = await createStubHost()
  await host.start()
  await host.command('start pikachu')
  assert.match(await host.command('debug xp 5000'), /TOKEMON_DEBUG=1/)
  assert.equal(boxOf(host)[0].xp, 125)
  assert.doesNotMatch(await host.command('help'), /debug/)
  const dev = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await dev.start()
  assert.match(await dev.command('help'), /debug/)
  assert.match(await dev.command('debug'), /Usage|debug </)
  assert.match(await dev.command('debug tokens'), /Aucun tour/)
  await dev.command('start pikachu')
  await dev.turn(321)
  assert.match(await dev.command('debug tokens'), /321 output tokens, source : payload \(réel\)/)
})
