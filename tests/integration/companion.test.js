import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { createStubHost, flatten, textOf } from '../../scripts/stub-host.mjs'

// Lot 1 de bout en bout, à travers le vrai register.js et un faux hôte.

test('premier lancement : la commande est enregistrée et le starter est proposé', async () => {
  const host = await createStubHost()
  await host.start()
  assert.deepEqual(host.ui.commands, ['tokemon'])
  assert.match(host.ui.toasts[0], /starter/)
  const band = await host.render('AbovePrompt')
  assert.match(textOf(band), /choisis ton starter/)
  assert.match(textOf(band), /Bulbizarre · Salamèche · Carapuce · Pikachu/)
  assert.match(await host.command(''), /starter/)
  assert.match(await host.command('start mewtwo'), /Choisis ton starter/)
})

test('starter puis tour : XP proportionnelle aux output tokens réels, persistée', async () => {
  const host = await createStubHost()
  await host.start()
  assert.match(await host.command('start salamèche'), /Salamèche devient ton compagnon/)
  await host.turn(1500)
  const box = /** @type {any[]} */ (host.store.get(STORE_PREFIX + 'box'))
  assert.equal(box[0].species, 'charmander')
  assert.equal(box[0].xp, 125 + 1500)
  assert.equal(box[0].level, 11)
  assert.ok(host.ui.toasts.some((toast) => /Salamèche passe au niveau 11/.test(toast)))
  const state = /** @type {any} */ (host.store.get(STORE_PREFIX + 'state'))
  assert.equal(state.totals.outputTokens, 1500)
  assert.match(await host.command(''), /Salamèche · niv\. 11/)
})

test("le compagnon s'affiche sans commande à la session suivante", async () => {
  const first = await createStubHost()
  await first.start()
  await first.command('start pikachu')
  const second = await createStubHost({ store: first.store })
  await second.start()
  assert.ok(!second.ui.toasts.some((toast) => /starter/.test(toast)))
  const band = await second.render('AbovePrompt')
  assert.match(textOf(band), /Pikachu · niv\. 5/)
  const raster = flatten(band).find((node) => node.type === 'Raster')
  assert.ok(raster, 'la scène est un Raster dans le terminal')
  assert.equal(raster.props.columns, 56)
  assert.equal(raster.props.rows, 10)
  assert.equal(Buffer.from(raster.props.cells, 'base64').length, 56 * 10 * 12)
})

test('animation : la bande est repeinte par blit, 8 fois par seconde au plus', async () => {
  const host = await createStubHost()
  await host.start()
  await host.command('start carapuce')
  await host.render('AbovePrompt')
  await host.advance(10_000)
  assert.ok(host.ui.blits.length > 3, 'des images ont été repeintes')
  assert.ok(host.ui.blits.length <= 80)
  assert.equal(host.ui.blits[0].key, 'tokemon-scene')
  assert.equal(host.ui.blits[0].requestId, 'band')
  assert.notEqual(host.ui.blits[0].cells, host.ui.blits.at(-1)?.cells)
})

test('desktop : la scène est un Svg, redessiné par invalidation', async () => {
  const host = await createStubHost({ surface: 'desktop' })
  await host.start()
  await host.command('start bulbizarre')
  const band = await host.render('AbovePrompt')
  const svg = flatten(band).find((node) => node.type === 'Svg')
  assert.ok(svg)
  assert.match(svg.props.source, /^<svg /)
  assert.equal(
    flatten(band).some((node) => node.type === 'Raster'),
    false,
  )
  const before = host.ui.invalidations
  await host.advance(1000)
  assert.equal(host.ui.blits.length, 0)
  assert.ok(host.ui.invalidations > before)
})

test('bande étroite ou sondage : repli propre', async () => {
  const narrow = await createStubHost({ bodyColumns: 30 })
  await narrow.start()
  await narrow.command('start pikachu')
  const band = await narrow.render('AbovePrompt')
  assert.equal(
    flatten(band).some((node) => node.type === 'Raster'),
    false,
  )
  assert.match(textOf(band), /Pikachu/)
  assert.equal(
    await narrow.fire(
      'ui.render',
      { component: 'AbovePrompt', surface: 'terminal', requestId: 'band', props: { hasSurvey: true } },
      'hôte',
    ),
    'hôte',
  )
})

test('switch, box, surnom, variante, aide', async () => {
  const host = await createStubHost()
  await host.start()
  await host.command('start pikachu')
  assert.match(await host.command('box'), /#1 Pikachu · niv\. 5 ◀ actif/)
  assert.match(await host.command('nick Sparky'), /Sparky/)
  assert.match(await host.command('box'), /#1 Sparky \(Pikachu\)/)
  assert.match(await host.command('switch'), /Précise/)
  assert.match(await host.command('switch #1'), /déjà/)
  assert.match(await host.command('shiny'), /n'est pas shiny/)
  assert.match(await host.command('default'), /n'est pas shiny/)
  const help = await host.command('help')
  assert.match(help, /\/tokemon switch <mon>/)
  assert.match(await host.command('danse'), /Commande inconnue/)
})

test('deux sessions ouvertes : ni double comptage ni perte', async () => {
  const sessionA = await createStubHost()
  await sessionA.start()
  await sessionA.command('start pikachu')
  const sessionB = await createStubHost({ store: sessionA.store })
  await sessionB.start()
  // Le même tour entendu par les deux sessions n'est compté qu'une fois
  await sessionA.turn(1000, { turnId: 'partagé' })
  await sessionB.turn(1000, { turnId: 'partagé' })
  // Des tours différents s'additionnent, y compris depuis une copie locale périmée
  await sessionA.turn(200)
  await sessionB.turn(300)
  await sessionA.turn(50, { agentId: 'sub-1' })
  const state = /** @type {any} */ (sessionA.store.get(STORE_PREFIX + 'state'))
  assert.equal(state.totals.outputTokens, 1550)
  assert.equal(/** @type {any[]} */ (sessionA.store.get(STORE_PREFIX + 'box'))[0].xp, 125 + 1550)
})

test('tour sans usage : estimation, signalée par ≈', async () => {
  const host = await createStubHost()
  await host.start()
  await host.command('start pikachu')
  await host.turn(0, { usage: undefined, answer: 'a'.repeat(400) })
  const state = /** @type {any} */ (host.store.get(STORE_PREFIX + 'state'))
  assert.equal(state.totals.outputTokens, 100)
  assert.equal(state.totals.approximateTokens, 100)
  assert.match(await host.command(''), /≈ 100 tokens/)
})
