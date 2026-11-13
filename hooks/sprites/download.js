import { DOWNLOAD_BATCH_MONS, DOWNLOAD_SAVE_EVERY, SPRITE_ANIMS, SPRITE_REPO_API } from '../config.js'
import { SPECIES } from '../data/species.js'
import { decodeBase64 } from '../ui/render/base64.js'
import { buildSprite } from '../ui/render/frames.js'
import { decodeGif } from '../ui/render/gif.js'

// Téléchargement à la demande des sprites des gens 2 à 5 depuis jakobhoeg/vscode-pokemon.
// $.http.fetch ne rend que du texte : les GIF passent par l'API « contents » de GitHub, qui les
// renvoie en base64 dans du JSON. C'est le seul appel réseau du mod ; rien de personnel n'est envoyé.
// Sans jeton, GitHub limite à 60 requêtes par heure : un lot fait au plus 1 + 14 × 4 = 57 requêtes,
// et la commande reprend là où elle s'est arrêtée.

/** @typedef {import('../ui/render/frames.js').Sprite} Sprite */
/** @typedef {(url: string, init?: { headers?: Record<string, string> }) => Promise<import('../types.js').HttpResponse>} Fetch */

const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'tokemon-sprites' }

/** Un refus de GitHub lié au quota de requêtes anonymes */
export class RateLimitError extends Error {}
/** Un fichier absent du dépôt de sprites */
export class NotFoundError extends Error {}

/**
 * @param {Fetch} fetch
 * @param {string} path chemin sous media/
 * @returns {Promise<any>} le JSON renvoyé par l'API
 */
async function getJson(fetch, path) {
  const response = await fetch(`${SPRITE_REPO_API}/${path}`, { headers: HEADERS })
  if (response.status === 403 || response.status === 429) {
    throw new RateLimitError(
      'GitHub limite les requêtes anonymes à 60 par heure. Relance la commande plus tard pour continuer.',
    )
  }
  if (response.status === 404) throw new NotFoundError(`${path} est absent du dépôt de sprites`)
  if (!response.ok) throw new Error(`GitHub a répondu ${response.status} pour ${path}`)
  return JSON.parse(response.text)
}

/**
 * Les dossiers de sprites d'une génération, limités aux espèces que Tokemon connaît.
 * @param {Fetch} fetch
 * @param {number} gen
 * @returns {Promise<string[]>}
 */
export async function listGen(fetch, gen) {
  const entries = await getJson(fetch, `gen${gen}`)
  if (!Array.isArray(entries)) throw new Error(`Réponse inattendue pour gen${gen}`)
  return entries.filter((entry) => entry?.type === 'dir' && SPECIES[entry.name]?.gen === gen).map((entry) => entry.name)
}

/**
 * Télécharge et compile les GIF d'un mon. La variante shiny est facultative : elle manque en
 * amont pour la gen 5, le mon s'affiche alors toujours sous sa forme normale.
 * @param {Fetch} fetch
 * @param {number} gen
 * @param {string} id
 * @returns {Promise<Sprite>}
 */
export async function fetchSprite(fetch, gen, id) {
  /** @param {string} variant */
  const sheetOf = async (variant) => {
    const gifs = await Promise.all(
      SPRITE_ANIMS.map(async (anim) => {
        const file = await getJson(fetch, `gen${gen}/${id}/${variant}_${anim}_8fps.gif`)
        if (typeof file?.content !== 'string') throw new Error(`Contenu manquant pour ${id} (${variant}_${anim})`)
        return decodeGif(decodeBase64(file.content))
      }),
    )
    return /** @type {Record<import('../ui/render/frames.js').Anim, import('../ui/render/gif.js').Gif>} */ (
      Object.fromEntries(SPRITE_ANIMS.map((anim, index) => [anim, gifs[index]]))
    )
  }
  const [normal, shiny] = await Promise.all([
    sheetOf('default'),
    sheetOf('shiny').catch((error) => {
      if (error instanceof NotFoundError) return undefined
      throw error
    }),
  ])
  return buildSprite(shiny ? { default: normal, shiny } : { default: normal })
}

/**
 * @typedef {object} DownloadResult
 * @property {number} added sprites téléchargés pendant ce lot
 * @property {number} have sprites de la génération présents en local après ce lot
 * @property {number} total sprites de la génération
 * @property {boolean} complete toute la génération est en local
 * @property {string[]} failed mons dont le téléchargement a échoué (ignorés, réessayés au prochain lot)
 * @property {string} [stopped] motif d'arrêt anticipé (quota GitHub)
 */

/**
 * Télécharge un lot de sprites manquants d'une génération.
 * @param {object} options
 * @param {Fetch} options.fetch
 * @param {number} options.gen
 * @param {(id: string) => boolean} options.has vrai si le sprite est déjà en local
 * @param {(sprites: Record<string, Sprite>) => Promise<void>} options.save appelé régulièrement avec les nouveaux sprites
 * @param {number} [options.limit] nombre maximal de mons pour ce lot
 * @returns {Promise<DownloadResult>}
 */
export async function downloadGen({ fetch, gen, has, save, limit = DOWNLOAD_BATCH_MONS }) {
  const all = await listGen(fetch, gen)
  const missing = all.filter((id) => !has(id))
  /** @type {Record<string, Sprite>} */
  let pending = {}
  let added = 0
  /** @type {string[]} */
  const failed = []
  /** @type {string | undefined} */
  let stopped
  const flush = async () => {
    if (Object.keys(pending).length === 0) return
    await save(pending)
    pending = {}
  }
  for (const id of missing.slice(0, limit)) {
    try {
      pending[id] = await fetchSprite(fetch, gen, id)
      added++
      if (added % DOWNLOAD_SAVE_EVERY === 0) await flush()
    } catch (error) {
      if (error instanceof RateLimitError) {
        stopped = error.message
        break
      }
      failed.push(id)
    }
  }
  await flush()
  const have = all.length - missing.length + added
  return { added, have, total: all.length, complete: have === all.length, failed, ...(stopped ? { stopped } : {}) }
}
