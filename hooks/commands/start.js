import { chooseStarter } from '../core/team.js'

/** @type {import('./index.js').Command} */
export const start = {
  name: 'start',
  usage: '/tokemon start <mon>',
  about: 'Choisir le starter (premier lancement seulement)',
  async run(app, args) {
    return (await app.act((save, ctx) => chooseStarter(save, args, ctx.now))).message
  },
}
