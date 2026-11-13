import { SCHEMA_VERSION } from '../config.js'

// Schéma des données persistées dans $.store (clés préfixées par STORE_PREFIX).

/**
 * @typedef {object} Mon
 * @property {number} id identifiant unique dans la box
 * @property {string} species dossier de sprites (clé de SPECIES)
 * @property {string | null} nickname
 * @property {number} level
 * @property {number} xp XP totale (niveau n = n³)
 * @property {boolean} shiny
 * @property {number} caughtAt horodatage (ms)
 * @property {string} [evolvedFrom] espèce précédente, après une évolution
 * @property {'default' | 'shiny'} [variant] variante affichée (un shiny peut afficher sa forme normale)
 * @property {boolean} [noEvolve] évolution par niveau annulée avec /tokemon stop
 */

/**
 * @typedef {object} Wild
 * @property {string} species
 * @property {boolean} shiny
 * @property {number} level
 * @property {number} appearedAt
 * @property {number} expiresAt
 * @property {number} failedThrows
 */

/**
 * @typedef {object} Stats
 * @property {number} encounters
 * @property {number} captures
 * @property {number} throws
 * @property {number} fled
 * @property {number} shinySeen
 * @property {number} shinyCaught
 * @property {number} itemsFound
 * @property {number} itemsUsed
 * @property {number} evolutions
 * @property {number} stoneEvolutions
 * @property {number} tradeEvolutions
 * @property {number} masterBallsUsed
 * @property {number} turns
 */

/**
 * @typedef {object} State
 * @property {number} version version du schéma (migrations)
 * @property {number | null} activeMonId
 * @property {boolean} starterChosen
 * @property {{ outputTokens: number, xp: number, approximateTokens: number }} totals
 * @property {{ sinceEncounter: number, sinceDrop: number }} counters
 * @property {Wild | null} wild
 * @property {{ monId: number, to: string, startedAt: number } | null} pendingEvolution
 * @property {string[]} seenTurns identifiants des derniers tours comptés (déduplication)
 * @property {number} nextMonId
 * @property {Stats} stats
 * @property {{ lastDay: string, count: number, best: number }} streak jours consécutifs avec une session
 * @property {boolean} paneOpen
 */

/** @typedef {{ id: import('../config.js').BoostId, expiresAt: number }} Boost */
/** @typedef {{ seen: number, caught: number, shiny: number }} DexEntry */
/** @typedef {{ date: string, outputTokens: number, xp: number }} DayTotals */
/** @typedef {{ at: number, type: string, text: string }} LogEntry */

/**
 * L'ensemble des données de jeu, une propriété par clé du store.
 * @typedef {object} Save
 * @property {State} state
 * @property {Mon[]} box
 * @property {Record<string, number>} bag
 * @property {Boost[]} boosts
 * @property {Record<string, DexEntry>} dex
 * @property {Record<string, number>} achievements identifiant → horodatage de déblocage
 * @property {{ days: DayTotals[], events: LogEntry[] }} history
 */

/** Les clés du store, dans l'ordre de Save */
export const SAVE_KEYS = /** @type {const} */ (['state', 'box', 'bag', 'boosts', 'dex', 'achievements', 'history'])

/** @returns {Stats} */
export const emptyStats = () => ({
  encounters: 0,
  captures: 0,
  throws: 0,
  fled: 0,
  shinySeen: 0,
  shinyCaught: 0,
  itemsFound: 0,
  itemsUsed: 0,
  evolutions: 0,
  stoneEvolutions: 0,
  tradeEvolutions: 0,
  masterBallsUsed: 0,
  turns: 0,
})

/** @returns {Save} une sauvegarde vierge (premier lancement) */
export function emptySave() {
  return {
    state: {
      version: SCHEMA_VERSION,
      activeMonId: null,
      starterChosen: false,
      totals: { outputTokens: 0, xp: 0, approximateTokens: 0 },
      counters: { sinceEncounter: 0, sinceDrop: 0 },
      wild: null,
      pendingEvolution: null,
      seenTurns: [],
      nextMonId: 1,
      stats: emptyStats(),
      streak: { lastDay: '', count: 0, best: 0 },
      paneOpen: false,
    },
    box: [],
    bag: {},
    boosts: [],
    dex: {},
    achievements: {},
    history: { days: [], events: [] },
  }
}
