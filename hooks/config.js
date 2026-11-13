// Toutes les constantes d'équilibrage et de réglage de Tokemon.
// Les règles et leur justification sont documentées dans docs/balancing.md.

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// ── Persistance ──────────────────────────────────────────────────────────────
export const STORE_PREFIX = 'tokemon:v1:'
export const SCHEMA_VERSION = 1
/** Nombre de tours mémorisés pour dédupliquer le comptage (sessions concurrentes, hooks rejoués) */
export const SEEN_TURNS_MAX = 300
export const HISTORY_DAYS_MAX = 365
export const HISTORY_EVENTS_MAX = 50

// ── Tokens ───────────────────────────────────────────────────────────────────
/** Estimation de dernier recours : caractères de réponse par token */
export const ESTIMATE_CHARS_PER_TOKEN = 4
/** Marge avant le début du tour lors de la lecture du transcript (fallback) */
export const TRANSCRIPT_SLACK_MS = 2_000

// ── XP et niveaux ────────────────────────────────────────────────────────────
export const XP_PER_TOKEN = 1
export const MAX_LEVEL = 100
/** Courbe « medium fast » : XP totale pour atteindre le niveau n = n ** LEVEL_CURVE_EXPONENT */
export const LEVEL_CURVE_EXPONENT = 3

// ── Démarrage ────────────────────────────────────────────────────────────────
export const STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu']
export const STARTER_LEVEL = 5
/** @type {Record<string, number>} */
export const STARTER_BAG = { 'poke-ball': 10, 'rare-candy': 1 }
export const NICKNAME_MAX_LENGTH = 16

// ── Évolutions ───────────────────────────────────────────────────────────────
/** Délai entre l'annonce d'une évolution par niveau et son application (fenêtre de /tokemon stop) */
export const EVOLUTION_DELAY_MS = 15_000
/** Niveau utilisé quand la méthode officielle n'existe pas en V1 (bonheur, lieu, objet tenu…) */
export const FALLBACK_EVOLUTION_LEVEL = 30
/** Niveau de repli pour l'évolution d'un bébé (Pichu, Toudoudou…), officiellement par bonheur */
export const FALLBACK_BABY_EVOLUTION_LEVEL = 15

// ── Rencontres ───────────────────────────────────────────────────────────────
export const ENCOUNTER_EVERY = 5_000
export const ENCOUNTER_CHANCE = 0.35
export const INCENSE_ENCOUNTER_MULTIPLIER = 2
export const WILD_DURATION_MS = 10 * MINUTE
export const WILD_MAX_FAILED_THROWS = 3
/** Diviseur du poids de spawn par stade d'évolution (stade 1, 2, 3) */
export const STAGE_WEIGHT_DIVISORS = [1, 3, 9]

/** @typedef {'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'} Rarity */

/**
 * @typedef {object} RarityRule
 * @property {string} label nom affiché
 * @property {number} spawnWeight poids de spawn
 * @property {number} catchRate taux de capture de base (0 à 1)
 * @property {[number, number]} levelRange fourchette de niveau à la capture
 */

/** @type {Record<Rarity, RarityRule>} */
export const RARITIES = {
  common: { label: 'Commun', spawnWeight: 60, catchRate: 0.8, levelRange: [2, 12] },
  uncommon: { label: 'Peu commun', spawnWeight: 25, catchRate: 0.6, levelRange: [8, 20] },
  rare: { label: 'Rare', spawnWeight: 10, catchRate: 0.4, levelRange: [15, 30] },
  epic: { label: 'Épique', spawnWeight: 4, catchRate: 0.2, levelRange: [25, 45] },
  legendary: { label: 'Légendaire', spawnWeight: 1, catchRate: 0.05, levelRange: [50, 70] },
}

export const SHINY_CHANCE = 1 / 512
export const SHINY_CHARM_MULTIPLIER = 3

// ── Drops ────────────────────────────────────────────────────────────────────
export const DROP_EVERY = 2_000
export const DROP_CHANCE = 0.15
/** Une Master Ball garantie à chaque palier de tokens cumulés */
export const MASTER_BALL_MILESTONE = 1_000_000

// ── Items ────────────────────────────────────────────────────────────────────
export const BALL_MULTIPLIERS = {
  'poke-ball': 1,
  'great-ball': 1.5,
  'ultra-ball': 2,
  'master-ball': Number.POSITIVE_INFINITY,
}
export const BERRY_XP = { 'oran-berry': 500, 'sitrus-berry': 2_000 }
export const RARE_CANDY_LEVELS = 1

/** @typedef {'incense' | 'lucky-egg' | 'exp-share' | 'shiny-charm'} BoostId */

/** Durée de chaque boost temporaire */
/** @type {Record<BoostId, number>} */
export const BOOST_DURATIONS = {
  incense: 30 * MINUTE,
  'lucky-egg': HOUR,
  'exp-share': HOUR,
  'shiny-charm': 24 * HOUR,
}
export const LUCKY_EGG_XP_MULTIPLIER = 2
/** Part de l'XP gagnée que chaque autre mon de la box reçoit sous Multi Exp (en bonus, non déduite) */
export const EXP_SHARE_RATIO = 0.25

// ── Interface ────────────────────────────────────────────────────────────────
export const PANE_ID = 'tokemon'
export const PANE_TITLE = 'Tokemon'
export const COMMAND_NAME = 'tokemon'
/** Cadence d'animation : 8 images par seconde, comme les GIF d'origine */
export const TICK_MS = 125
/** Sur le desktop il n'y a pas de Raster : la bande est redessinée (Svg) tous les N ticks */
export const DESKTOP_REDRAW_TICKS = 2
/** Hauteur maximale de la scène dans la bande, en lignes de terminal (2 pixels par ligne) */
export const BAND_MAX_ROWS = 10
/** Largeur de la scène, en colonnes (1 pixel par colonne) */
export const BAND_SCENE_COLUMNS = 56
export const BAND_TEXT_MIN_COLUMNS = 26
/** Taille d'un pixel de sprite sur le desktop, en pixels CSS */
export const DESKTOP_PIXEL_PX = 3
export const XP_BAR_WIDTH = 12
export const JUMP_TICKS = 8
export const FLASH_TICKS = 16
export const BALL_TICKS = 12
export const STATS_DAYS = 30
export const DEX_PAGE_SIZE = 30
export const BOX_PAGE_SIZE = 12

// ── Téléchargement des sprites (gens 2 à 5) ──────────────────────────────────
export const SPRITE_REPO_API = 'https://api.github.com/repos/jakobhoeg/vscode-pokemon/contents/media'
export const DOWNLOADABLE_GENS = [2, 3, 4, 5]
export const SPRITE_VARIANTS = /** @type {const} */ (['default', 'shiny'])
export const SPRITE_ANIMS = /** @type {const} */ (['idle', 'walk'])
/** Nombre de mons entre deux écritures du cache pendant un téléchargement (reprise possible) */
export const DOWNLOAD_SAVE_EVERY = 8
/** Nombre maximal de mons téléchargés par commande (l'API GitHub anonyme limite à 60 requêtes/heure) */
export const DOWNLOAD_BATCH_MONS = 14
