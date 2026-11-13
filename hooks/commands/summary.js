import { bandLines } from '../ui/band.js'

/** @type {import('./index.js').Command} */
export const summary = {
  name: '',
  usage: '/tokemon',
  about: 'Résumé : mon actif, niveau, XP, boosts',
  async run(app) {
    const { repo } = app.ready()
    const save = await repo.load()
    return bandLines(save, app.now())
      .map((line) => line.text)
      .join('\n')
  },
}
