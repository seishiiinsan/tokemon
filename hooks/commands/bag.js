import { ITEM_LIST } from '../data/items.js'
import { boostsLine } from '../ui/text.js'

/** @type {Record<import('../data/items.js').ItemKind, string>} */
const KIND_LABELS = {
  ball: 'Balls',
  stone: 'Pierres',
  trade: 'Pierres',
  candy: 'Consommables',
  berry: 'Consommables',
  boost: 'Boosts',
}

/**
 * @param {import('../store/schema.js').Save} save
 * @returns {{ title: string, lines: string[] }[]} le contenu du sac, par catégorie
 */
export function bagSections(save) {
  /** @type {Map<string, string[]>} */
  const sections = new Map()
  for (const item of ITEM_LIST) {
    const count = save.bag[item.id] ?? 0
    if (count <= 0) continue
    const title = KIND_LABELS[item.kind]
    sections.set(title, [...(sections.get(title) ?? []), `${item.icon} ${item.name} ×${count} · ${item.effect}`])
  }
  return [...sections].map(([title, lines]) => ({ title, lines }))
}

/** @type {import('./index.js').Command} */
export const bag = {
  name: 'bag',
  usage: '/tokemon bag',
  about: 'Inventaire',
  async run(app) {
    const save = await app.ready().repo.load()
    const sections = bagSections(save)
    const boosts = boostsLine(save, app.now())
    const lines =
      sections.length === 0
        ? ['Ton sac est vide. Les items tombent au fil des tokens.']
        : sections.flatMap((section) => [section.title + ' :', ...section.lines.map((line) => '  ' + line)])
    if (boosts) lines.push('Boosts actifs : ' + boosts)
    return lines.join('\n')
  },
}
