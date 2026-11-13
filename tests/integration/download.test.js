import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { STORE_PREFIX } from '../../hooks/config.js'
import { GEN1_SPRITES } from '../../hooks/data/frames.gen1.js'
import { downloadGen, fetchSprite, listGen, RateLimitError } from '../../hooks/sprites/download.js'
import { hasSprite } from '../../hooks/ui/render/frames.js'
import { createStubHost } from '../../scripts/stub-host.mjs'

// Le dépôt de sprites est simulé : les GIF de Pikachu (gen 1, embarqués) servent de contenu
// aux dossiers de la gen 2, au format de l'API « contents » de GitHub (JSON + base64).

const API = 'https://api.github.com/repos/jakobhoeg/vscode-pokemon/contents/media'
const CACHE = '/home/gabin/.claude/tokemon/sprites'
const gif = (/** @type {string} */ file) =>
  readFileSync(new URL(`../../sprites/pikachu/${file}`, import.meta.url))
    .toString('base64')
    .replace(/(.{60})/g, '$1\n')

/**
 * @param {{ mons: string[], noShiny?: string[], limitAfter?: number }} options
 * @returns {(url: string) => { status: number, text: string }}
 */
function fakeGithub({ mons, noShiny = [], limitAfter = Number.POSITIVE_INFINITY }) {
  let requests = 0
  return (url) => {
    if (++requests > limitAfter) return { status: 403, text: '{"message":"API rate limit exceeded"}' }
    const path = url.slice(API.length + 1)
    if (path === 'gen2') {
      const entries = [
        ...mons.map((name) => ({ name, type: 'dir' })),
        { name: 'README.md', type: 'file' },
        { name: 'pikachu', type: 'dir' },
      ]
      return { status: 200, text: JSON.stringify(entries) }
    }
    const [, mon, file] = path.split('/')
    if (!mons.includes(mon) || (noShiny.includes(mon) && file.startsWith('shiny'))) return { status: 404, text: '{}' }
    return { status: 200, text: JSON.stringify({ encoding: 'base64', content: gif(file) }) }
  }
}

/** @param {(url: string) => { status: number, text: string }} http */
const fetchWith = (http) => async (/** @type {string} */ url) => {
  const answer = http(url)
  return { status: answer.status, ok: answer.status === 200, headers: {}, text: answer.text }
}

test('listGen ne garde que les dossiers des espèces connues de la génération', async () => {
  const fetch = fetchWith(fakeGithub({ mons: ['chikorita', 'totodile', 'pas_un_pokemon'] }))
  assert.deepEqual(await listGen(fetch, 2), ['chikorita', 'totodile'])
  await assert.rejects(
    listGen(
      fetchWith(() => ({ status: 403, text: '' })),
      2,
    ),
    RateLimitError,
  )
  await assert.rejects(
    listGen(
      fetchWith(() => ({ status: 500, text: '' })),
      2,
    ),
    /500/,
  )
  await assert.rejects(
    listGen(
      fetchWith(() => ({ status: 200, text: '{}' })),
      2,
    ),
    /inattendue/,
  )
})

test('fetchSprite compile les quatre GIF ; sans shiny en amont, la forme normale seule', async () => {
  const full = await fetchSprite(fetchWith(fakeGithub({ mons: ['chikorita'] })), 2, 'chikorita')
  assert.deepEqual(full, GEN1_SPRITES.pikachu)
  const plain = await fetchSprite(
    fetchWith(fakeGithub({ mons: ['chikorita'], noShiny: ['chikorita'] })),
    2,
    'chikorita',
  )
  assert.equal(plain.variants.shiny, undefined)
  assert.ok(plain.variants.default.idle.length > 0)
  await assert.rejects(fetchSprite(fetchWith(fakeGithub({ mons: [] })), 2, 'chikorita'))
  await assert.rejects(
    fetchSprite(
      fetchWith(() => ({ status: 200, text: '{}' })),
      2,
      'chikorita',
    ),
    /Contenu manquant/,
  )
})

