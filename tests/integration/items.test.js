import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { createStubHost, textOf } from '../../scripts/stub-host.mjs'

const read = (/** @type {{ store: Map<string, unknown> }} */ host, /** @type {string} */ key) =>
  /** @type {any} */ (host.store.get(STORE_PREFIX + key))

async function started() {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  await host.command('start carapuce')
  return host
}

test('sac : inventaire de départ par catégorie, drops ajoutés', async () => {
  const host = await started()
  const bag = await host.command('bag')
  assert.match(bag, /Balls :\n {2}◓ Poké Ball ×10 · capture ×1/)
  assert.match(bag, /Consommables :\n {2}✦ Super Bonbon ×1 · \+1 niveau/)
  assert.match(await host.command('debug drop pierre lune'), /Drop : Pierre Lune/)
  assert.ok(host.ui.toasts.some((toast) => /Tu trouves : Pierre Lune/.test(toast)))
  assert.match(await host.command('bag'), /Pierres :\n {2}◆ Pierre Lune ×1/)
  assert.match(await host.command('debug drop'), /Drop : /)
  assert.match(await host.command('debug drop licorne'), /inconnu/)
  assert.equal(read(host, 'state').stats.itemsFound, 2)
})

test('boost : visible dans la bande avec son temps restant, toast à expiration', async () => {
  const host = await started()
  await host.command('debug item lucky egg')
  assert.match(await host.command('use lucky egg'), /Lucky Egg activé/)
  assert.match(textOf(await host.render('AbovePrompt')), /◉ Lucky Egg 1 h 00/)
  assert.match(await host.command('bag'), /Boosts actifs : ◉ Lucky Egg/)
  await host.turn(1000)
  assert.equal(read(host, 'box')[0].xp, 125 + 2000, 'XP doublée')
  await host.advance(61 * 60_000)
  assert.ok(host.ui.toasts.some((toast) => /Lucky Egg : effet terminé/.test(toast)))
  assert.deepEqual(read(host, 'boosts'), [])
  await host.turn(1000)
  assert.equal(read(host, 'box')[0].xp, 125 + 3000)
})

test('Super Bonbon et baie via /tokemon use', async () => {
  const host = await started()
  assert.match(await host.command('use super bonbon'), /Carapuce croque un Super Bonbon\. Niveau 6 !/)
  await host.command('debug item baie oran')
  assert.match(await host.command('use baie oran'), /mange une Baie Oran/)
  assert.equal(read(host, 'box')[0].xp, 216 + 500)
  assert.match(await host.command('use super bonbon'), /Tu n'as pas/)
})

test('sac vide', async () => {
  const host = await createStubHost()
  await host.start()
  assert.match(await host.command('bag'), /vide/)
})
