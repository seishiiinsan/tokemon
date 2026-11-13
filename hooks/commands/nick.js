import { setNickname } from '../core/team.js'

/** @type {import('./index.js').Command} */
export const nick = {
  name: 'nick',
  usage: '/tokemon nick <nom>',
  about: 'Surnom du mon actif (sans nom : le retire)',
  async run(app, args) {
    return (await app.act((save) => setNickname(save, args))).message
  },
}
