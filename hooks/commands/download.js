import { DOWNLOADABLE_GENS } from '../config.js'
import { appendGen } from '../sprites/cache.js'
import { downloadGen } from '../sprites/download.js'
import { hasSprite, registerSprites } from '../ui/render/frames.js'

/** Les générations en cours de téléchargement dans cette session */
const running = new Set()

/** @type {import('./index.js').Command} */
export const download = {
  name: 'download',
  usage: '/tokemon download <gen2..gen5>',
  about: "Télécharger les sprites d'une génération (par lots, reprise automatique)",
  async run(app, args) {
    const gen = Number(/^(?:gen)?\s*(\d)$/i.exec(args.trim())?.[1])
    if (!DOWNLOADABLE_GENS.includes(gen))
      return `Précise la génération : /tokemon download <${DOWNLOADABLE_GENS.map((value) => 'gen' + value).join('|')}>. La gen 1 est déjà embarquée.`
    if (running.has(gen)) return `Le téléchargement de la gen ${gen} est déjà en cours.`
    const { io } = app.ready()
    running.add(gen)
    // En arrière-plan : la commande répond tout de suite, le résultat arrive par toast
    void downloadGen({
      fetch: (url, init) => io.http.fetch(url, init),
      gen,
      has: hasSprite,
      save: async (sprites) => {
        await appendGen(io, gen, sprites)
        registerSprites(sprites)
      },
    })
      .then((result) => {
        const progress = `${result.have}/${result.total} sprites`
        if (result.complete) return `Gen ${gen} complète (${progress}). Ses Pokémon peuvent maintenant apparaître.`
        if (result.stopped) return `Gen ${gen} : ${progress}. ${result.stopped}`
        const failed = result.failed.length > 0 ? ` (${result.failed.length} en échec)` : ''
        return `Gen ${gen} : +${result.added}, ${progress}${failed}. Relance /tokemon download gen${gen} pour le lot suivant.`
      })
      .catch(
        (error) =>
          `Téléchargement de la gen ${gen} impossible : ${error instanceof Error ? error.message : String(error)}`,
      )
      .then((message) => {
        running.delete(gen)
        io.ui.toast(message)
        io.ui.invalidate('ui.render')
      })
    return `Téléchargement de la gen ${gen} lancé (un lot de 14 Pokémon). Le résultat arrive par notification.`
  },
}
