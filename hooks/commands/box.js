import { speciesName } from '../data/lookup.js'

/**
 * @param {import('../store/schema.js').Save} save
 * @returns {string[]} une ligne par mon de la box
 */
export function boxLines(save) {
  return save.box.map((mon, index) => {
    const species = speciesName(mon.species)
    const name = mon.nickname ? `${mon.nickname} (${species})` : species
    const marks = `${mon.shiny ? ' ✨' : ''}${mon.id === save.state.activeMonId ? ' ◀ actif' : ''}`
    return `#${index + 1} ${name} · niv. ${mon.level}${marks}`
  })
}

/** @type {import('./index.js').Command} */
export const box = {
  name: 'box',
  usage: '/tokemon box',
  about: 'Liste des mons capturés',
  async run(app) {
    const save = await app.ready().repo.load()
    if (save.box.length === 0) return 'Ta box est vide. /tokemon start <mon> pour choisir ton starter.'
    return [`Box (${save.box.length}) :`, ...boxLines(save)].join('\n')
  },
}
