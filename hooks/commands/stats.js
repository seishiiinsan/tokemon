import { journalLines, statsLines } from '../ui/pane/stats.js'

/** @type {import('./index.js').Command} */
export const stats = {
  name: 'stats',
  usage: '/tokemon stats',
  about: 'Tableau de bord : tokens par jour, captures, items, journal',
  async run(app) {
    const save = await app.ready().repo.load()
    const journal = journalLines(save).slice(0, 10)
    return [
      ...statsLines(save, app.now()),
      '',
      'Derniers événements :',
      ...(journal.length > 0 ? journal : ['Rien pour le moment.']),
    ].join('\n')
  },
}