test('downloadGen : par lots, reprise, échecs isolés, arrêt sur quota', async () => {
  const have = new Set()
  /** @param {Record<string, unknown>} sprites */
  const save = async (sprites) => {
    for (const id of Object.keys(sprites)) have.add(id)
  }
  const has = (/** @type {string} */ id) => have.has(id)
  const mons = ['chikorita', 'bayleef', 'meganium', 'cyndaquil']
  const fetch = fetchWith(fakeGithub({ mons }))
  const first = await downloadGen({ fetch, gen: 2, has, save, limit: 3 })
  assert.deepEqual(first, { added: 3, have: 3, total: 4, complete: false, failed: [] })
  const second = await downloadGen({ fetch, gen: 2, has, save, limit: 3 })
  assert.deepEqual(second, { added: 1, have: 4, total: 4, complete: true, failed: [] })

  // Quota atteint après la liste et un mon (1 + 4 requêtes) : ce qui est fait est gardé
  have.clear()
  const limited = await downloadGen({ fetch: fetchWith(fakeGithub({ mons, limitAfter: 5 })), gen: 2, has, save })
  assert.equal(limited.added, 1)
  assert.match(limited.stopped ?? '', /60 par heure/)
  assert.equal(have.size, 1)

  // Un mon cassé n'empêche pas les autres
  have.clear()
  const broken = fetchWith((url) => (url.includes('/bayleef/') ? { status: 500, text: '' } : fakeGithub({ mons })(url)))
  const partial = await downloadGen({ fetch: broken, gen: 2, has, save })
  assert.deepEqual([partial.added, partial.failed, partial.complete], [3, ['bayleef'], false])
})

test('/tokemon download : cache local, sprites utilisables, rechargés à la session suivante', async () => {
  const mons = ['chikorita', 'totodile']
  const host = await createStubHost({ env: { HOME: '/home/gabin', TOKEMON_DEBUG: '1' }, http: fakeGithub({ mons }) })
  await host.start()
  await host.command('start pikachu')
  assert.match(await host.command('download'), /Précise la génération/)
  assert.match(await host.command('download gen1'), /déjà embarquée/)
  assert.match(await host.command('debug encounter germignon'), /non téléchargés/)
  assert.match(await host.command('download gen2'), /lancé/)
  await host.advance(50)
  assert.ok(
    host.ui.toasts.some((toast) => /Gen 2 complète \(2\/2 sprites\)/.test(toast)),
    host.ui.toasts.join('|'),
  )
  assert.equal(host.ui.requests.length, 1 + 2 * 4, 'une liste, puis quatre GIF par mon')
  assert.ok(
    host.ui.requests.every((url) => url.startsWith(API)),
    'aucun autre appel réseau',
  )
  const cached = JSON.parse(/** @type {string} */ (host.files.get(`${CACHE}/gen2.json`)))
  assert.deepEqual(Object.keys(cached.sprites).sort(), mons)
  assert.equal(hasSprite('chikorita'), true)
  assert.match(await host.command('debug encounter germignon'), /Germignon sauvage apparaît/)

  // Nouvelle session avec le même cache : les sprites sont là sans réseau
  const next = await createStubHost({
    env: { HOME: '/home/gabin' },
    files: Object.fromEntries(host.files),
    store: host.store,
  })
  await next.start()
  assert.equal(next.ui.requests.length, 0)
  assert.equal(/** @type {any} */ (next.store.get(STORE_PREFIX + 'state')).wild.species, 'chikorita')
  assert.match(await next.command('dex'), /Gen 2 .* 0\/100 capturés · 1 vus$/m)
})

test('/tokemon download : quota GitHub et cache corrompu', async () => {
  const host = await createStubHost({
    env: { HOME: '/home/gabin' },
    files: { [`${CACHE}/gen3.json`]: '{ pas du json' },
    http: fakeGithub({ mons: ['chikorita'], limitAfter: 0 }),
  })
  await host.start()
  await host.command('download 2')
  await host.advance(50)
  assert.ok(host.ui.toasts.some((toast) => /Téléchargement de la gen 2 impossible : GitHub limite/.test(toast)))
})
