import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { createStubHost, flatten, textOf } from '../../scripts/stub-host.mjs'

const read = (/** @type {{ store: Map<string, unknown> }} */ host, /** @type {string} */ key) =>
  /** @type {any} */ (host.store.get(STORE_PREFIX + key))

/** @param {any} tree @param {string} key */
function button(tree, key) {
  const found = flatten(tree).find((node) => node.type === 'Button' && node.props.key === key)
  assert.ok(found, `bouton ${key} absent`)
  return found
}

async function started(/** @type {import('../../scripts/stub-host.mjs').StubOptions} */ options = {}) {
  const host = await createStubHost({ env: { TOKEMON_DEBUG: '1' }, ...options })
  await host.start()
  await host.command('start pikachu')
  return host
}

test('/tokemon pane ouvre et ferme le panneau, et son état est persisté', async () => {
  const host = await started()
  assert.match(await host.command('pane'), /ouvert/)
  assert.deepEqual(host.ui.opened, ['tokemon'])
  assert.equal(read(host, 'state').paneOpen, true)
  // Session suivante : le panneau rouvre tout seul
  const next = await createStubHost({ store: host.store })
  await next.start()
  assert.deepEqual(next.ui.opened, ['tokemon'])
  assert.match(await next.command('pane'), /fermé/)
  assert.deepEqual(next.ui.closed, ['tokemon'])
  assert.equal(read(next, 'state').paneOpen, false)
  const third = await createStubHost({ store: host.store })
  await third.start()
  assert.deepEqual(third.ui.opened, [])
})

test('fermé à la main par la personne : mémorisé ; fermé par le moteur : ignoré', async () => {
  const host = await started()
  await host.command('pane')
  await host.fire('ui.close', { id: 'tokemon', origin: { kind: 'unload' } })
  await host.fire('ui.close', { id: 'autre', origin: { kind: 'person' } })
  assert.equal(read(host, 'state').paneOpen, true)
  await host.fire('ui.close', { id: 'tokemon', origin: { kind: 'person' } })
  assert.equal(read(host, 'state').paneOpen, false)
})

test('onglet Équipe : compagnon, sprite, box cliquable', async () => {
  const host = await started()
  await host.command('debug encounter roucool')
  await host.command('debug item master ball')
  await host.command('catch master')
  const tree = await host.render('Pane')
  const text = textOf(tree)
  assert.match(text, /Équipe\nSac\nPokédex\nSuccès\nStats/)
  assert.match(text, /Pikachu · niv\. 5/)
  assert.match(text, /Évolution : Raichu \(Pierre Foudre\)/)
  assert.match(text, /Box \(2\)/)
  assert.match(text, /▶ #1 Pikachu · niv\. 5/)
  assert.ok(flatten(tree).some((node) => node.type === 'Raster' && node.props.key === 'tokemon-pane-mon'))
  // Un appui sur Roucool le rend actif
  const pidgey = button(tree, 'mon-2')
  assert.ok(pidgey)
  pidgey.props.onPress()
  await host.advance(10)
  assert.equal(read(host, 'state').activeMonId, 2)
  assert.match(textOf(await host.render('Pane')), /▶ #2 Roucool/)
  assert.ok(host.ui.toasts.some((toast) => /Roucool \(niv\. \d+\) devient ton compagnon/.test(toast)))
})

test('onglets Sac, Pokédex, Succès, Stats : contenu correct', async () => {
  const host = await started()
  await host.turn(1500)
  await host.command('debug item lucky egg')
  await host.command('use lucky egg')
  let tree = await host.render('Pane')

  button(tree, 'tab-bag').props.onPress()
  let text = textOf(await host.render('Pane'))
  assert.match(text, /Balls\n◓ Poké Ball ×10/)
  assert.match(text, /Boosts actifs\n◉ Lucky Egg · XP ×2 pendant 1 h · reste 1 h 00/)

  button(tree, 'tab-dex').props.onPress()
  tree = await host.render('Pane')
  text = textOf(tree)
  assert.match(text, /Gen 1 .* 1\/151 capturés/)
  assert.match(text, /001 · \?\?\?/)
  assert.match(text, /025 ● Pikachu · Rare/)
  assert.match(text, /page 1\/19/)
  button(tree, 'dex-next').props.onPress()
  assert.match(textOf(await host.render('Pane')), /page 2\/19/)
  button(await host.render('Pane'), 'dex-prev').props.onPress()
  assert.match(textOf(await host.render('Pane')), /page 1\/19/)

  button(tree, 'tab-achievements').props.onPress()
  text = textOf(await host.render('Pane'))
  assert.match(text, /Succès : \d+\/20/)
  assert.match(text, /Premier pas · Capturer un premier Pokémon \(Poké Ball ×5\)/)

  button(tree, 'tab-stats').props.onPress()
  text = textOf(await host.render('Pane'))
  assert.match(text, /Output tokens, 30 derniers jours\n▁{29}█/)
  assert.match(text, /Aujourd'hui 1 500 · 30 jours 1 500/)
  assert.match(text, /Tokens au total : 1 500/)
  assert.match(text, /Taux de capture : aucun lancer/)
  assert.match(text, /Items : 0 obtenus · 1 utilisés/)
  assert.match(text, /Journal \(1\)\n\d\d\/\d\d \d\d:\d\d {2}Pikachu te rejoint/)
})

test('/tokemon pane <onglet> et /tokemon stats', async () => {
  const host = await started()
  assert.match(await host.command('pane sac'), /ouvert/)
  assert.match(textOf(await host.render('Pane')), /Boosts actifs/)
  assert.match(await host.command('pane cuisine'), /Onglet inconnu/)
  const stats = await host.command('stats')
  assert.match(stats, /Output tokens, 30 derniers jours/)
  assert.match(stats, /Derniers événements :\n.*Pikachu te rejoint/)
})

test('panneau sur desktop (Svg) et réduit en widget', async () => {
  const host = await started({ surface: 'desktop' })
  const tree = await host.render('Pane')
  assert.ok(flatten(tree).some((node) => node.type === 'Svg'))
  const widget = await host.render('Pane', { placement: 'widget' })
  assert.equal(
    flatten(widget).some((node) => node.type === 'Button'),
    false,
  )
  assert.match(textOf(widget), /Pikachu · niv\. 5/)
})

test('avant le starter : le panneau invite à le choisir', async () => {
  const host = await createStubHost()
  await host.start()
  assert.match(textOf(await host.render('Pane')), /Choisis ton starter/)
})

test('box paginée au-delà de 12 mons', async () => {
  const host = await started()
  for (let i = 0; i < 13; i++) {
    await host.command('debug encounter rattata')
    await host.command('debug item master ball')
    await host.command('catch master')
  }
  const tree = await host.render('Pane')
  assert.match(textOf(tree), /Box \(14\)/)
  assert.match(textOf(tree), /page 1\/2/)
  assert.doesNotMatch(textOf(tree), /#13 /)
  button(tree, 'box-next').props.onPress()
  assert.match(textOf(await host.render('Pane')), /#13 Rattata/)
})
