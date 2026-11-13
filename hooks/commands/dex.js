import { RARITIES } from '../config.js'
import { describeMethod } from '../core/evolution.js'
import { dexCompletion } from '../core/stats.js'
import { EVOLUTIONS } from '../data/evolutions.js'
import { findSpecies, speciesName } from '../data/lookup.js'
import { rarityOf } from '../data/rarity.js'
import { SPECIES } from '../data/species.js'
import { hasSprite } from '../ui/render/frames.js'
import { bar } from '../ui/text.js'

/**
 * @param {import('../store/schema.js').Save} save
 * @returns {string[]} la complétion du Pokédex, une ligne par génération
 */
export function dexSummaryLines(save) {
  return dexCompletion(save).map(({ gen, seen, caught, total }) => {
    const local = Object.keys(SPECIES).some((id) => SPECIES[id].gen === gen && hasSprite(id))
    return `Gen ${gen}  ${bar(caught / total, 10)}  ${caught}/${total} capturés · ${seen} vus${local ? '' : `  (sprites : /tokemon download gen${gen})`}`
  })
}

/**
 * @param {import('../store/schema.js').Save} save
 * @param {string} id
 * @returns {string[]} la fiche d'une espèce
 */
export function dexEntryLines(save, id) {
  const species = SPECIES[id]
  const entry = save.dex[id]
  const lines = [
    `N° ${String(species.dex).padStart(3, '0')} ${species.name} · gen ${species.gen} · ${RARITIES[rarityOf(id)].label}`,
  ]
  lines.push(
    entry
      ? `Vu ${entry.seen} fois · capturé ${entry.caught} fois${entry.shiny > 0 ? ` · ✨ ${entry.shiny}` : ''}`
      : 'Jamais rencontré.',
  )
  const evolutions = EVOLUTIONS[id] ?? []
  if (evolutions.length > 0)
    lines.push(
      'Évolue en : ' +
        evolutions.map((evolution) => `${speciesName(evolution.to)} (${describeMethod(evolution)})`).join(', '),
    )
  return lines
}

/** @type {import('./index.js').Command} */
export const dex = {
  name: 'dex',
  usage: '/tokemon dex [mon]',
  about: "Pokédex : complétion par génération, ou fiche d'un mon",
  async run(app, args) {
    const save = await app.ready().repo.load()
    if (!args.trim()) return ['Pokédex :', ...dexSummaryLines(save)].join('\n')
    const id = findSpecies(args)
    return id ? dexEntryLines(save, id).join('\n') : `Espèce inconnue : « ${args.trim()} ».`
  },
}
