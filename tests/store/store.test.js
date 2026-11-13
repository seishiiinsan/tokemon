import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SCHEMA_VERSION, STORE_PREFIX } from '../../hooks/config.js'
import { migrate } from '../../hooks/store/migrations.js'
import { createRepo } from '../../hooks/store/repo.js'
import { emptySave } from '../../hooks/store/schema.js'

/** Un store en mémoire au comportement de $.store (valeurs JSON, accès asynchrone) */
function memoryStore(/** @type {Map<string, unknown>} */ map = new Map()) {
  let writes = 0
  return {
    map,
    writes: () => writes,
    get: async (/** @type {string} */ key) => structuredClone(map.get(key)),
    set: async (/** @type {string} */ key, /** @type {unknown} */ value) => {
      writes++
      map.set(key, JSON.parse(JSON.stringify(value)))
    },
    delete: async (/** @type {string} */ key) => void map.delete(key),
    keys: async () => [...map.keys()],
  }
}

test('migrate : un store vide donne une sauvegarde vierge au schéma courant', () => {
  assert.deepEqual(migrate({}), emptySave())
  assert.equal(migrate({}).state.version, SCHEMA_VERSION)
})

test('migrate : complète les champs manquants sans toucher aux données', () => {
  const save = migrate({
    state: { version: 1, activeMonId: 2, starterChosen: true, totals: { outputTokens: 42 } },
    box: [
      { id: 2, species: 'pikachu', nickname: null, level: 7, xp: 343, shiny: false, caughtAt: 1 },
      'corrompu',
      { id: 9 },
    ],
    bag: 'pas un objet',
    history: { days: [{ date: '2026-01-01', outputTokens: 1, xp: 1 }] },
  })
  assert.equal(save.state.totals.outputTokens, 42)
  assert.equal(save.state.totals.xp, 0)
  assert.deepEqual(save.state.counters, { sinceEncounter: 0, sinceDrop: 0 })
  assert.equal(save.state.stats.captures, 0)
  assert.equal(save.box.length, 1)
  assert.equal(save.state.nextMonId, 3, 'repart après le plus grand identifiant')
  assert.deepEqual(save.bag, {})
  assert.equal(save.history.days.length, 1)
  assert.deepEqual(save.history.events, [])
})

test('migrate v0 → v1 : compteur unique et historique à plat', () => {
  const save = migrate({
    state: { activeMonId: null, starterChosen: false, counter: 1234 },
    history: [{ date: '2025-12-31', outputTokens: 10, xp: 10 }],
  })
  assert.deepEqual(save.state.counters, { sinceEncounter: 1234, sinceDrop: 1234 })
  assert.equal(/** @type {any} */ (save.state).counter, undefined)
  assert.deepEqual(save.history, { days: [{ date: '2025-12-31', outputTokens: 10, xp: 10 }], events: [] })
  assert.equal(save.state.version, 1)
})

test('migrate : un mon actif disparu est remplacé par le premier de la box', () => {
  const box = [{ id: 4, species: 'eevee', nickname: null, level: 5, xp: 125, shiny: false, caughtAt: 1 }]
  assert.equal(migrate({ state: { version: 1, activeMonId: 99 }, box }).state.activeMonId, 4)
  assert.equal(migrate({ state: { version: 1, activeMonId: 99 } }).state.activeMonId, null)
})

test('repo : transact relit, applique, et n’écrit que les clés modifiées', async () => {
  const store = memoryStore()
  const repo = createRepo(store)
  assert.equal(repo.peek(), null)
  const result = await repo.transact((save) => {
    save.bag['poke-ball'] = 3
    return 'fait'
  })
  assert.equal(result, 'fait')
  // Premier passage : la migration normalise toutes les clés absentes
  assert.deepEqual(store.map.get(STORE_PREFIX + 'bag'), { 'poke-ball': 3 })
  const before = store.writes()
  await repo.transact((save) => void (save.state.totals.outputTokens += 10))
  assert.equal(store.writes() - before, 1, 'seule la clé state est réécrite')
  assert.equal(repo.peek()?.state.totals.outputTokens, 10)
  assert.equal((await repo.load()).bag['poke-ball'], 3)
})

test('repo : deux sessions sur le même store ne perdent aucun incrément', async () => {
  const shared = new Map()
  const sessionA = createRepo(memoryStore(shared))
  const sessionB = createRepo(memoryStore(shared))
  await sessionA.load()
  await sessionB.load()
  // B écrit pendant que A garde une copie locale périmée
  for (let i = 0; i < 20; i++) {
    await sessionA.transact((save) => void (save.state.totals.outputTokens += 100))
    await sessionB.transact((save) => void (save.state.totals.outputTokens += 1))
  }
  assert.equal((await sessionA.load()).state.totals.outputTokens, 2020)
})

test('repo : les transactions lancées en parallèle sont sérialisées', async () => {
  const repo = createRepo(memoryStore())
  await Promise.all(Array.from({ length: 25 }, () => repo.transact((save) => void (save.state.stats.turns += 1))))
  assert.equal(repo.peek()?.state.stats.turns, 25)
})

test('repo : une transaction en échec ne bloque pas la file', async () => {
  const repo = createRepo(memoryStore())
  await assert.rejects(
    repo.transact(() => {
      throw new Error('boum')
    }),
  )
  assert.equal(await repo.transact(() => 'ok'), 'ok')
})
