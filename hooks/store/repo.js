import { STORE_PREFIX } from '../config.js'
import { migrate } from './migrations.js'
import { SAVE_KEYS } from './schema.js'

// Accès au store. Toute modification passe par `transact`, qui gère la concurrence :
// - les transactions d'une même session sont mises en file (jamais deux en parallèle) ;
// - chaque transaction RELIT le store juste avant d'appliquer sa modification, puis n'écrit que
//   les clés qui ont changé. Les compteurs sont donc toujours incrémentés à partir de la valeur
//   la plus récente, y compris quand une autre session a écrit entre-temps ;
// - le comptage d'un tour est dédupliqué par son identifiant dans le core (state.seenTurns).

/** @typedef {import('./schema.js').Save} Save */

/**
 * @param {import('../types.js').HostStore} store
 */
export function createRepo(store) {
  /** @type {Save | null} */
  let cached = null
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve()

  /** @returns {Promise<{ save: Save, snapshot: Record<string, string> }>} */
  async function read() {
    const values = await Promise.all(SAVE_KEYS.map((key) => store.get(STORE_PREFIX + key)))
    /** @type {Record<string, unknown>} */
    const raw = {}
    /** @type {Record<string, string>} */
    const snapshot = {}
    SAVE_KEYS.forEach((key, index) => {
      raw[key] = values[index]
      snapshot[key] = JSON.stringify(values[index])
    })
    return { save: migrate(raw), snapshot }
  }

  return {
    /** Relit le store (avec migrations) et met à jour la copie locale. */
    async load() {
      cached = (await read()).save
      return cached
    },

    /** La dernière sauvegarde connue de cette session, pour le dessin (peut dater d'un tick). */
    peek: () => cached,

    /**
     * Relit, applique `change`, écrit les clés modifiées.
     * @template T
     * @param {(save: Save) => T} change modifie la sauvegarde fraîchement relue
     * @returns {Promise<T>}
     */
    transact(change) {
      const run = queue.then(async () => {
        const { save, snapshot } = await read()
        const result = change(save)
        const writes = []
        for (const key of SAVE_KEYS) {
          if (JSON.stringify(save[key]) !== snapshot[key]) writes.push(store.set(STORE_PREFIX + key, save[key]))
        }
        await Promise.all(writes)
        cached = save
        return result
      })
      // Une transaction en échec ne bloque pas les suivantes
      queue = run.catch(() => undefined)
      return run
    },
  }
}

/** @typedef {ReturnType<typeof createRepo>} Repo */
