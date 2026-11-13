import { setVariant } from '../core/team.js'

/** @type {import('./index.js').Command} */
export const shiny = {
  name: 'shiny',
  usage: '/tokemon shiny',
  about: "Afficher la forme shiny d'un mon shiny",
  async run(app) {
    return (await app.act((save) => setVariant(save, 'shiny'))).message
  },
}

/** @type {import('./index.js').Command} */
export const normal = {
  name: 'default',
  usage: '/tokemon default',
  about: "Afficher la forme normale d'un mon shiny",
  async run(app) {
    return (await app.act((save) => setVariant(save, 'default'))).message
  },
}
