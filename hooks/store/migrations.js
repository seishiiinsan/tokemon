import { SCHEMA_VERSION } from '../config.js'
import { emptySave } from './schema.js'

// Migrations du store, appliquées à chaque chargement.
// 1. Les migrations versionnées transforment les données d'un ancien schéma.
// 2. La normalisation complète ensuite ce qui manque avec les valeurs par défaut, pour qu'une
//    sauvegarde partielle ou abîmée (clé supprimée, champ ajouté depuis) reste chargeable.

/** @typedef {import('./schema.js').Save} Save */

/**
 * Une entrée par version : `up` transforme les données brutes de la version précédente.
 * @type {{ version: number, up: (raw: Record<string, any>) => void }[]}
 */
export const MIGRATIONS = [
  {
    // v0 → v1 : les préversions gardaient un seul compteur `state.counter` pour les rencontres
    // et les drops, et le journal directement dans `history` (tableau des jours).
    version: 1,
    up(raw) {
      const state = raw.state
      if (state && typeof state.counter === 'number' && !state.counters) {
        state.counters = { sinceEncounter: state.counter, sinceDrop: state.counter }
        delete state.counter
      }
      if (Array.isArray(raw.history)) raw.history = { days: raw.history, events: [] }
    },
  },
]

/** @param {unknown} value */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Complète `value` avec les champs de `defaults` qui lui manquent ou dont le type ne correspond pas.
 * @param {any} value
 * @param {any} defaults
 * @returns {any}
 */
function withDefaults(value, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults
  if (!isRecord(defaults))
    return typeof value === typeof defaults || (defaults === null && value !== undefined) ? value : defaults
  if (!isRecord(value)) return defaults
  /** @type {Record<string, any>} */
  const out = { ...value }
  for (const [key, fallback] of Object.entries(defaults)) out[key] = withDefaults(value[key], fallback)
  return out
}

/**
 * @param {Partial<Record<keyof Save, unknown>>} raw les valeurs lues du store (undefined si absentes)
 * @returns {Save} une sauvegarde complète au schéma courant
 */
export function migrate(raw) {
  /** @type {Record<string, any>} */
  const data = structuredClone(raw)
  const from = isRecord(data.state) && typeof data.state.version === 'number' ? data.state.version : 0
  if (data.state !== undefined) {
    for (const migration of MIGRATIONS) if (migration.version > from) migration.up(data)
  }
  const defaults = emptySave()
  /** @type {Save} */
  const save = {
    state: withDefaults(data.state, defaults.state),
    box: Array.isArray(data.box) ? data.box.filter((mon) => isRecord(mon) && typeof mon.species === 'string') : [],
    bag: isRecord(data.bag) ? data.bag : {},
    boosts: Array.isArray(data.boosts) ? data.boosts : [],
    dex: isRecord(data.dex) ? data.dex : {},
    achievements: isRecord(data.achievements) ? data.achievements : {},
    history: withDefaults(data.history, defaults.history),
  }
  save.state.version = SCHEMA_VERSION
  // Un mon actif qui n'existe plus (box éditée à la main) : on reprend le premier de la box
  if (!save.box.some((mon) => mon.id === save.state.activeMonId)) save.state.activeMonId = save.box[0]?.id ?? null
  save.state.nextMonId = Math.max(save.state.nextMonId, ...save.box.map((mon) => mon.id + 1))
  return save
}
