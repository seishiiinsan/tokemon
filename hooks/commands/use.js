import { useItem } from '../core/items.js'

/** @type {import('./index.js').Command} */
export const use = {
  name: 'use',
  usage: '/tokemon use <item> [mon]',
  about: 'Utiliser un item du sac (pierre, Link Cable, bonbon, baie, boost)',
  async run(app, args) {
    return (await app.act((save, ctx) => useItem(save, args, ctx))).message
  },
}
