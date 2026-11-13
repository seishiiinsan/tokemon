import { cancelEvolution, evolveActive } from '../core/evolution.js'

/** @type {import('./index.js').Command} */
export const evolve = {
  name: 'evolve',
  usage: '/tokemon evolve [forme]',
  about: 'Faire évoluer le mon actif (forme à préciser pour Évoli)',
  async run(app, args) {
    return (await app.act((save, ctx) => evolveActive(save, args, ctx))).message
  },
}

/** @type {import('./index.js').Command} */
export const stop = {
  name: 'stop',
  usage: '/tokemon stop',
  about: "Annuler l'évolution en cours",
  async run(app) {
    return (await app.act((save) => cancelEvolution(save))).message
  },
}
