import { switchActive } from '../core/team.js'

/** @type {import('./index.js').Command} */
export const switchMon = {
  name: 'switch',
  usage: '/tokemon switch <mon>',
  about: 'Changer de mon actif (nom, surnom ou #numéro de la box)',
  async run(app, args) {
    if (!args.trim()) return 'Précise le mon : /tokemon switch <nom|#numéro>. /tokemon box pour la liste.'
    return (await app.act((save) => switchActive(save, args))).message
  },
}
