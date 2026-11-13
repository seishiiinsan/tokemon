import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { createStubHost, flatten, textOf } from '../../scripts/stub-host.mjs'

const read = (/** @type {{ store: Map<string, unknown> }} */ host, /** @type {string} */ key) =>
  /** @type {any} */ (host.store.get(STORE_PREFIX + key))

async function started() {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  await host.command('start pikachu')
  return host
}

test('rencontre forcée : toast, bande, puis capture à la Master Ball → box et dex', async () => {
  const host = await started()
  assert.match(await host.command('debug encounter mewtwo'), /Mewtwo sauvage apparaît/)
  assert.ok(host.ui.toasts.some((toast) => /Un Mewtwo sauvage apparaît ! \(Légendaire/.test(toast)))
  const band = await host.render('AbovePrompt')
  assert.match(textOf(band), /Sauvage : Mewtwo niv\. \d+ \(Légendaire\) · 10 min · \/tokemon catch/)
  assert.ok(flatten(band).some((node) => node.type === 'Raster'))
  await host.command('debug item master ball')
  assert.match(await host.command('catch master'), /Mewtwo \(niv\. \d+\) rejoint ta box/)
  assert.equal(read(host, 'box')[1].species, 'mewtwo')
  assert.deepEqual(read(host, 'dex').mewtwo, { seen: 1, caught: 1, shiny: 0 })
  assert.equal(read(host, 'state').wild, null)
  assert.match(await host.command('box'), /#2 Mewtwo/)
  assert.match(await host.command('catch'), /Aucun Pokémon sauvage/)
})

test('le mon sauvage fuit après 10 minutes, avec un toast', async () => {
  const host = await started()
  await host.command('debug encounter roucool')
  await host.render('AbovePrompt')
  await host.advance(10 * 60_000 + 2000)
  assert.equal(read(host, 'state').wild, null)
  assert.ok(host.ui.toasts.some((toast) => /Roucool sauvage s'enfuit \(temps écoulé\)/.test(toast)))
})

test('rencontre shiny forcée et espèce invalide', async () => {
  const host = await started()
  assert.match(await host.command('debug encounter licorne'), /inconnue/)
  assert.match(await host.command('debug encounter mentali'), /non téléchargés/)
  await host.command('debug encounter évoli shiny')
  assert.equal(read(host, 'state').wild.shiny, true)
  assert.ok(host.ui.toasts.some((toast) => /Évoli ✨ shiny sauvage/.test(toast)))
})

test('Pokédex : complétion par génération et fiche', async () => {
  const host = await started()
  const summary = await host.command('dex')
  assert.match(summary, /Gen 1 .* 1\/151 capturés · 1 vus/)
  assert.match(summary, /Gen 2 .* 0\/100 capturés · 0 vus {2}\(sprites : \/tokemon download gen2\)/)
  const entry = await host.command('dex pikachu')
  assert.match(entry, /N° 025 Pikachu · gen 1 · Rare/)
  assert.match(entry, /Vu 1 fois · capturé 1 fois/)
  assert.match(entry, /Évolue en : Raichu \(Pierre Foudre\)/)
  assert.match(await host.command('dex mew'), /Jamais rencontré/)
  assert.match(await host.command('dex licorne'), /inconnue/)
})
