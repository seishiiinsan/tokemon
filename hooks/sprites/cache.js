import { DOWNLOADABLE_GENS } from '../config.js'
import { registerSprites } from '../ui/render/frames.js'

// Cache local des sprites téléchargés : un fichier JSON par génération, hors du dossier du
// plugin pour survivre à ses mises à jour (~/.claude/tokemon/sprites/genN.json).
// Le store du mod est plafonné à 4 Mio : les sprites n'y ont pas leur place.

/** @typedef {import('../types.js').Host} Host */
/** @typedef {import('../ui/render/frames.js').Sprite} Sprite */

const CACHE_VERSION = 1

/**
 * @param {Host} io
 * @returns {Promise<string>} le dossier du cache
 */
export async function cacheDir(io) {
  const home = (await io.env.get('HOME')) ?? (await io.env.get('USERPROFILE'))
  return home ? `${home.replace(/[\\/]+io/, '')}/.claude/tokemon/sprites` : `${io.plugin.root}/.cache/sprites`
}

/**
 * @param {Host} io
 * @param {number} gen
 * @returns {Promise<Record<string, Sprite>>} les sprites en cache pour cette génération (vide si aucun)
 */
export async function readGen(io, gen) {
  const path = `${await cacheDir(io)}/gen${gen}.json`
  try {
    if (!(await io.fs.exists(path))) return {}
    const data = JSON.parse(await io.fs.read(path))
    return data?.version === CACHE_VERSION && data.sprites && typeof data.sprites === 'object' ? data.sprites : {}
  } catch {
    // Cache illisible ou corrompu : on repart de zéro pour cette génération
    return {}
  }
}

/**
 * Ajoute des sprites au cache d'une génération.
 * @param {Host} io
 * @param {number} gen
 * @param {Record<string, Sprite>} sprites
 */
export async function appendGen(io, gen, sprites) {
  const merged = { ...(await readGen(io, gen)), ...sprites }
  await io.fs.write(
    `${await cacheDir(io)}/gen${gen}.json`,
    JSON.stringify({ version: CACHE_VERSION, gen, sprites: merged }),
  )
}

/**
 * Charge tous les sprites en cache dans le registre.
 * @param {Host} io
 * @returns {Promise<Record<number, number>>} nombre de sprites chargés par génération
 */
export async function loadCachedSprites(io) {
  /** @type {Record<number, number>} */
  const counts = {}
  for (const gen of DOWNLOADABLE_GENS) {
    const sprites = await readGen(io, gen)
    registerSprites(sprites)
    counts[gen] = Object.keys(sprites).length
  }
  return counts
}
